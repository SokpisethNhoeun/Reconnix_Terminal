"""The scope guard for agent mode: every tool call the model makes is checked here first.

The harness `Agent` runs in a worker thread and calls `guard(name, args)` before it runs any
tool. The decision uses a **copy** of the approved scope taken when the run began
(`ScopeSnapshot`), never the live store lists, so it is safe off the app thread and a later
edit or a switched assessment can't widen it. The store lists are written only from the
`policy` event, on the app thread (`agent_run.record_event`).

Rules (fail closed): nothing runs unless the scope is APPROVED and the time limit has not
passed. `run_scan` needs every tool in the scope's tool set and a target inside the scope's
host/port rules. `http_poc` / `login` follow the scope's method, excluded-path, host and
port rules. Authorizing or adding an authorized target outside the scope is refused. The
per-action MEDIUM/HIGH approval gates are NOT applied to the agent.
"""

import copy
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Optional, Tuple
from urllib.parse import urlsplit

from ..models import ScopeManifest
from ..models.base import utc_now
from .policy import TargetError, canonical_path, host_port_reason, is_under

Guard = Callable[[str, Dict[str, Any]], str]
# ref -> (value, type) of a harness target, or None; (args, target type) -> effective tools
Lookup = Callable[[str], Optional[Tuple[str, str]]]
ToolsFor = Callable[[Dict[str, Any], str], list]

_READ_ONLY = {"update_plan", "list_capabilities", "list_targets", "list_findings",
              "get_finding", "ask_operator"}
_DEFAULT_PORTS = {"http": 80, "https": 443}


@dataclass
class ScopeSnapshot:
    """The approved scope and start time, copied when the run began."""
    scope: ScopeManifest
    started_at: Optional[datetime]


_snapshots: Dict[str, ScopeSnapshot] = {}      # assessment uid -> snapshot
_lock = threading.Lock()


def install(uid: str, scope: Optional[ScopeManifest], started_at: Optional[datetime]) -> None:
    """Take (a copy of) the scope for this assessment; `None` removes it."""
    with _lock:
        if scope is None:
            _snapshots.pop(uid, None)
        else:
            _snapshots[uid] = ScopeSnapshot(copy.deepcopy(scope), started_at)


def snapshot(uid: str) -> Optional[ScopeSnapshot]:
    with _lock:
        return _snapshots.get(uid)


def clear() -> None:
    with _lock:
        _snapshots.clear()


def make_guard(uid: str, lookup: Lookup, tools_for: ToolsFor) -> Guard:
    """The guard for one assessment: "" lets the call run, anything else is the reason."""
    def guard(name: str, args: Dict[str, Any]) -> str:
        return decide(snapshot(uid), name, args, lookup, tools_for)
    return guard


# --- the decision (pure: no store lists, no I/O) -------------------------------------------

def decide(snap: Optional[ScopeSnapshot], name: str, args: Dict[str, Any],
           lookup: Lookup, tools_for: ToolsFor, now: Optional[datetime] = None) -> str:
    """"" when the tool call may run, else the reason it is refused."""
    if snap is None or snap.scope.status != "APPROVED":
        return "Scope not approved"
    scope = snap.scope
    if snap.started_at is not None and \
            (now or utc_now()) - snap.started_at > timedelta(minutes=scope.time_limit_minutes):
        return "Time limit reached"
    if name in _READ_ONLY:
        return ""
    if name == "run_scan":
        return _scan_reason(scope, args, lookup, tools_for)
    if name in ("http_poc", "login"):
        method = str(args.get("method", "GET")).upper() if name == "http_poc" else "POST"
        return _request_reason(scope, method, str(args.get("url", "")).strip())
    if name == "request_credentials":
        login_url = str(args.get("login_url") or "").strip()
        return _request_reason(scope, "POST", login_url) if login_url else ""
    if name == "add_target":
        value = str(args.get("value", "")).strip()
        return _target_reason(scope, value) if args.get("authorized") else ""
    if name == "authorize_target":
        found = lookup(str(args.get("target", "")))
        return _target_reason(scope, found[0]) if found else "Unknown target"
    return f"Tool {name} is not allowed in agent mode"


def _scan_reason(scope: ScopeManifest, args: Dict[str, Any], lookup: Lookup,
                 tools_for: ToolsFor) -> str:
    found = lookup(str(args.get("target", "")))
    if found is None:
        return "Unknown target"
    value, kind = found
    allowed = {t.casefold() for t in scope.tools}
    for tool in tools_for(args, kind):
        if str(tool).casefold() not in allowed:
            return f"Tool {tool} is not in the approved scope"
    return _target_reason(scope, value)


def _target_reason(scope: ScopeManifest, value: str) -> str:
    """Whether a target (URL, host or host:port) lies inside the scope; no method rule."""
    if scope.kind == "network":
        return _network_reason(scope, value)
    if scope.kind in ("web_url", "api"):
        base = urlsplit(scope.target_url)
        url = value if "://" in value else f"{base.scheme}://{value}"
        return _web_reason(scope, None, url)
    return "Source-code scopes have no network tools for the agent"


def _request_reason(scope: ScopeManifest, method: str, url: str) -> str:
    """Whether an HTTP request (absolute URL) is allowed by the scope."""
    if "://" not in url:
        return "Malformed request target"
    if scope.kind == "network":
        return _network_reason(scope, url)
    if scope.kind in ("web_url", "api"):
        return _web_reason(scope, method, url)
    return "Source-code scopes have no network tools for the agent"


def _web_reason(scope: ScopeManifest, method: Optional[str], url: str) -> str:
    """The web_url/api rules of `scope._decide`: method, canonical path, excluded paths."""
    if method is not None and method not in scope.allowed_methods:
        return f"Method {method} not allowed"
    try:
        path = canonical_path(url, scope.target_url)
    except TargetError as exc:
        return str(exc)
    if any(is_under(path, excluded) for excluded in scope.excluded_paths):
        return "Path outside approved scope"
    return ""


def _network_reason(scope: ScopeManifest, value: str) -> str:
    """Host-and-port rules; a URL's default port is made explicit so the port list applies."""
    text = value.strip()
    if "://" in text:
        try:
            parts = urlsplit(text)
            port = parts.port or _DEFAULT_PORTS.get(parts.scheme.lower())
        except ValueError:
            return "Malformed request target"
        if not parts.hostname or parts.username or parts.password:
            return "Malformed request target"
        text = f"{parts.hostname}:{port}" if port else parts.hostname
    return host_port_reason(text, scope.target_url, scope.allowed_ports, scope.excluded_paths)
