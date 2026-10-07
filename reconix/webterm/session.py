"""One browser terminal: a program (the Reconix TUI) in its own pseudo-terminal.

`spawn()` starts it on this platform's terminal: a Unix pty (`pty_posix`, Linux and
macOS) or a Windows pseudo console (`pty_windows`, ConPTY through pywinpty). Both give the
server the same `Session`: read the program's output, write keystrokes, resize, close.
When the helper stops, so do its programs.
"""

import os
import sys
from pathlib import Path
from typing import Dict, Mapping, Optional, Protocol, Sequence, Tuple

READ_CHUNK = 64 * 1024
MAX_PENDING = 1024 * 1024        # unwritten input kept while the program is busy
EXIT_CHECK = 0.5                 # seconds: how often a quiet read checks the program ended
STOP_GRACE = 2.0                 # seconds between asking the program to stop and killing it
_DROPPED = ("RECONIX_WEB_TOKEN", "COLUMNS", "LINES")


class Session(Protocol):
    """A running program in a terminal (see `pty_posix.PtySession`)."""

    @property
    def pid(self) -> int: ...

    async def read(self) -> bytes:
        """The program's next output; b"" once it has ended."""

    def write(self, data: bytes) -> None:
        """Queue keystrokes (beyond MAX_PENDING unwritten bytes: dropped)."""

    def resize(self, cols: int, rows: int) -> None:
        """Set the terminal's size; the program repaints (also for the same size)."""

    async def close(self) -> Optional[int]:
        """Stop the program and free the terminal; its exit code."""


def spawn(command: Sequence[str], env: Mapping[str, str], size: Tuple[int, int],
          cwd: Optional[str] = None) -> Session:
    """Start `command` in a new terminal of `size` (cols, rows). OSError if it can't."""
    if sys.platform == "win32":
        from .pty_windows import ConPtySession
        return ConPtySession.spawn(command, env, size, cwd)
    from .pty_posix import PtySession
    return PtySession.spawn(command, env, size, cwd)


def child_env(base: Mapping[str, str]) -> Dict[str, str]:
    """The program's environment: no launch token, a capable terminal, reconix importable.

    RECONIX_IN_WEB tells the TUI it runs on the Terminal page (/web then says so).
    PYTHONSAFEPATH keeps the current folder off the import path (Python 3.11+).
    """
    env = {key: value for key, value in base.items()
           if key not in _DROPPED and not key.startswith("RECONIX_TERM_")}
    root = str(Path(__file__).resolve().parents[2])      # the folder holding `reconix`
    env["PYTHONPATH"] = os.pathsep.join(p for p in (root, base.get("PYTHONPATH", "")) if p)
    env.update(TERM="xterm-256color", COLORTERM="truecolor", RECONIX_IN_WEB="1",
               PYTHONSAFEPATH="1")
    return env
