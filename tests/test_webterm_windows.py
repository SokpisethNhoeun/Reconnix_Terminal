"""The browser terminal on Windows, checked anywhere: a stand-in for pywinpty's PtyProcess
plays the pseudo console (it records what the session asks of it), so these run on Linux
and macOS too. The real console is checked by running the dashboard on Windows."""

import asyncio
import importlib.machinery
import queue
import subprocess
import sys
import threading
import types
from dataclasses import replace
from typing import List

import pytest

from reconix import web_server
from reconix.web_server import _own_group as real_own_group
from reconix.web_server import stop as real_stop            # before conftest stubs it
from reconix.webterm import protocol, pty_windows, session, settings
from reconix.webterm.pty_windows import ConPtySession
from reconix.webterm.server import TerminalServer

from .test_webterm_server import SETTINGS, closed_with, open_terminal, read_until, until

SPAWNED: List["FakeConsole"] = []


class FakeConsole:
    """pywinpty's PtyProcess, as far as the session uses it."""

    def __init__(self, argv, cwd, env, dimensions) -> None:
        self.argv, self.cwd, self.env, self.dimensions = argv, cwd, env, dimensions
        self.pid = 4242
        self.output: "queue.Queue" = queue.Queue()
        self.written: List[str] = []
        self.sizes: List[tuple] = []
        self.alive = True
        self.exitstatus = None
        self.terminated = self.closed = False
        self.gate = threading.Event()          # cleared: writes wait (a busy program)
        self.gate.set()

    @classmethod
    def spawn(cls, argv, cwd=None, env=None, dimensions=(24, 80)):
        if argv[0] == "missing":
            raise FileNotFoundError("The command was not found or was not executable")
        if argv[0] == "broken":
            raise RuntimeError("CreatePseudoConsole failed")
        console = cls(argv, cwd, env, dimensions)
        SPAWNED.append(console)
        return console

    def read(self, size=1024):
        item = self.output.get()
        if item is None:
            raise EOFError("Pty is closed")
        return item

    def write(self, text):
        self.gate.wait(5)
        self.written.append(text)
        return len(text)

    def setwinsize(self, rows, cols):
        self.sizes.append((cols, rows))

    def isalive(self):
        return self.alive

    def terminate(self, force=False):
        self.alive, self.exitstatus, self.terminated = False, 2, True
        self.output.put(None)
        return True

    def close(self, force=False):
        self.closed = True


@pytest.fixture(autouse=True)
def fake_winpty(monkeypatch):
    SPAWNED.clear()
    module = types.ModuleType("winpty")
    module.__spec__ = importlib.machinery.ModuleSpec("winpty", None)
    module.PtyProcess = FakeConsole
    monkeypatch.setitem(sys.modules, "winpty", module)
    yield
    for console in SPAWNED:                    # end the reader threads
        console.gate.set()
        console.output.put(None)


async def spawn(command=("python", "-m", "reconix"), size=(80, 24)) -> ConPtySession:
    return ConPtySession.spawn(command, {"PATH": "C:\\Python"}, size)


# --- a session -------------------------------------------------------------------------------
async def test_the_program_starts_in_a_console_of_the_browser_size():
    term = await spawn(size=(120, 36))
    console = SPAWNED[0]
    assert console.argv == ["python", "-m", "reconix"]
    assert console.dimensions == (36, 120)                   # pywinpty: (rows, cols)
    assert console.env == {"PATH": "C:\\Python"} and term.pid == 4242
    await term.close()


async def test_output_reaches_the_page_as_utf8_then_ends():
    term = await spawn()
    SPAWNED[0].output.put("héllo ◆ ")
    SPAWNED[0].output.put("")                                # pywinpty: an empty read
    SPAWNED[0].output.put("world")
    assert await term.read() == "héllo ◆ ".encode()
    assert await term.read() == b"world"
    SPAWNED[0].output.put(None)                              # EOFError: the console closed
    assert await term.read() == b""
    assert await term.read() == b""
    await term.close()


async def test_a_program_that_ended_quietly_ends_the_session():
    term = await spawn()
    SPAWNED[0].alive = False                                 # gone, but no end of output
    assert await asyncio.wait_for(term.read(), 3) == b""
    await term.close()


async def test_keystrokes_split_across_frames_arrive_whole():
    term = await spawn()
    encoded = "é◆".encode()
    term.write(encoded[:1])
    term.write(encoded[1:4])
    term.write(encoded[4:] + b"\r")
    await until(lambda: "".join(SPAWNED[0].written) == "é◆\r")
    await term.close()


async def test_input_beyond_the_cap_is_dropped_while_the_program_is_busy(monkeypatch):
    monkeypatch.setattr(pty_windows, "MAX_PENDING", 4)
    term = await spawn()
    SPAWNED[0].gate.clear()                                  # the program isn't reading
    term.write(b"ab")
    term.write(b"cdef")
    term.write(b"gh")
    SPAWNED[0].gate.set()
    await until(lambda: "".join(SPAWNED[0].written) == "abcd")
    term.write(b"ij")                                        # room again
    await until(lambda: "".join(SPAWNED[0].written) == "abcdij")
    await term.close()


async def test_resizing_and_a_same_size_resize_to_repaint():
    term = await spawn(size=(80, 24))
    term.resize(100, 30)
    assert SPAWNED[0].sizes == [(100, 30)]
    term.resize(100, 30)                                     # Clear: repaint at this size
    assert SPAWNED[0].sizes == [(100, 30), (100, 29)]
    await until(lambda: SPAWNED[0].sizes[-1] == (100, 30))
    await term.close()


async def test_closing_terminates_the_program_and_frees_the_console():
    term = await spawn()
    assert await term.close() == 2
    console = SPAWNED[0]
    assert console.terminated and console.closed
    term.write(b"too late")
    term.resize(90, 20)
    assert await term.read() == b""
    assert console.written == [] and console.sizes == []
    assert await term.close() == 2                           # twice is fine


@pytest.mark.parametrize("command", ["missing", "broken"])
async def test_a_program_that_cannot_start_is_an_os_error(command):
    with pytest.raises(OSError):
        await spawn((command,))


async def test_windows_gets_the_console_backend(monkeypatch):
    monkeypatch.setattr(session.sys, "platform", "win32")
    term = session.spawn(("python", "-m", "reconix"), {}, (80, 24))
    assert isinstance(term, ConPtySession)
    await term.close()


# --- the server on the Windows backend -------------------------------------------------------
async def test_the_server_runs_a_session_on_the_console(monkeypatch):
    monkeypatch.setattr(session, "spawn", ConPtySession.spawn)
    server = TerminalServer(replace(SETTINGS, command=("python", "-m", "reconix")))
    await server.start()
    try:
        async with open_terminal(server) as ws:
            await ws.recv()                                  # the hello
            await ws.send('{"type": "resize", "cols": 100, "rows": 30}')
            await until(lambda: bool(SPAWNED))
            console = SPAWNED[0]
            assert console.dimensions == (30, 100)
            assert "RECONIX_WEB_TOKEN" not in console.env and console.env["RECONIX_IN_WEB"] == "1"
            console.output.put("READY\r\n")
            await read_until(ws, "READY")
            await ws.send(b"typed\r")
            await until(lambda: "".join(console.written) == "typed\r")
            console.output.put(None)                         # the TUI quit
            assert (await closed_with(ws))[0] == protocol.CLOSE_ENDED
        await until(lambda: console.terminated and not server.sessions)
    finally:
        await server.stop()


# --- the rest of Windows ---------------------------------------------------------------------
def test_on_windows_the_terminal_needs_pywinpty(monkeypatch):
    monkeypatch.setattr(settings.sys, "platform", "win32")
    real_find_spec = settings.importlib.util.find_spec
    monkeypatch.setattr(settings.importlib.util, "find_spec",
                        lambda name: None if name == "winpty" else real_find_spec(name))
    assert "pywinpty" in settings.problem()
    monkeypatch.setattr(settings.importlib.util, "find_spec", real_find_spec)
    assert settings.problem() == ""                          # winpty is the fake module


def test_on_windows_web_stops_npm_and_everything_it_started(monkeypatch):
    calls = []
    monkeypatch.setattr(web_server.sys, "platform", "win32")
    monkeypatch.setattr(web_server.subprocess, "run", lambda args, **kw: calls.append(args))

    class Npm:
        pid = 777
        waited = False

        def poll(self):
            return None

        def wait(self, timeout=None):
            self.waited = True

    npm = Npm()
    real_stop(npm)
    assert calls == [["taskkill", "/PID", "777", "/T", "/F"]] and npm.waited


def test_on_windows_web_starts_npm_in_its_own_group(monkeypatch):
    monkeypatch.setattr(web_server.sys, "platform", "win32")
    monkeypatch.setattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0x200, raising=False)
    assert real_own_group() == {"creationflags": 0x200}
    monkeypatch.setattr(web_server.sys, "platform", "linux")
    assert real_own_group() == {"start_new_session": True}
