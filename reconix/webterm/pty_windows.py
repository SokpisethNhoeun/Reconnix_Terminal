"""The browser terminal on Windows: the program in its own pseudo console (ConPTY).

pywinpty's `PtyProcess` runs the program attached to a new pseudo console. Its reads and
writes block, so a reader thread feeds an asyncio queue and a writer thread sends the
keystrokes; the event loop never waits on the console. Output and input are text there:
keystrokes are decoded as UTF-8 (a character split across frames is kept until its other
half comes), output is encoded back to UTF-8 for the page.

Closing the session terminates the program and frees the console. If the helper itself
dies, Windows closes its consoles and ends the programs attached to them.
"""

import asyncio
import codecs
import queue
import threading
from typing import Any, Mapping, Optional, Sequence, Tuple

from .session import EXIT_CHECK, MAX_PENDING, READ_CHUNK

REDRAW_STEP = 0.05     # seconds between the two halves of a same-size resize (see resize)
_END = b""             # in the output queue: the program's output has ended


class ConPtySession:
    """A running program in a pseudo console: read its output, write keystrokes, resize,
    close. `process` is a `winpty.PtyProcess` (or a stand-in with the same methods)."""

    def __init__(self, process: Any, size: Tuple[int, int],
                 loop: asyncio.AbstractEventLoop) -> None:
        self.process = process
        self._size = size                    # (cols, rows)
        self._loop = loop
        self._output: "asyncio.Queue[bytes]" = asyncio.Queue()
        self._ended = False
        self._closed = False
        self._decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        self._keys: "queue.Queue[Optional[str]]" = queue.Queue()
        self._pending = 0                    # characters queued, not written yet
        self._lock = threading.Lock()
        threading.Thread(target=self._read_loop, name="webterm-read", daemon=True).start()
        threading.Thread(target=self._write_loop, name="webterm-write", daemon=True).start()

    @classmethod
    def spawn(cls, command: Sequence[str], env: Mapping[str, str], size: Tuple[int, int],
              cwd: Optional[str] = None) -> "ConPtySession":
        """Start `command` in a new pseudo console of `size` (cols, rows)."""
        from winpty import PtyProcess        # pywinpty: only on Windows (settings.problem)

        cols, rows = size
        try:
            process = PtyProcess.spawn(list(command), cwd=cwd, env=dict(env),
                                       dimensions=(rows, cols))
        except OSError:
            raise
        except Exception as error:           # pywinpty's own errors: the page says it failed
            raise OSError(str(error) or type(error).__name__) from error
        return cls(process, size, asyncio.get_running_loop())

    @property
    def pid(self) -> int:
        return self.process.pid

    # --- output ----------------------------------------------------------------------------
    def _read_loop(self) -> None:
        try:
            while True:
                text = self.process.read(READ_CHUNK)       # blocks; EOFError at the end
                if text:
                    self._deliver(text.encode("utf-8"))
        except Exception:                                  # EOFError, or the console closed
            pass
        finally:
            self._deliver(_END)

    def _deliver(self, data: bytes) -> None:
        try:
            self._loop.call_soon_threadsafe(self._output.put_nowait, data)
        except RuntimeError:                               # the event loop is gone
            pass

    async def read(self) -> bytes:
        """The program's next output; b"" once it has ended."""
        while not self._ended and not self._closed:
            try:
                data = await asyncio.wait_for(self._output.get(), EXIT_CHECK)
            except asyncio.TimeoutError:
                # Quiet: if the program ended (something it started may keep the console
                # open, so its output wouldn't end), that's the end.
                if not self._alive():
                    self._ended = True
                continue
            if data:
                return data
            self._ended = True
        return b""

    # --- input -----------------------------------------------------------------------------
    def write(self, data: bytes) -> None:
        """Queue keystrokes for the program (beyond MAX_PENDING unwritten: dropped)."""
        if self._closed:
            return
        text = self._decoder.decode(data)
        with self._lock:
            text = text[:max(0, MAX_PENDING - self._pending)]
            self._pending += len(text)
        if text:
            self._keys.put(text)

    def _write_loop(self) -> None:
        while True:
            text = self._keys.get()
            if text is None:
                return
            try:
                self.process.write(text)
            except Exception:                              # the console is gone
                pass
            with self._lock:
                self._pending -= len(text)

    def resize(self, cols: int, rows: int) -> None:
        if self._closed:
            return
        if (cols, rows) == self._size and rows > 1:
            # ConPTY ignores a resize to the same size, but the page sends one to have the
            # program repaint (Clear): step one row down and back.
            self._set_size(cols, rows - 1)
            self._loop.call_later(REDRAW_STEP, self._set_size, cols, rows)
            return
        self._set_size(cols, rows)

    def _set_size(self, cols: int, rows: int) -> None:
        if self._closed:
            return
        try:
            self.process.setwinsize(rows, cols)
        except Exception:
            return
        self._size = (cols, rows)

    # --- stop ------------------------------------------------------------------------------
    async def close(self) -> Optional[int]:
        """Terminate the program and free the console. Returns its exit code."""
        if self._closed:
            return self._exit_code()
        self._closed = True
        self._keys.put(None)
        await asyncio.get_running_loop().run_in_executor(None, self._stop)
        return self._exit_code()

    def _stop(self) -> None:
        for step in (lambda: self.process.terminate(force=True),
                     lambda: self.process.close(force=True)):
            try:
                step()
            except Exception:
                pass

    def _alive(self) -> bool:
        try:
            return bool(self.process.isalive())
        except Exception:
            return False

    def _exit_code(self) -> Optional[int]:
        try:
            code = self.process.exitstatus
        except Exception:
            return None
        return code if isinstance(code, int) else None
