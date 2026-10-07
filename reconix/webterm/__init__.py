"""The browser terminal: the Reconix TUI on the web dashboard's Terminal page.

`python -m reconix.webterm` is a small WebSocket server on 127.0.0.1 that the dashboard's
launcher (web/scripts/serve.mjs) starts next to Next.js. Each connection from the Terminal
page brings a single-use ticket and gets its own `python -m reconix` in a pseudo-terminal,
so the browser runs the very same screens, commands and store gates as the terminal app.

Only `settings` is imported here, so `problem()` works without the optional packages.
See docs/WEB_TERMINAL_PLAN.md.
"""

from .settings import Settings, SettingsError, problem

__all__ = ["Settings", "SettingsError", "problem"]
