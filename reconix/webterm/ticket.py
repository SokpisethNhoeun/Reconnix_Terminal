"""Single-use tickets: the dashboard's permission to open one terminal session.

The dashboard mints them (web/src/lib/auth/ticket.ts) for signed-in operators only:

    <expires>.<nonce>.<base64url(HMAC-SHA256(launch token, "reconix-term:<expires>:<nonce>"))>

`expires` is in Unix seconds, 60 s after minting. This side checks the signature with the
same launch token (so a dashboard restart voids every ticket), the expiry, and that the
nonce hasn't been used before.

The helper then proves it is the real one (not something else listening on its port) by
sending `hello_proof(token, nonce)` first; the dashboard gave the page the same value with
the ticket. Change both files together; their tests share vectors.
"""

import base64
import hashlib
import hmac
import re
import time
from typing import Dict, Optional

TTL_SECONDS = 60
_SHAPE = re.compile(r"(\d{1,12})\.([A-Za-z0-9_-]{16,64})\.([A-Za-z0-9_-]{43})")


def _mac(token: str, text: str) -> str:
    """base64url HMAC-SHA256, no padding (what Node's digest("base64url") gives)."""
    mac = hmac.new(token.encode(), text.encode(), hashlib.sha256)
    return base64.urlsafe_b64encode(mac.digest()).rstrip(b"=").decode()


def sign(token: str, expires: int, nonce: str) -> str:
    """The ticket's signature."""
    return _mac(token, f"reconix-term:{expires}:{nonce}")


def hello_proof(token: str, nonce: str) -> str:
    """What the helper sends first on a session opened with the ticket that has `nonce`."""
    return _mac(token, f"reconix-term-hello:{nonce}")


def make(token: str, now: float, nonce: str) -> str:
    """A ticket as the dashboard mints it (for tests; the dashboard makes the real ones)."""
    expires = int(now) + TTL_SECONDS
    return f"{expires}.{nonce}.{sign(token, expires, nonce)}"


class TicketBook:
    """Redeems tickets, remembering used nonces until their tickets expire."""

    def __init__(self, token: str) -> None:
        self._token = token
        self._used: Dict[str, int] = {}          # nonce -> expires

    @property
    def remembered(self) -> int:
        """How many used nonces are kept (only until their tickets expire)."""
        return len(self._used)

    def redeem(self, ticket: Optional[str], now: Optional[float] = None) -> Optional[str]:
        """The nonce (once) of a valid, unexpired ticket signed with this server's token;
        None for anything else."""
        moment = int(time.time() if now is None else now)
        self._used = {n: e for n, e in self._used.items() if e >= moment}
        match = _SHAPE.fullmatch(ticket or "")
        if not match:
            return None
        expires, nonce, signature = int(match[1]), match[2], match[3]
        if not moment <= expires <= moment + TTL_SECONDS:
            return None
        if not hmac.compare_digest(signature, sign(self._token, expires, nonce)):
            return None
        if nonce in self._used:
            return None
        self._used[nonce] = expires
        return nonce
