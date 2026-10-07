"""Who may open a terminal socket, checked before the WebSocket handshake completes.

- **Host** must be this server's loopback address, so a DNS-rebinding page can't reach it.
- **Origin** must be the dashboard. Browsers always send it on WebSocket handshakes and
  pages can't fake it, so no other web site open in the browser can start a session.
- **Ticket** (in `?ticket=`) must be valid and unused: see `ticket.py`.
"""

from typing import Optional, Tuple
from urllib.parse import parse_qs, urlsplit

from .settings import Settings
from .ticket import TicketBook


def check(settings: Settings, tickets: TicketBook, host: Optional[str], origin: Optional[str],
          path: str) -> Tuple[str, Optional[str]]:
    """(why the handshake is refused, "" when it may go ahead; the ticket's nonce or None).

    The ticket is used up only when everything else is right.
    """
    if host not in settings.hosts:
        return "This terminal only answers on 127.0.0.1.", None
    if origin not in settings.origins:
        return "Only the Reconix dashboard may open a terminal.", None
    parts = urlsplit(path)
    if parts.path != "/":
        return "Not found.", None
    nonce = tickets.redeem(parse_qs(parts.query).get("ticket", [""])[0])
    if not nonce:
        return "This terminal ticket is not valid any more. Open a new session.", None
    return "", nonce
