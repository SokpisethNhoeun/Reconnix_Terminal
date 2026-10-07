"""Settings for the browser terminal, read from the environment serve.mjs sets.

| Variable | Default | Meaning |
|---|---|---|
| `RECONIX_WEB_TOKEN` | (required) | the dashboard's launch token: tickets are signed with it |
| `RECONIX_TERM_PORT` | `3101` | this server's port on 127.0.0.1 |
| `RECONIX_WEB_PORT` | `3100` | the dashboard's port: the only page allowed to connect |
| `RECONIX_TERM_WATCH_STDIN` | off | `1`: stop when stdin closes (the launcher died) |
| `RECONIX_TERM_TEST` | off | `1`: allow RECONIX_TERM_COMMAND (tests only) |
| `RECONIX_TERM_COMMAND` | `python -m reconix` | with RECONIX_TERM_TEST=1: a stand-in TUI |
"""

import importlib.util
import os
import shlex
import sys
from dataclasses import dataclass
from typing import Mapping, Tuple

DEFAULT_PORT = 3101
DEFAULT_WEB_PORT = 3100
MAX_SESSIONS = 2                 # browser terminals open at once
IDLE_SECONDS = 30 * 60           # no keystroke for this long closes a session
MIN_TOKEN = 16                   # same rule as the dashboard (web/src/lib/auth/session.ts)


class SettingsError(ValueError):
    """The environment can't start the server; the message says why."""


def problem() -> str:
    """Why the browser terminal can't run here ("" when it can)."""
    if sys.platform == "win32":
        if importlib.util.find_spec("winpty") is None:
            return ("The browser terminal on Windows needs the pywinpty package: "
                    "pip install -r requirements.txt")
    else:
        try:
            import fcntl  # noqa: F401
            import termios  # noqa: F401
        except ImportError:
            return "The browser terminal needs Linux, macOS or Windows."
        if not hasattr(os, "openpty") or not hasattr(os, "killpg"):
            return "The browser terminal needs Linux, macOS or Windows."
    try:
        import websockets.asyncio.server  # noqa: F401
    except ImportError:
        return ("The browser terminal needs the websockets package (13 or newer): "
                "pip install -r requirements.txt")
    return ""


@dataclass(frozen=True)
class Settings:
    token: str
    port: int = DEFAULT_PORT
    web_port: int = DEFAULT_WEB_PORT
    command: Tuple[str, ...] = (sys.executable, "-m", "reconix")
    max_sessions: int = MAX_SESSIONS
    idle_seconds: float = IDLE_SECONDS
    watch_stdin: bool = False
    stand_in: bool = False       # `command` is a test stand-in, not the TUI

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> "Settings":
        token = (env.get("RECONIX_WEB_TOKEN") or "").strip()
        if len(token) < MIN_TOKEN:
            raise SettingsError("Start it with the dashboard (npm run dev / npm start): "
                                "it needs the dashboard's launch token.")
        # A stand-in only with the explicit test flag: a leftover RECONIX_TERM_COMMAND alone
        # must never swap the TUI (and its gates) for something else.
        testing = env.get("RECONIX_TERM_TEST") == "1"
        try:
            command = tuple(shlex.split(env.get("RECONIX_TERM_COMMAND") or "")) if testing else ()
        except ValueError as error:
            raise SettingsError(f"RECONIX_TERM_COMMAND can't be read: {error}.") from None
        return cls(
            token=token,
            port=_port(env, "RECONIX_TERM_PORT", DEFAULT_PORT),
            web_port=_port(env, "RECONIX_WEB_PORT", DEFAULT_WEB_PORT),
            command=command or cls.command,
            watch_stdin=env.get("RECONIX_TERM_WATCH_STDIN") == "1",
            stand_in=bool(command),
        )

    @property
    def hosts(self) -> Tuple[str, ...]:
        """Host headers this server answers to (anything else: DNS rebinding)."""
        return f"127.0.0.1:{self.port}", f"localhost:{self.port}"

    @property
    def origins(self) -> Tuple[str, ...]:
        """The dashboard's own origins: no other web page may open a terminal."""
        return f"http://127.0.0.1:{self.web_port}", f"http://localhost:{self.web_port}"


def _port(env: Mapping[str, str], name: str, default: int) -> int:
    text = (env.get(name) or "").strip()
    if not text:
        return default
    if not text.isdigit() or not 0 < int(text) < 65536:
        raise SettingsError(f"{name} must be a port number (1-65535), not {text!r}.")
    return int(text)
