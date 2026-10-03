"""Test-plan steps and the two-step approval gate for risky steps."""

import secrets
from typing import List, Optional

from ..models import ApprovalDecision, ApprovalRequest, Confirmation, PlanStep
from . import lists
from .activity import current_operator, log_event
from .errors import StoreValidationError


def list_plan_steps() -> List[PlanStep]:
    return list(lists.PLAN_STEPS)


def get_plan_step(num: int) -> PlanStep:
    for step in lists.PLAN_STEPS:
        if step.num == num:
            return step
    raise StoreValidationError(f"No plan step {num}.")


def get_pending_approval() -> ApprovalRequest:
    return lists.APPROVAL_REQUESTS[-1]


def _find_request(request_id: str) -> ApprovalRequest:
    for request in lists.APPROVAL_REQUESTS:
        if request.request_id == request_id:
            return request
    raise StoreValidationError(f"Unknown approval request {request_id}.")


def _check_hash(request: ApprovalRequest, command_hash: str) -> None:
    if command_hash != request.command_hash:
        raise StoreValidationError("This approval is for a different command.")


# --- two-step approval --------------------------------------------------------
def needs_confirmation(request_id: str) -> bool:
    """HIGH-risk steps need a second, explicit confirmation before approval."""
    request = _find_request(request_id)
    return get_plan_step(request.step_num).risk == "HIGH"


def request_confirmation(request_id: str, command_hash: str) -> str:
    """Start the second step of a HIGH-risk approval; returns a single-use token."""
    request = _find_request(request_id)
    _check_hash(request, command_hash)
    token = secrets.token_hex(8)
    lists.CONFIRMATIONS.append(Confirmation(request_id=request_id, token=token))
    log_event("approval.confirmation_requested", request_id)
    return token


def decline_confirmation(request_id: str) -> None:
    """The operator backed out of the second step: void any open tokens."""
    _find_request(request_id)
    for confirmation in lists.CONFIRMATIONS:
        if confirmation.request_id == request_id:
            confirmation.used = True
    log_event("approval.confirmation_declined", request_id)


def _consume_token(request_id: str, token: Optional[str]) -> None:
    for confirmation in lists.CONFIRMATIONS:
        if (confirmation.request_id == request_id and confirmation.token == token
                and not confirmation.used):
            confirmation.used = True
            return
    raise StoreValidationError("HIGH-risk steps need the second confirmation first.")


def approve(
    request_id: str, *, command_hash: str, confirmation_token: Optional[str] = None,
) -> ApprovalDecision:
    """Record an approval. These checks are the authority; the UI cannot skip them.

    `command_hash` binds the approval to the exact command the operator saw.
    HIGH-risk steps also need an unused token from `request_confirmation()`.
    Raises StoreValidationError when a check fails.
    """
    request = _find_request(request_id)
    _check_hash(request, command_hash)
    if needs_confirmation(request_id):
        _consume_token(request_id, confirmation_token)
    decision = ApprovalDecision(
        request_id=request_id, decision="APPROVED",
        operator=current_operator(), command_hash=request.command_hash,
    )
    lists.APPROVAL_DECISIONS.append(decision)
    log_event("approval.approved", f"{request_id} {request.command_hash}")
    return decision


def reject(request_id: str) -> ApprovalDecision:
    request = _find_request(request_id)
    decision = ApprovalDecision(
        request_id=request_id, decision="REJECTED",
        operator=current_operator(), command_hash=request.command_hash,
    )
    lists.APPROVAL_DECISIONS.append(decision)
    log_event("approval.rejected", request_id)
    return decision


def is_approved(request_id: str) -> bool:
    """True when the latest decision for this request is an approval."""
    for decision in reversed(lists.APPROVAL_DECISIONS):
        if decision.request_id == request_id:
            return decision.decision == "APPROVED"
    return False


def list_approval_decisions() -> List[ApprovalDecision]:
    return list(lists.APPROVAL_DECISIONS)
