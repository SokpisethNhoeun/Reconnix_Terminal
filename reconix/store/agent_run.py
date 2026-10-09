"""Bridge: drive the backend pentest harness agent from Reconix.

The harness `Agent` performs the real assessment — plan, scan via the Kali MCP server,
analyze findings. Its LLM is always Reconix's active ``/provider`` model, set before each
turn, so the operator can switch model mid-assessment and the `Agent` keeps its whole
conversation history (context preserved). This is the only module that imports `harness`.

One `Agent` is cached per Reconix assessment. The agent runs async; the shell drives it in
a worker and renders the streamed events into the chat/activity log.
"""

import json
from typing import Any, Awaitable, Callable, Dict, Optional

from ..models import PlanTask
from ..models.base import utc_now
from . import lists, providers
from .assessment import get_assessment
from .errors import StoreValidationError
from .snapshot import uid_for
from .transcript import add_activity, add_chat

OnEvent = Callable[[Dict[str, Any]], Awaitable[None]]
OnAsk = Callable[[Dict[str, Any]], Awaitable[Optional[Dict[str, Any]]]]

_agents: Dict[str, Any] = {}   # assessment uid -> harness Agent


def harness_installed() -> bool:
    try:
        import harness  # noqa: F401
        return True
    except Exception:
        return False


def available() -> bool:
    """True when the harness is importable and a model is active to drive it."""
    return harness_installed() and providers.active_model() is not None


def looks_like_target(text: str) -> bool:
    """Whether a line names a scan target (URL/host/IP/repo/path) vs plain conversation."""
    from .parser import parse_request
    return parse_request((text or "").strip()) is not None


def _llm_settings():
    """A harness `LLMSettings` built from Reconix's active provider, or None."""
    params = providers.active_llm_settings()
    if params is None:
        return None
    from harness.config import LLMSettings
    return LLMSettings(base_url=params["base_url"], api_key=params["api_key"],
                       model=params["model"], timeout=float(params["timeout"]))


def _agent():
    """The cached harness `Agent` for the current assessment (created on first use)."""
    from harness.agent import Agent
    from harness.config import load_settings

    uid = uid_for(get_assessment())
    agent = _agents.get(uid)
    if agent is None:
        settings = load_settings()      # Kali MCP + DB from env; the LLM is set per turn
        agent = Agent(settings)
        _agents[uid] = agent
    return agent


def switch_model() -> bool:
    """Point the current assessment's agent at the now-active provider, keeping history.

    Returns False if there is no agent yet (nothing to switch) or no active model.
    """
    agent = _agents.get(uid_for(get_assessment()))
    settings = _llm_settings()
    if agent is None or settings is None:
        return False
    agent.set_llm(settings)
    return True


async def run(text: str, on_event: OnEvent, on_ask: Optional[OnAsk] = None) -> None:
    """One agent turn: set the active model, then drive `Agent.chat`, streaming events."""
    settings = _llm_settings()
    if settings is None:
        raise StoreValidationError("No LLM model is active. Use /model to pick one.")
    agent = _agent()
    agent.set_llm(settings)            # always the current /provider selection
    await agent.chat(text, on_event, on_ask)


def reset() -> None:
    """Drop cached agents (new session / assessment, and between tests)."""
    _agents.clear()


# --- driving the shared run model so the static Execution screen renders the agent --------

_PCT = {"done": 100, "completed": 100, "running": 50, "active": 50, "in_progress": 50}


def begin_execution() -> None:
    """Mark the run live and enterable so the Execution screen shows the agent working."""
    run = lists.current().run
    run.started = True
    run.plan_started = True       # navigation lets Execution open
    run.waiting_gate = ""
    run.stopped = ""
    run.completed = False
    run.phase = "testing"
    if run.started_at is None:
        run.started_at = utc_now()


def set_plan(steps) -> None:
    """Replace the plan checklist from the agent's `update_plan` steps and their statuses.

    Each step becomes a plan task; its status drives the Execution task row (spinner on the
    running one). Static `plan_tasks()` reads these via `run.progress`.
    """
    run = lists.current().run
    tasks = []
    for i, step in enumerate(steps or []):
        key = f"s{i}"
        label = (str(step.get("text", "")).strip() or f"step {i + 1}")[:48]
        tasks.append(PlanTask(key=key, label=label))
        run.progress[key] = _PCT.get(str(step.get("status", "")).lower(), 0)
    lists.current().plan = tasks


def finish(stopped: str = "") -> None:
    """Mark the agent run complete (or stopped) and settle the checklist."""
    run = lists.current().run
    run.waiting_gate = ""
    run.finished_at = utc_now()
    if stopped:
        run.stopped = stopped
    else:
        run.completed = True
        for key in list(run.progress):          # settle any still-running task to done
            if key.startswith("s") and run.progress[key] == 50:
                run.progress[key] = 100


# --- recording streamed events into the transcript -----------------------------------------

def record_user(text: str) -> None:
    """The operator's line that starts/continues an agent turn."""
    add_chat("text", "you", text)


def note(text: str, tone: str = "muted") -> None:
    """A Reconix chat note (errors, model switches)."""
    add_chat("text", "reconix", text, tone=tone)


def record_event(ev: Dict[str, Any]) -> None:
    """Translate one harness agent event into a chat / activity line."""
    kind = ev.get("type")
    if kind == "assistant":
        add_chat("text", "reconix", ev.get("text") or "")
    elif kind == "reasoning":
        # The model's chain-of-thought, shown muted so it reads as "thinking".
        add_chat("text", "reconix", f"thinking… {ev.get('text') or ''}"[:2000], tone="muted")
    elif kind == "plan":
        steps = ev.get("steps") or []
        set_plan(steps)             # drives the Execution task rows + spinner
        labels = "; ".join(str(s.get("text", "")) for s in steps)
        add_activity("AI", f"plan: {labels}"[:300])
    elif kind == "tool_start":
        add_activity("TOOL", f"{ev.get('name')}({_short(ev.get('args'))})")
    elif kind == "tool_progress":
        add_activity("TOOL", str(ev.get("text", ""))[:300])
    elif kind == "tool_end":
        add_activity("TOOL", f"{ev.get('name')}: {_short(ev.get('result'))}")
        if ev.get("name") == "run_scan":
            ingest_scan_findings(ev.get("result"))


_SEV = {"critical": "CRITICAL", "high": "HIGH", "medium": "MEDIUM",
        "low": "LOW", "info": "INFO"}


def ingest_scan_findings(result: Any) -> int:
    """Map the harness findings from a run_scan result into store `Finding`s (full records
    from the harness DB), so `/findings`, the report, `/summary` and the web snapshot populate.
    """
    if not isinstance(result, dict):
        return 0
    agent = _agents.get(uid_for(get_assessment()))
    target = result.get("target") or {}
    tid = target.get("id")
    if agent is None or tid is None:
        return 0
    try:
        rows = agent.db.findings_for_target(tid)
    except Exception:
        return 0
    from .findings import ingest_external
    mapped = [_to_finding(hf) for hf in rows]
    return ingest_external(mapped, prefix="AI")


def _to_finding(hf: Any):
    """Harness `Finding` dataclass -> Reconix `Finding`."""
    from ..models import Finding
    from .redact import redact

    sev = _SEV.get(getattr(hf.severity, "value", str(hf.severity)).lower(), "INFO")
    evidence = [redact(hf.evidence)[:500]] if getattr(hf, "evidence", "") else []
    return Finding(
        fid="",                                   # assigned by ingest_external
        severity=sev,
        title=redact(hf.title or "")[:200],
        path=hf.location or "",
        validation="CONFIRMED" if getattr(hf, "verified", False) else "UNCONFIRMED",
        description=redact(hf.description or ""),
        affected_url=hf.location or "",
        impact=redact(getattr(hf, "ai_analysis", "") or ""),
        remediation="",
        tool="agent",
        evidence=evidence,
        cvss_score=float(getattr(hf, "cvss_score", 0) or 0),
        category="Web App",
    )


def _short(value: Any, limit: int = 160) -> str:
    """A compact, plain-text one-liner for an event's args/result (never raises)."""
    try:
        text = value if isinstance(value, str) else json.dumps(value, default=str)
    except Exception:
        text = str(value)
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"
