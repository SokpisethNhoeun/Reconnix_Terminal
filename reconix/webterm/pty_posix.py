"""The browser terminal on Linux and macOS: the program on its own pseudo-terminal.

The program gets the pty's slave end as stdin, stdout and stderr, in a new session whose
controlling terminal is that pty. So when the pty closes for any reason (the helper is
stopped, killed or crashes) the kernel hangs the program up, and nothing outlives it.
A resize sets the pty's size and signals SIGWINCH. Reads and writes never block the
event loop.
"""

import asyncio
import fcntl
import os
import signal
import struct
import subprocess
import sys
import termios
from typing import Mapping, Optional, Sequence, Tuple

from .session import EXIT_CHECK, MAX_PENDING, READ_CHUNK, STOP_GRACE

# Runs in the new session (isolated: imports only the standard library, never from the
# current folder): make stdin, the pty, the controlling terminal, then become the program.
_BOOT = ("import fcntl, os, sys, termios\n"
         "try:\n"
         "    fcntl.ioctl(0, termios.TIOCSCTTY, 0)\n"
         "except (AttributeError, OSError):\n"
         "    pass\n"
         "try:\n"
         "    os.execvp(sys.argv[1], sys.argv[1:])\n"
         "except OSError as error:\n"
         "    print('The terminal app couldn\\'t start:', error.strerror, file=sys.stderr)\n"
         "    sys.exit(127)\n")


class PtySession:
    """A running program on a pty: read its output, write keystrokes, resize, close."""

    def __init__(self, process: subprocess.Popen, fd: int) -> None:
        self.process = process
        self._fd = fd
        self._pending = b""
        self._writing = False
        self._closed = False

    @classmethod
    def spawn(cls, command: Sequence[str], env: Mapping[str, str], size: Tuple[int, int],
              cwd: Optional[str] = None) -> "PtySession":
        """Start `command` on a new pty of `size` (cols, rows)."""
        master, slave = os.openpty()
        try:
            _set_size(master, *size)
            process = subprocess.Popen(
                [sys.executable, "-I", "-c", _BOOT, *command], stdin=slave, stdout=slave,
                stderr=slave, env=dict(env), cwd=cwd, start_new_session=True, close_fds=True)
        except BaseException:
            os.close(master)
            raise
        finally:
            os.close(slave)
        os.set_blocking(master, False)
        return cls(process, master)

    @property
    def pid(self) -> int:
        return self.process.pid

    # --- output ----------------------------------------------------------------------------
    async def read(self) -> bytes:
        """The program's next output; b"" once it has ended."""
        loop = asyncio.get_running_loop()
        while not self._closed:
            try:
                return os.read(self._fd, READ_CHUNK)      # b"" at end of file (macOS)
            except BlockingIOError:
                pass
            except OSError:                                # EIO: no slave end left (Linux)
                return b""
            ready = loop.create_future()
            loop.add_reader(self._fd, _wake, ready)
            try:
                await asyncio.wait_for(ready, EXIT_CHECK)
            except asyncio.TimeoutError:
                # Quiet: if the program ended (something it started may still hold the
                # pty open, so no EIO would come), that's the end.
                if self.process.poll() is not None:
                    return b""
            finally:
                loop.remove_reader(self._fd)
        return b""

    # --- input -----------------------------------------------------------------------------
    def write(self, data: bytes) -> None:
        """Queue keystrokes for the program (beyond MAX_PENDING unwritten bytes: dropped)."""
        if self._closed:
            return
        self._pending = (self._pending + data)[:MAX_PENDING]
        self._flush()

    def _flush(self) -> None:
        while self._pending and not self._closed:
            try:
                written = os.write(self._fd, self._pending)
            except BlockingIOError:
                break
            except OSError:
                self._pending = b""
                break
            self._pending = self._pending[written:]
        loop = asyncio.get_running_loop()
        if self._pending and not self._writing and not self._closed:
            loop.add_writer(self._fd, self._flush)
            self._writing = True
        elif self._writing and (not self._pending or self._closed):
            loop.remove_writer(self._fd)
            self._writing = False

    def resize(self, cols: int, rows: int) -> None:
        if self._closed:
            return
        _set_size(self._fd, cols, rows)
        self._signal(signal.SIGWINCH)

    # --- stop ------------------------------------------------------------------------------
    async def close(self) -> Optional[int]:
        """Stop the program (SIGHUP, then SIGKILL after STOP_GRACE) and free the pty.

        Returns its exit code. Cancel any pending read() first. Cancelling close() itself
        still kills the program and frees the pty.
        """
        if self._closed:
            return self.process.returncode
        self._closed = True
        if self._writing:
            asyncio.get_running_loop().remove_writer(self._fd)
            self._writing = False
        try:
            for sig, wait in ((signal.SIGHUP, STOP_GRACE), (signal.SIGKILL, 1.0)):
                self._signal(sig)
                waited = 0.0
                while self.process.poll() is None and waited < wait:
                    await asyncio.sleep(0.05)
                    waited += 0.05
                if self.process.returncode is not None:
                    break
        finally:
            if self.process.poll() is None:          # cancelled while waiting
                self._signal(signal.SIGKILL)
                try:
                    self.process.wait(timeout=1.0)
                except subprocess.TimeoutExpired:
                    pass
            os.close(self._fd)
        return self.process.returncode

    def _signal(self, sig: int) -> None:
        if self.process.poll() is not None:      # reaped: its pid may belong to someone else
            return
        try:
            os.killpg(self.process.pid, sig)     # its own session: pgid == pid
        except (ProcessLookupError, PermissionError):
            pass


def _wake(future: "asyncio.Future[None]") -> None:
    if not future.done():
        future.set_result(None)


def _set_size(fd: int, cols: int, rows: int) -> None:
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
