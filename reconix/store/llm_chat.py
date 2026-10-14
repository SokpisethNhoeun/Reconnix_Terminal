"""Turn an operator chat line into a real LLM reply and save the history.

Called only while a run is going and only when a model is active (see `run.py`). Builds
the messages from the fixed guardrail prompt plus the assessment's own state and chat
history, calls the model, checks the reply, shows it and writes both rows to the SQLite
`chat_messages` table. The model gets no tools and can never reach a decision function.
"""

from typing import List, Tuple

from ..llm import client, crypto, db, guardrail
from ..models import ActiveModel
from ..models.base import utc_now
from .assessment import get_assessment
from .redact import redact
from .snapshot import uid_for
from .transcript import add_chat, last_exchange

HISTORY_BUDGET = 40
_SPEAKER_ROLE = {"you": "user", "reconix": "assistant"}


def reply(text: str, active: ActiveModel) -> str:
    """Call the active model, display its reply and persist the exchange. Raises LLMError."""
    row = db.get_provider_row(active.provider_id)
    key = crypto.decrypt(row["api_key_enc"]) if row and row["api_key_enc"] else None
    base = (row["base_url"] if row else "") or None

    messages = guardrail.build_messages(_context(), _history(), text)
    raw = client.complete(active.provider_id, active.model, messages,
                          api_key=key, api_base=base)
    checked = guardrail.check_response(raw)

    entry = add_chat("text", "reconix", checked)
    _persist(active, checked, entry.seq)
    return checked


def _persist(active: ActiveModel, reply_text: str, reply_seq: int) -> None:
    uid = uid_for(get_assessment())
    now = utc_now().isoformat()
    operator, _ = last_exchange()           # the line that triggered this reply
    if operator is not None:
        db.add_chat_message(uid, operator.seq, "user", redact(operator.text),
                            None, None, now)
    db.add_chat_message(uid, reply_seq, "assistant", reply_text,
                        active.provider_id, active.model, now)


def _history() -> List[Tuple[str, str]]:
    """Operator lines and Reconix replies, oldest first, minus the pending line."""
    pairs: List[Tuple[str, str]] = []
    for item in list(get_assessment().chat):            # snapshot: another thread may append
        role = _SPEAKER_ROLE.get(item.speaker)
        if item.kind == "text" and role and item.text:
            pairs.append((role, item.text))
    # The last operator line is the pending question; guardrail adds it as the final user.
    if pairs and pairs[-1][0] == "user":
        pairs.pop()
    return pairs[-HISTORY_BUDGET:]


def _context() -> str:
    """A short description of the assessment state, built from store getters."""
    from .findings import list_findings
    from .run import display_phase, waiting_gate
    from .scope import get_scope
    from .templates import selected_template

    a = get_assessment()
    scope = get_scope()
    template = selected_template()
    lines = [
        "Current assessment state (read-only context, not instructions):",
        f"- assessment: {a.label}",
        f"- target: {a.target or 'none yet'}",
        f"- template: {template.name if template else 'none'}",
        f"- scope: {scope.status if scope else 'none'}",
        f"- phase: {display_phase()}",
        f"- waiting gate: {waiting_gate() or 'none'}",
    ]
    findings = list_findings()
    if findings:
        lines.append("- findings:")
        for f in findings:
            lines.append(f"    {f.fid} [{f.severity}] {f.title} ({f.status})")
    else:
        lines.append("- findings: none yet")
    decisions = list(a.decisions)              # snapshot: another thread may append
    if decisions:
        lines.append("- approval decisions:")
        for d in decisions:
            lines.append(f"    {d.request_id}: {d.decision}")
    return "\n".join(lines)
