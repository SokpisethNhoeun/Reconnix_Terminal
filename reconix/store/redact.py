"""Masking secrets that ride along in free text (typed requests, tool output, URLs).

The vault keeps real credentials out of the data model, but an operator can still type
`https://user:pass@host`, paste a cookie into the prompt, or import tool output whose
evidence holds a token. `redact()` masks the common shapes of those before text is saved
or imported; `clean()` drops characters that can't be encoded (lone surrogates from a
crafted JSON file), so a bad import can never crash a save or a redraw.
"""

import re
from typing import Any

MASK = "••••"

_PATTERNS = (
    # https://user:password@host → https://••••@host
    (re.compile(r"(?i)\b([a-z][a-z0-9+.-]*://)[^/\s@:]+:[^/\s@]*@"), rf"\g<1>{MASK}@"),
    # Cookie: …, Authorization: …, password=…, api_key: "…" → keep the name, mask the value
    (re.compile(
        r"(?i)\b((?:set-)?cookie|(?:proxy-)?authorization|password|passwd|pwd|secret|"
        r"client[_-]?secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key|"
        r"access[_-]?key|session[_-]?id|sessionid)\b(\s*[:=]\s*)(\"[^\"]*\"|'[^']*'|[^\s,;&]+)"),
     rf"\g<1>\g<2>{MASK}"),
    (re.compile(r"(?i)\bbearer\s+[a-z0-9._~+/=-]{8,}"), f"Bearer {MASK}"),
    (re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}"), f"{MASK} (JWT)"),
    (re.compile(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b"), rf"\g<1>{MASK}"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)"),
     f"{MASK} (private key)"),
)


def clean(text: str) -> str:
    """`text` without characters that can't be encoded as UTF-8 (lone surrogates)."""
    return text.encode("utf-8", "replace").decode("utf-8")


def redact(text: str) -> str:
    """`text` with credentials, tokens and keys masked."""
    text = clean(text)
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def redact_all(value: Any) -> Any:
    """`redact()` every string inside nested dicts, lists and tuples."""
    if isinstance(value, str):
        return redact(value)
    if isinstance(value, dict):
        return {key: redact_all(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [redact_all(item) for item in value]
    return value
