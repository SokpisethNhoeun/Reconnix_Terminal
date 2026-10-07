"""The browser terminal's WebSocket server on 127.0.0.1.

Every handshake is checked by `guard.check` (Host, Origin, single-use ticket) before it
completes. An accepted connection is first sent the hello that proves this is the real
helper, then gets its own TUI in a pseudo-terminal (a pty, or ConPTY on Windows), sized by
the browser's first resize.
Bytes then flow both ways until the TUI exits, the browser goes away, or nothing is typed
for `idle_seconds`. At most `max_sessions` run at once; every TUI stops with the server.

Terminal data is never logged: passwords and one-time codes are typed here. The log only
says that a session started, ended or was refused.
"""

import asyncio
import logging
import os
import signal
import sys
import threading
from dataclasses import replace
from http import HTTPStatus
from typing import Callable, Optional, Set, Tuple

from websockets.asyncio.server import Server, ServerConnection, serve
from websockets.exceptions import ConnectionClosed
from websockets.http11 import Request, Response

from . import guard, protocol
from . import session as terminal
from .session import Session, child_env
from .settings import Settings
from .ticket import TicketBook, hello_proof

log = logging.getLogger("reconix.webterm")
# websockets logs every frame at DEBUG, and frames carry what is typed (passwords, codes):
# its logger is pinned at WARNING whatever the root level, so frames are never formatted.
_ws_log = logging.getLogger("reconix.webterm.ws")
_ws_log.setLevel(logging.WARNING)

DEFAULT_SIZE = (120, 36)       # cols, rows until the browser says otherwise
FIRST_SIZE_WAIT = 2.0          # seconds to wait for the browser's first resize

Closing = Optional[Tuple[int, str]]    # (close code, reason) to send; None: the browser left


class TerminalServer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.tickets = TicketBook(settings.token)
        self.sessions: Set[Session] = set()
        self._server: Optional[Server] = None
        self._active = 0               # connections holding a slot (spawned or about to)
        self._started = 0

    @property
    def active(self) -> int:
        """Sessions running or starting (at most settings.max_sessions)."""
        return self._active

    async def start(self) -> int:
        """Listen on 127.0.0.1. Returns the port (the one picked when settings.port is 0)."""
        self._server = await serve(
            self._handle, "127.0.0.1", self.settings.port, process_request=self._check,
            compression=None, max_size=protocol.MAX_MESSAGE, server_header=None,
            logger=_ws_log)
        port = self._server.sockets[0].getsockname()[1]
        self.settings = replace(self.settings, port=port)      # the Host check needs it
        return port

    async def stop(self) -> None:
        """Close every connection and stop every TUI."""
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()
            self._server = None
        for session in list(self.sessions):
            await session.close()
        self.sessions.clear()

    # --- handshake -------------------------------------------------------------------------
    def _check(self, connection: ServerConnection, request: Request) -> Optional[Response]:
        why, nonce = guard.check(self.settings, self.tickets, request.headers.get("Host"),
                                 request.headers.get("Origin"), request.path)
        if not why:
            connection.reconix_nonce = nonce        # for the hello (see _handle)
            return None
        log.info("Refused a connection: %s", why)
        return connection.respond(HTTPStatus.FORBIDDEN, why + "\n")

    # --- one session -----------------------------------------------------------------------
    async def _handle(self, ws: ServerConnection) -> None:
        try:
            await ws.send(protocol.hello_message(hello_proof(self.settings.token,
                                                             ws.reconix_nonce)))
        except ConnectionClosed:
            return
        limit = self.settings.max_sessions
        if self._active >= limit:
            log.info("Refused a session: %d already open", self._active)
            await ws.close(protocol.CLOSE_BUSY,
                           f"{limit} terminals are already open. Close one, then try again.")
            return
        self._active += 1
        self._started += 1
        number, session = self._started, None
        try:
            size, early = await self._first_size(ws)
            try:
                session = terminal.spawn(self.settings.command, child_env(os.environ), size)
            except OSError as error:
                log.error("Session %d: couldn't start the terminal app: %s", number, error)
                await ws.close(protocol.CLOSE_ENDED, "The terminal app couldn't start. "
                               "The dashboard's output says why.")
                return
            self.sessions.add(session)
            log.info("Session %d started (%d open)", number, self._active)
            if early:
                session.write(early)
            closing = await self._pump(ws, session)
            if closing:
                await ws.close(*closing)
        except ConnectionClosed:
            pass
        finally:
            self._active -= 1
            if session is not None:
                self.sessions.discard(session)
                code = await session.close()
                log.info("Session %d ended (exit code %s)", number, code)

    async def _first_size(self, ws: ServerConnection) -> Tuple[Tuple[int, int], bytes]:
        """The browser's first size, or the default and any keystrokes sent before it."""
        try:
            message = await asyncio.wait_for(ws.recv(), FIRST_SIZE_WAIT)
        except asyncio.TimeoutError:
            return DEFAULT_SIZE, b""
        if isinstance(message, str):
            return protocol.parse_resize(message) or DEFAULT_SIZE, b""
        return DEFAULT_SIZE, message

    async def _pump(self, ws: ServerConnection, session: Session) -> Closing:
        output = asyncio.ensure_future(self._output(ws, session))
        keys = asyncio.ensure_future(self._input(ws, session))
        done, pending = await asyncio.wait({output, keys}, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
        return (output if output in done else keys).result()

    async def _output(self, ws: ServerConnection, session: Session) -> Closing:
        try:
            while True:
                data = await session.read()
                if not data:
                    return protocol.CLOSE_ENDED, "The Reconix session ended."
                await ws.send(data)
        except ConnectionClosed:
            return None

    async def _input(self, ws: ServerConnection, session: Session) -> Closing:
        """Keystrokes and resizes in. Only keystrokes count as activity: a resize comes
        from the window, and the TUI's output never stops (its cursor blinks)."""
        loop = asyncio.get_running_loop()
        idle = self.settings.idle_seconds
        deadline = loop.time() + idle
        try:
            while True:
                try:
                    message = await asyncio.wait_for(ws.recv(), max(0.0, deadline - loop.time()))
                except asyncio.TimeoutError:
                    minutes = max(1, round(idle / 60))
                    return protocol.CLOSE_IDLE, (f"Closed after {minutes} minute"
                                                 f"{'' if minutes == 1 else 's'} without typing.")
                if isinstance(message, bytes):
                    session.write(message)
                    deadline = loop.time() + idle
                else:
                    size = protocol.parse_resize(message)
                    if size:
                        session.resize(*size)
        except ConnectionClosed:
            return None


async def run(settings: Settings) -> None:
    """Serve until SIGINT or SIGTERM (or until stdin closes, with `watch_stdin`)."""
    loop = asyncio.get_running_loop()
    done = loop.create_future()

    def finish() -> None:
        if not done.done():
            done.set_result(None)

    _on_signals(loop, finish)
    if settings.watch_stdin:
        _watch_stdin(loop, finish)
    server = TerminalServer(settings)
    port = await server.start()
    log.info("Ready on ws://127.0.0.1:%d for the dashboard on port %d", port, settings.web_port)
    if settings.stand_in:
        log.warning("TEST MODE: sessions run %s, not the Reconix TUI", " ".join(settings.command))
    try:
        await done
    finally:
        await server.stop()
        log.info("Stopped")


def _on_signals(loop: asyncio.AbstractEventLoop, finish: Callable[[], None]) -> None:
    """Stop on SIGINT, SIGTERM, SIGHUP, SIGQUIT (Windows: Ctrl+C and Ctrl+Break)."""
    for name in ("SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT", "SIGBREAK"):
        sig = getattr(signal, name, None)
        if sig is None:
            continue
        try:
            loop.add_signal_handler(sig, finish)
        except NotImplementedError:      # Windows: the event loop has no signal handlers
            try:
                signal.signal(sig, lambda *_: _call_soon(loop, finish))
            except (OSError, ValueError):
                pass


def _call_soon(loop: asyncio.AbstractEventLoop, callback: Callable[[], None]) -> None:
    try:
        loop.call_soon_threadsafe(callback)
    except RuntimeError:                 # the loop already closed
        pass


def _watch_stdin(loop: asyncio.AbstractEventLoop, finish: Callable[[], None]) -> None:
    """The launcher keeps our stdin open; end of file means it died, so stop too."""
    fd = sys.stdin.fileno()
    if sys.platform == "win32":          # no add_reader on a pipe there: wait in a thread
        def wait() -> None:
            try:
                while os.read(fd, 1024):
                    pass
            except OSError:
                pass
            _call_soon(loop, finish)

        threading.Thread(target=wait, name="webterm-stdin", daemon=True).start()
        return

    def readable() -> None:
        try:
            data = os.read(fd, 1024)
        except OSError:
            data = b""
        if not data:
            loop.remove_reader(fd)
            finish()

    loop.add_reader(fd, readable)
