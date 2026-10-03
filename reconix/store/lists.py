"""The shared in-memory lists — the app's only mutable data.

Nothing outside `reconix/store/` should import this module. Screens call the
functions in `reconix.store` instead, so this file can later be replaced by API
calls without touching the UI. Lists are mutated in place (append/clear/extend)
so every module keeps seeing the same objects.
"""

from typing import List

from ..models import (
    ApprovalDecision, ApprovalRequest, Assessment, AuditEvent, Confirmation, ExecTask,
    Feedback, Finding, HistoryEntry, LogLine, PlanStep, UserRequest,
)

ASSESSMENTS: List[Assessment] = []
REQUESTS: List[UserRequest] = []
PLAN_STEPS: List[PlanStep] = []
APPROVAL_REQUESTS: List[ApprovalRequest] = []
APPROVAL_DECISIONS: List[ApprovalDecision] = []
CONFIRMATIONS: List[Confirmation] = []
EXEC_TASKS: List[ExecTask] = []
SCAN_OUTPUT: List[LogLine] = []
FINDINGS: List[Finding] = []
EVENTS: List[AuditEvent] = []
PROMPT_HISTORY: List[HistoryEntry] = []
FEEDBACK: List[Feedback] = []

ALL_LISTS = (
    ASSESSMENTS, REQUESTS, PLAN_STEPS, APPROVAL_REQUESTS, APPROVAL_DECISIONS,
    CONFIRMATIONS, EXEC_TASKS, SCAN_OUTPUT, FINDINGS, EVENTS, PROMPT_HISTORY, FEEDBACK,
)
