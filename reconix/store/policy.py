"""Request-target normalization for the policy check.

A target is accepted only when it can be reduced to one canonical path on the
approved host. Anything ambiguous (encoded separators, double encoding, `//`,
whitespace, another host or port) is refused rather than guessed at.
"""

import ipaddress
import posixpath
from typing import Optional
from urllib.parse import unquote, urlsplit

DEFAULT_PORTS = {"http": 80, "https": 443}


class TargetError(ValueError):
    """The request target is outside the scope or can't be read safely."""


def _port(scheme: str, port: Optional[int]) -> Optional[int]:
    return port if port is not None else DEFAULT_PORTS.get(scheme)


def canonical_path(target: str, base_url: str) -> str:
    """The lower-cased, normalized path `target` would hit on `base_url`'s host.

    Raises TargetError for another host, scheme or port, and for any target that
    could be read in more than one way.
    """
    if not target or any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in target):
        raise TargetError("Malformed request target")
    try:
        parts = urlsplit(target)
        base = urlsplit(base_url)
        port, base_port = parts.port, base.port
    except ValueError:
        raise TargetError("Malformed request target") from None
    if parts.scheme or parts.netloc:
        same_host = (parts.scheme.lower() == base.scheme.lower()
                     and (parts.hostname or "") == (base.hostname or "")
                     and _port(parts.scheme.lower(), port) == _port(base.scheme.lower(), base_port))
        if not same_host or parts.username or parts.password:
            raise TargetError("Host outside approved scope")
    path = parts.path or ("/" if parts.netloc else "")
    if not path.startswith("/") or path.startswith("//"):
        raise TargetError("Malformed request target")
    path = "/".join(seg.split(";", 1)[0] for seg in path.split("/"))   # drop matrix params
    lowered = path.lower()
    if "%2f" in lowered or "%5c" in lowered:
        raise TargetError("Encoded path separators are not allowed")
    decoded = unquote(path)
    if "%" in decoded or "\\" in decoded:
        raise TargetError("Malformed request target")
    if any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in decoded):
        raise TargetError("Malformed request target")   # encoded control char
    normalized = posixpath.normpath(decoded)
    if normalized.startswith("//"):
        raise TargetError("Malformed request target")
    return normalized.casefold()


def is_under(path: str, prefix: str) -> bool:
    """True when the canonical `path` is `prefix` or below it."""
    root = posixpath.normpath(prefix).casefold().rstrip("/") or "/"
    return root == "/" or path == root or path.startswith(root + "/")


# --- network and source targets (scope kinds other than HTTP) ----------------------------
def host_port_reason(target: str, scope_target: str, allowed_ports: list, excluded: list) -> str:
    """"" when a network target (host or host:port) is in scope, else why it is blocked."""
    item = target.strip()
    if any(item == e.strip() or item.startswith(e.strip() + ":") for e in excluded):
        return "Host or port outside approved scope"
    host, _, port_text = item.partition(":")
    if not _host_in_scope(host, scope_target):
        return "Host outside approved scope"
    if port_text:
        try:
            port = int(port_text)
        except ValueError:
            return "Malformed target"
        if allowed_ports and port not in allowed_ports:
            return f"Port {port} not in the approved list"
    return ""


def _host_in_scope(host: str, scope_target: str) -> bool:
    host = host.strip()
    base = scope_target.strip()
    if not host:
        return False
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return host.casefold() == base.casefold()   # a hostname: exact match
    try:
        if "/" in base:
            return address in ipaddress.ip_network(base, strict=False)
        return address == ipaddress.ip_address(base)
    except ValueError:
        return False


def repo_path_reason(target: str, excluded: list) -> str:
    """"" when a repo-relative path is in scope, else why it is blocked."""
    try:
        path = canonical_path("/" + target.lstrip("/"), "file://repo")
    except TargetError as exc:
        return str(exc)
    if any(is_under(path, "/" + e.strip().lstrip("/")) for e in excluded):
        return "Path excluded from the review"
    return ""
