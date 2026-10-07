"""What travels on a terminal socket. Mirrored in web/src/lib/terminal/protocol.ts.

- **Binary frames** are terminal bytes: keystrokes in, the TUI's output out.
- **Text frames** are JSON control messages. The helper's first frame is
  `{"type": "hello", "proof": "…"}` (see `ticket.hello_proof`): the page sends nothing until
  it matches. The browser sends `{"type": "resize", "cols": 120, "rows": 40}`; anything
  else, or anything longer than MAX_CONTROL, is ignored.
- **Close codes** tell the page why a session ended (the reason text is shown as is).
"""

import json
from typing import Optional, Tuple

CLOSE_ENDED = 4000      # the TUI exited
CLOSE_IDLE = 4408       # no keystroke for IDLE_SECONDS
CLOSE_BUSY = 4429       # MAX_SESSIONS already open

MAX_MESSAGE = 64 * 1024                 # bytes per frame from the browser (a large paste)
MAX_CONTROL = 256                       # characters in a control (text) frame
COLS = (10, 500)
ROWS = (5, 200)


def hello_message(proof: str) -> str:
    return json.dumps({"type": "hello", "proof": proof})


def parse_resize(text: str) -> Optional[Tuple[int, int]]:
    """(cols, rows) from a valid resize message, else None."""
    if len(text) > MAX_CONTROL:          # also keeps deep nesting away from json (RecursionError)
        return None
    try:
        message = json.loads(text)
    except (ValueError, RecursionError):
        return None
    if not isinstance(message, dict) or message.get("type") != "resize":
        return None
    cols, rows = message.get("cols"), message.get("rows")
    if not _whole(cols, COLS) or not _whole(rows, ROWS):
        return None
    return cols, rows


def _whole(value: object, bounds: Tuple[int, int]) -> bool:
    return (isinstance(value, int) and not isinstance(value, bool)
            and bounds[0] <= value <= bounds[1])
