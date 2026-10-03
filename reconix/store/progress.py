"""Which flow steps are settled — drives the progress line under the top bar."""

from typing import Dict

from . import lists
from .plan import get_pending_approval, is_approved


def step_states() -> Dict[str, str]:
    """{"scope": "done", "execution": "stopped", ...} for steps that have a settled state.

    Events are replayed oldest first, so the latest one wins (approved then rejected
    means not done). Approval comes from the decision records.
    """
    states: Dict[str, str] = {}
    for event in lists.EVENTS:
        kind = event.kind
        if kind == "scope.approved":
            states["scope"] = "done"
        elif kind == "scope.rejected":
            states.pop("scope", None)
        elif kind == "plan.run":
            states["plan"] = "done"
        elif kind == "plan.cancelled":
            states.pop("plan", None)
        elif kind == "execution.completed":
            states["execution"] = "done"
        elif kind == "execution.stopped":
            states["execution"] = "stopped"
    if is_approved(get_pending_approval().request_id):
        states["approval"] = "done"
    return states
