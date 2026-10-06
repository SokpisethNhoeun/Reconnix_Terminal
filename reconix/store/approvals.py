"""Approval of gated actions: MEDIUM needs a decision; HIGH a token and a typed reason.

These checks are the authority. The approval dialogs may pre-check for a nicer
experience, but nothing is approved unless `approve()` accepts it.
"""

import hashlib
import secrets
import unicodedata
from typing import List, Optional

from ..models import GATE_APPROVAL_PREFIX, ApprovalDecision, ApprovalRequest, Confirmation
from . import lists
from .activity import current_operator, log_event
from .errors import StoreValidationError
from .scope import check_request
from .transcript import add_activity

MIN_REASON_LENGTH = 3
MAX_REASON_LENGTH = 300


def command_digest(command: str) -> str:
    """The hash an approval is bound to; `approve()` re-computes and compares it."""
    return "sha256:" + hashlib.sha256(command.encode("utf-8")).hexdigest()


def clean_reason(text: str) -> str:
    """The reason as it will be recorded: invisible characters removed, spaces collapsed."""
    visible = "".join(c for c in text if unicodedata.category(c) not in ("Cf", "Cc", "Co"))
    return " ".join(visible.split())


def get_approval(request_id: str) -> ApprovalRequest:
    for request in lists.current().approvals:
        if request.request_id == request_id:
            return request
    raise StoreValidationError(f"Unknown approval request {request_id}.")


def needs_confirmation(request_id: str) -> bool:
    """HIGH-risk actions need the confirmation token and a typed reason."""
    return get_approval(request_id).risk == "HIGH"


def decision_for(request_id: str) -> Optional[ApprovalDecision]:
    for decision in reversed(lists.current().decisions):
        if decision.request_id == request_id:
            return decision
    return None


def is_approved(request_id: str) -> bool:
    decision = decision_for(request_id)
    return decision is not None and decision.decision == "APPROVED"


def list_approval_decisions() -> List[ApprovalDecision]:
    return list(lists.current().decisions)


def approvals_count() -> int:
    return sum(1 for d in lists.current().decisions if d.decision == "APPROVED")


# --- checks shared by approve / reject --------------------------------------------------
def _pending(request_id: str) -> ApprovalRequest:
    """The request, if the run is waiting on it and nobody has decided yet."""
    request = get_approval(request_id)
    if lists.current().run.waiting_gate != GATE_APPROVAL_PREFIX + request_id:
        raise StoreValidationError("This action isn't waiting for a decision.")
    if decision_for(request_id) is not None:
        raise StoreValidationError("This action was already decided.")
    return request


def _check_hash(request: ApprovalRequest, command_hash: str) -> None:
    """The operator saw this exact request, and it hasn't changed since."""
    if not secrets.compare_digest(command_hash, request.command_hash):
        raise StoreValidationError("This approval is for a different request.")
    if command_digest(request.command) != request.command_hash:
        raise StoreValidationError("The request changed after it was shown. Review it again.")


# --- the HIGH-risk second step ----------------------------------------------------------
def request_confirmation(request_id: str, command_hash: str) -> str:
    """Open the confirmation step of a HIGH-risk approval; returns a single-use token."""
    request = _pending(request_id)
    _check_hash(request, command_hash)
    if request.risk != "HIGH":
        raise StoreValidationError("Only HIGH-risk actions need a confirmation step.")
    confirmations = lists.current().confirmations
    for confirmation in confirmations:            # one live token per request
        if confirmation.request_id == request_id:
            confirmation.used = True
    token = secrets.token_hex(16)
    confirmations.append(Confirmation(request_id=request_id, token=token))
    log_event("approval.confirmation_requested", request_id)
    return token


def decline_confirmation(request_id: str) -> None:
    """The operator left the confirmation step without approving: void open tokens."""
    get_approval(request_id)
    voided = False
    for confirmation in lists.current().confirmations:
        if confirmation.request_id == request_id and not confirmation.used:
            confirmation.used = True
            voided = True
    if voided:
        log_event("approval.confirmation_declined", request_id)


def _consume_token(request_id: str, token: Optional[str]) -> None:
    for confirmation in lists.current().confirmations:
        if (confirmation.request_id == request_id and not confirmation.used
                and secrets.compare_digest(confirmation.token, token or "")):
            confirmation.used = True
            return
    raise StoreValidationError("HIGH-risk actions need the confirmation step first.")


# --- decisions -----------------------------------------------------------------------------
def approve(
    request_id: str, *, command_hash: str, confirmation_token: Optional[str] = None,
    reason: str = "",
) -> ApprovalDecision:
    """Record an approval, or raise StoreValidationError if any check fails.

    `command_hash` binds the approval to the exact request the operator saw. HIGH
    risk also needs an unused token from `request_confirmation()` and a typed reason.
    The policy check runs before the decision is recorded, and the token is spent only
    when everything else is valid, so a rejected reason doesn't burn it.
    """
    request = _pending(request_id)
    _check_hash(request, command_hash)
    reason = clean_reason(reason)
    if request.risk == "HIGH":
        if len(reason) < MIN_REASON_LENGTH:
            raise StoreValidationError(
                f"HIGH-risk approvals need a reason of at least {MIN_REASON_LENGTH} characters.")
        if len(reason) > MAX_REASON_LENGTH:
            raise StoreValidationError(f"Keep the reason under {MAX_REASON_LENGTH} characters.")
    # The policy engine decides before the human decision is recorded.
    verdict = check_request(request.method, request.path)
    if not verdict.allowed:
        raise StoreValidationError(f"Blocked by policy: {verdict.reason}.")
    if request.risk == "HIGH":
        _consume_token(request_id, confirmation_token)
    decision = ApprovalDecision(
        request_id=request_id, decision="APPROVED", operator=current_operator(),
        command_hash=request.command_hash, reason=reason,
    )
    lists.current().decisions.append(decision)
    detail = " (with reason)" if request.risk == "HIGH" else ""
    add_activity("USER", f"Approved: {request.action}{detail}", tone="ok")
    log_event("approval.approved", f"{request_id} {request.command_hash}")
    return decision


def reject(request_id: str) -> ApprovalDecision:
    request = _pending(request_id)
    decline_confirmation(request_id)
    decision = ApprovalDecision(
        request_id=request_id, decision="REJECTED", operator=current_operator(),
        command_hash=request.command_hash,
    )
    lists.current().decisions.append(decision)
    add_activity("USER", f"Rejected: {request.action}", tone="block")
    log_event("approval.rejected", request_id)
    return decision
