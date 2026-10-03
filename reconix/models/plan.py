"""Test-plan steps, approval requests, and the records of each decision."""

from dataclasses import dataclass, field
from datetime import datetime

from .base import utc_now


@dataclass
class PlanStep:
    num: int
    action: str
    command: str
    risk: str          # LOW | MEDIUM | HIGH
    gate: str          # "auto" | "approve"
    why: str
    tool: str


@dataclass
class ApprovalRequest:
    """A gated step waiting for type-to-confirm approval."""

    request_id: str
    step_num: int
    command: str       # the exact command that will run
    command_hash: str
    phrase: str        # approval statement shown in the HIGH-risk confirmation
    summary: str       # short note shown next to the action
    tool_info: str     # tool version / templates
    context: str       # what the earlier steps found


@dataclass
class ApprovalDecision:
    request_id: str
    decision: str      # "APPROVED" | "REJECTED"
    operator: str
    command_hash: str
    created_at: datetime = field(default_factory=utc_now)


@dataclass
class Confirmation:
    """Single-use token for the second step of a HIGH-risk approval."""

    request_id: str
    token: str
    used: bool = False
    created_at: datetime = field(default_factory=utc_now)
