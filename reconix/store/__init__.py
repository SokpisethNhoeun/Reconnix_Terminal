"""In-memory data store — the only thing screens import for data.

Every function here reads or writes the shared lists in `lists.py`. To move to
the Reconix backend later, keep these function names and signatures and change
their bodies to call the API; the screens do not need to change.
"""

from .activity import add_feedback, current_operator, list_events, list_feedback, log_event
from .assessment import add_request, get_assessment, latest_request, list_requests
from .errors import StoreValidationError
from .execution import list_exec_tasks, list_scan_output
from .findings import (
    FINDING_FILTERS, FINDING_SORTS, SEVERITY_ORDER, confirmed_count, filter_counts,
    filter_label, find_findings, get_finding, key_findings, list_findings, severity_counts,
    sort_label, validate_finding,
)
from .history import add_history, list_history
from .progress import step_states
from .plan import (
    approve, decline_confirmation, get_pending_approval, get_plan_step, is_approved,
    list_approval_decisions, list_plan_steps, needs_confirmation, reject,
    request_confirmation,
)
from .seed import load_demo_data

load_demo_data()

reset = load_demo_data   # tests: restore the demo rows between runs

__all__ = [
    "StoreValidationError", "reset",
    "get_assessment", "latest_request", "list_requests", "add_request",
    "list_plan_steps", "get_plan_step", "get_pending_approval",
    "needs_confirmation", "request_confirmation", "decline_confirmation",
    "approve", "reject", "is_approved", "list_approval_decisions",
    "list_exec_tasks", "list_scan_output",
    "list_findings", "get_finding", "key_findings", "severity_counts",
    "confirmed_count", "SEVERITY_ORDER", "validate_finding",
    "FINDING_FILTERS", "FINDING_SORTS", "find_findings", "filter_label", "sort_label",
    "filter_counts",
    "current_operator", "log_event", "list_events",
    "add_history", "list_history", "add_feedback", "list_feedback", "step_states",
]
