"""The browser terminal server: who may connect, and what a session does.

A stand-in program replaces the TUI: it reports its pid, environment and terminal size,
and echoes the lines it reads.
"""

import asyncio
import json
import logging
import os
import secrets
import shlex
import signal
import socket
import subprocess
import sys
import textwrap
import time
from dataclasses import replace
from typing import Optional

import pytest
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed, InvalidStatus

from reconix.webterm import Settings, protocol, ticket
from reconix.webterm.server import TerminalServer

from .support import TEST_PASSWORD

TOKEN = "server-token-0123456789abcdef"
DASHBOARD = "http://127.0.0.1:3100"
STAND_IN = textwrap.dedent("""
    import fcntl, os, signal, struct, sys, termios
    def size(*_):
        rows, cols = struct.unpack("HHHH", fcntl.ioctl(0, termios.TIOCGWINSZ, bytes(8)))[:2]
        os.write(1, f"SIZE {cols}x{rows}\\n".encode())     # print() can't be re-entered
    signal.signal(signal.SIGWINCH, size)
    print("PID", os.getpid(), flush=True)
    print("TOKEN" if "RECONIX_WEB_TOKEN" in os.environ else "NO-TOKEN", flush=True)
    print("IN-WEB" if os.environ.get("RECONIX_IN_WEB") == "1" else "NOT-IN-WEB", flush=True)
    size()
    for line in sys.stdin:
        if line.strip() == "quit":
            sys.exit(0)
        print("GOT", line.strip(), flush=True)
""")
SETTINGS = Settings(token=TOKEN, port=0, web_port=3100,
                    command=(sys.executable, "-c", STAND_IN), idle_seconds=30)


@pytest.fixture
async def make_server():
    """Start servers with changed settings; all of them stop after the test."""
    servers = []

    async def make(**changes) -> TerminalServer:
        server = TerminalServer(replace(SETTINGS, **changes))
        await server.start()
        servers.append(server)
        return server

    yield make
    for server in servers:
        await server.stop()


@pytest.fixture
async def server(make_server) -> TerminalServer:
    return await make_server()


def fresh_ticket(now: Optional[float] = None) -> str:
    return ticket.make(TOKEN, time.time() if now is None else now, secrets.token_urlsafe(16))


def open_terminal(server: TerminalServer, ticket_value: Optional[str] = None,
                  origin: Optional[str] = DASHBOARD):
    url = f"ws://127.0.0.1:{server.settings.port}/?ticket={ticket_value or fresh_ticket()}"
    return connect(url, origin=origin, compression=None, open_timeout=5)


async def read_until(ws, text: str, timeout: float = 10.0) -> str:
    seen = ""

    async def collect() -> None:
        nonlocal seen
        while text not in seen:
            message = await ws.recv()
            if isinstance(message, bytes):
                seen += message.decode(errors="replace")

    await asyncio.wait_for(collect(), timeout)
    return seen


async def closed_with(ws, timeout: float = 10.0):
    """(code, reason) the server closed with."""
    with pytest.raises(ConnectionClosed) as caught:
        await asyncio.wait_for(read_until(ws, "never printed", timeout), timeout)
    return caught.value.rcvd.code, caught.value.rcvd.reason


async def gone(pid: int, timeout: float = 5.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return True
        await asyncio.sleep(0.05)
    return False


async def until(condition, timeout: float = 5.0) -> None:
    deadline = time.monotonic() + timeout
    while not condition():
        assert time.monotonic() < deadline, "timed out"
        await asyncio.sleep(0.02)


def pid_in(output: str) -> int:
    return int(output.split("PID", 1)[1].split()[0])


# --- a session -------------------------------------------------------------------------------
async def test_the_helper_proves_itself_first(server):
    value = fresh_ticket()
    async with open_terminal(server, value) as ws:
        hello = json.loads(await ws.recv())
        nonce = value.split(".")[1]
        assert hello == {"type": "hello", "proof": ticket.hello_proof(TOKEN, nonce)}


async def test_a_session_runs_the_program_on_a_pty_of_the_browser_size(server, monkeypatch):
    monkeypatch.setenv("RECONIX_WEB_TOKEN", TOKEN)           # the server has it; the TUI not
    async with open_terminal(server) as ws:
        await ws.send('{"type": "resize", "cols": 100, "rows": 30}')
        output = await read_until(ws, "SIZE 100x30")
        assert "NO-TOKEN" in output and "IN-WEB" in output
        await ws.send(b"hello\r")
        await read_until(ws, "GOT hello")


async def test_resizing_the_browser_resizes_the_program(server):
    async with open_terminal(server) as ws:
        await ws.send('{"type": "resize", "cols": 100, "rows": 30}')
        await read_until(ws, "SIZE 100x30")
        await ws.send('{"type": "resize", "cols": 80, "rows": 24}')
        await read_until(ws, "SIZE 80x24")
        await ws.send('{"type": "resize", "cols": 99999, "rows": 24}')    # ignored
        await ws.send(b"still here\r")
        output = await read_until(ws, "GOT still here")
        assert "99999" not in output


async def test_keystrokes_before_the_first_size_are_kept(server):
    async with open_terminal(server) as ws:
        await ws.send(b"early\r")
        await read_until(ws, "GOT early")


async def test_closing_the_tab_stops_the_program(server):
    async with open_terminal(server) as ws:
        await ws.send('{"type": "resize", "cols": 100, "rows": 30}')
        pid = pid_in(await read_until(ws, "SIZE"))
    assert await gone(pid)
    assert not server.sessions


async def test_when_the_program_exits_the_page_is_told(server):
    async with open_terminal(server) as ws:
        await ws.send('{"type": "resize", "cols": 100, "rows": 30}')
        await read_until(ws, "SIZE")
        await ws.send(b"quit\r")
        assert await closed_with(ws) == (protocol.CLOSE_ENDED, "The Reconix session ended.")


async def test_stopping_the_server_stops_every_program(server):
    async with open_terminal(server) as ws:
        await ws.send('{"type": "resize", "cols": 100, "rows": 30}')
        pid = pid_in(await read_until(ws, "SIZE"))
        await server.stop()
        assert await gone(pid)


async def test_a_program_that_cannot_start_says_so_and_ends(make_server):
    server = await make_server(command=("/nonexistent/reconix-tui",))
    async with open_terminal(server) as ws:
        await ws.send('{"type": "resize", "cols": 100, "rows": 30}')
        await read_until(ws, "couldn't start")
        assert (await closed_with(ws))[0] == protocol.CLOSE_ENDED


async def test_if_the_helper_dies_its_programs_die_too():
    """Killed outright (no cleanup), the helper's pty closes and the kernel hangs up the TUI."""
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    stand_in = shlex.join([sys.executable, "-c", STAND_IN])
    env = {**os.environ, "RECONIX_WEB_TOKEN": TOKEN, "RECONIX_TERM_PORT": str(port),
           "RECONIX_TERM_TEST": "1", "RECONIX_TERM_COMMAND": stand_in}
    helper = subprocess.Popen([sys.executable, "-m", "reconix.webterm"], env=env,
                              stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    try:
        line = await asyncio.get_running_loop().run_in_executor(None, helper.stdout.readline)
        assert b"Ready" in line
        url = f"ws://127.0.0.1:{port}/?ticket={fresh_ticket()}"
        async with connect(url, origin=DASHBOARD, open_timeout=5) as ws:
            await ws.send('{"type": "resize", "cols": 100, "rows": 30}')
            pid = pid_in(await read_until(ws, "SIZE"))
            helper.send_signal(signal.SIGKILL)
            assert await gone(pid)
    finally:
        helper.kill()
        helper.wait()


# --- limits ----------------------------------------------------------------------------------
async def test_only_two_terminals_at_once(server):
    async with open_terminal(server) as one, open_terminal(server) as two:
        for ws in (one, two):
            await ws.send('{"type": "resize", "cols": 100, "rows": 30}')
            await read_until(ws, "SIZE")
        async with open_terminal(server) as three:
            code, reason = await closed_with(three)
            assert code == protocol.CLOSE_BUSY and "already open" in reason
    await until(lambda: server.active == 0)                     # the server saw them close
    async with open_terminal(server) as again:                  # a slot is free again
        await again.send('{"type": "resize", "cols": 100, "rows": 30}')
        await read_until(again, "SIZE")


async def test_an_idle_session_closes(make_server):
    server = await make_server(idle_seconds=0.5)
    async with open_terminal(server) as ws:
        await ws.send('{"type": "resize", "cols": 100, "rows": 30}')
        code, reason = await closed_with(ws)
        assert code == protocol.CLOSE_IDLE and "without typing" in reason


async def test_only_typing_keeps_a_session_open(make_server):
    server = await make_server(idle_seconds=1.0)
    async with open_terminal(server) as ws:
        await ws.send('{"type": "resize", "cols": 100, "rows": 30}')
        await read_until(ws, "SIZE")
        await asyncio.sleep(0.6)
        await ws.send(b"typing\r")                              # resets the clock
        await read_until(ws, "GOT typing")
        await asyncio.sleep(0.6)                                # 1.2 s since start: still open
        for cols in (90, 91, 92):                               # resizes don't reset it
            await ws.send(f'{{"type": "resize", "cols": {cols}, "rows": 30}}')
        assert (await closed_with(ws, timeout=3))[0] == protocol.CLOSE_IDLE


async def test_cancelling_close_still_stops_the_program():
    from reconix.webterm.pty_posix import PtySession
    from reconix.webterm.session import STOP_GRACE

    stubborn = "import signal, time; signal.signal(signal.SIGHUP, signal.SIG_IGN); time.sleep(60)"
    session = PtySession.spawn((sys.executable, "-c", stubborn), dict(os.environ), (80, 24))
    await asyncio.sleep(0.3)                                    # let it ignore SIGHUP
    closing = asyncio.ensure_future(session.close())
    await asyncio.sleep(STOP_GRACE / 4)                         # waiting out the grace period
    closing.cancel()
    with pytest.raises(asyncio.CancelledError):
        await closing
    assert await gone(session.pid)


# --- who may connect -------------------------------------------------------------------------
@pytest.mark.parametrize("origin", ["http://evil.example.com", "http://127.0.0.1:3999", None])
async def test_other_web_pages_cannot_open_a_terminal(server, origin):
    with pytest.raises(InvalidStatus) as refused:
        async with open_terminal(server, origin=origin):
            pass
    assert refused.value.response.status_code == 403
    assert not server.sessions


@pytest.mark.parametrize("bad", [
    "", "not-a-ticket",
    lambda: fresh_ticket(now=time.time() - 120),                              # expired
    lambda: ticket.make("another-token-0123456789", time.time(), "bm9uY2Utbm9uY2Utbm9uY2U"),
])
async def test_a_bad_ticket_is_refused(server, bad):
    value = bad() if callable(bad) else bad
    url = f"ws://127.0.0.1:{server.settings.port}/?ticket={value}"
    with pytest.raises(InvalidStatus) as refused:
        async with connect(url, origin=DASHBOARD, open_timeout=5):
            pass
    assert refused.value.response.status_code == 403


async def test_a_ticket_opens_one_session_only(server):
    value = fresh_ticket()
    async with open_terminal(server, value) as ws:
        await read_until(ws, "PID")
        with pytest.raises(InvalidStatus):
            async with open_terminal(server, value):
                pass


async def test_what_is_typed_is_never_logged(server, caplog):
    caplog.set_level(logging.DEBUG)
    value = fresh_ticket()
    async with open_terminal(server, value) as ws:
        await ws.send('{"type": "resize", "cols": 100, "rows": 30}')
        await read_until(ws, "SIZE")
        await ws.send(f"{TEST_PASSWORD}\r".encode())
        await read_until(ws, f"GOT {TEST_PASSWORD}")
    for _ in range(50):                                     # the "ended" line comes last
        if "ended" in caplog.text:
            break
        await asyncio.sleep(0.05)
    # The server's own records (the test's websockets client logs its frames: not ours).
    logged = "\n".join(r.getMessage() for r in caplog.records
                       if r.name.startswith("reconix.webterm"))
    assert "Session 1 started" in logged and "Session 1 ended" in logged
    assert TEST_PASSWORD not in logged and value not in logged
