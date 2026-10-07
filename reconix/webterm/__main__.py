"""`python -m reconix.webterm`: the browser terminal server (web/scripts/serve.mjs starts it).

Exit codes: 0 stopped normally, 1 couldn't listen, 2 bad settings, 3 not supported here.
"""

import asyncio
import logging
import sys

from .settings import Settings, SettingsError, problem


def main() -> int:
    why = problem()
    if why:
        return _fail(why, 3)
    try:
        settings = Settings.from_env()
    except SettingsError as error:
        return _fail(str(error), 2)
    logging.basicConfig(level=logging.INFO, format="[terminal] %(message)s", stream=sys.stdout)

    from .server import run      # needs websockets, which problem() has checked

    try:
        asyncio.run(run(settings))
    except OSError as error:
        return _fail(f"can't listen on 127.0.0.1:{settings.port} "
                     f"({error.strerror or error}).", 1)
    except KeyboardInterrupt:
        pass
    return 0


def _fail(message: str, code: int) -> int:
    print(f"[terminal] The Terminal page is unavailable: {message}", file=sys.stderr, flush=True)
    return code


if __name__ == "__main__":
    sys.exit(main())
