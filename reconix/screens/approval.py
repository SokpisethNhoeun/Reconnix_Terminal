"""Frame 04 — Human approval gate (↑/↓ choices, second confirmation for HIGH risk)."""

from typing import List, Optional

from rich.console import RenderableType
from rich.text import Text
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Vertical
from textual.widgets import Static

from .base import ReconixScreen
from .choice import ChoiceScreen, details_body
from .. import store, theme
from ..models import Choice
from ..widgets import ChoiceMenu, Question, menu_hint

# (scope manifest key, label) shown in View details
SCOPE_LIMITS = (
    ("targets", "targets"), ("allowed_tools", "tools"), ("allowed_ports", "ports"),
    ("allowed_http_methods", "methods"), ("allowed_url_patterns", "url patterns"),
    ("excluded_paths", "excluded"), ("out_of_scope", "out of scope"),
)


class ApprovalScreen(ReconixScreen):
    flow_name = "approval"
    mode_name = "APPROVAL"

    BINDINGS = [
        Binding("enter", "choose", "select", show=False),
        Binding("y", "approve", "approve", show=False),
        Binding("n", "reject", "reject"),
        Binding("d", "details", "details"),
        Binding("escape", "cancel", "back to plan", show=False),
    ]

    def __init__(self) -> None:
        super().__init__()
        self._request = store.get_pending_approval()
        self._step = store.get_plan_step(self._request.step_num)

    def compose_body(self) -> ComposeResult:
        req, step = self._request, self._step
        total = len(store.list_plan_steps())
        target = store.get_assessment().target
        high_risk = store.needs_confirmation(req.request_id)
        yield Static(
            f"[{theme.GREEN}]✓[/] [{theme.DIM}][1-{step.num - 1}] recon complete — "
            f"{req.context}[/]",
            markup=True,
        )
        yield Static(
            f"[{theme.CYAN}]◆ reconix[/] [{theme.DIM}]step {step.num} of {total} requires your approval[/]",
            classes="ai-label", markup=True,
        )
        with Vertical(classes="panel danger") as panel:
            panel.border_title = "◆ HUMAN APPROVAL REQUIRED"
            panel.border_subtitle = f"[{theme.CRITICAL}]◆ HIGH RISK[/]"
            yield Static(
                f"[{theme.DIM}]Action[/]      [{theme.TEXT}][b]{step.action}[/b][/] "
                f"[{theme.MUTED}]({req.summary})[/]",
                markup=True,
            )
            yield Static(
                f"[{theme.DIM}]Target[/]      [{theme.TEAL}][b]https://{target}[/b][/] "
                f"[{theme.GREEN}]✓ in scope[/]",
                markup=True,
            )
            yield Static(
                f"[{theme.DIM}]Tool[/]        [{theme.TEXT}][b]{step.tool}[/b][/] "
                f"[{theme.MUTED}]{req.tool_info}[/]",
                markup=True,
            )
            yield Static(
                f"[{theme.DIM}]Why high[/]    [{theme.MUTED}]{step.why}[/]",
                markup=True,
            )
            yield Static("")
            yield Static(f"[{theme.DIM}]EXACT COMMAND[/]", markup=True)
            yield Static(
                f"[{theme.GREEN}][b]$[/b][/] [{theme.TEXT}]{req.command}[/]   "
                f"[{theme.DIM}]{req.command_hash}[/]",
                markup=True, classes="panel-note",
            )
        yield Question(
            "Approval", f"Do you want to run {step.action} on {target}?",
            [
                Choice("approve", "Approve & run",
                       "HIGH risk: asks you to confirm once more." if high_risk
                       else "Runs the step now."),
                Choice("reject", "Reject", "Stop here and go back to the plan.", "danger"),
                Choice("details", "View details", "Scope limits, exact command and audit trail."),
                Choice("edit", "Edit params", disabled=True),
            ],
            hint=menu_hint("go back"), menu_id="approval-menu",
        )
        yield Static(
            f"[{theme.DIM}]logged to audit · operator: {store.current_operator()}[/]",
            markup=True,
        )

    def on_mount(self) -> None:
        self.query_one("#approval-menu", ChoiceMenu).focus()

    def on_choice_menu_chosen(self, event: ChoiceMenu.Chosen) -> None:
        event.stop()
        {"approve": self.action_approve, "reject": self.action_reject,
         "details": self.action_details, "chat": self.chat_about}[event.choice_id]()

    def chat_topic(self) -> str:
        return f"{self._step.action} on {store.get_assessment().target}"

    # --- approve: one step, or two for HIGH risk -----------------------------------
    def action_approve(self) -> None:
        req = self._request
        if not store.needs_confirmation(req.request_id):
            self._approve(None)
            return
        token = store.request_confirmation(req.request_id, req.command_hash)
        target = store.get_assessment().target
        dialog = ChoiceScreen(
            "◆ HIGH-RISK · second confirmation",
            "Run this HIGH-risk step now?",
            [
                Choice("no", "No, go back", "Nothing runs."),
                Choice("yes", f"Yes, run {self._step.action} on {target}",
                       "Starts execution now.", "danger"),
            ],
            body=self._confirmation_body(), default=0, danger=True, chip="HIGH RISK",
        )
        self.app.push_screen(dialog, lambda answer: self._confirmed(answer, token))

    def _confirmed(self, answer: Optional[str], token: str) -> None:
        if answer == "yes":
            self._approve(token)
        else:
            store.decline_confirmation(self._request.request_id)

    def _approve(self, token: Optional[str]) -> None:
        req = self._request
        try:
            store.approve(req.request_id, command_hash=req.command_hash, confirmation_token=token)
        except store.StoreValidationError as exc:
            self.notify(str(exc), severity="error", markup=False)
            return
        self.app.go_next()

    def _confirmation_body(self) -> List[Text]:
        req = self._request
        return [
            Text.assemble(("$ ", f"bold {theme.GREEN}"), (req.command, theme.TEXT)),
            Text(req.command_hash, style=theme.DIM),
            Text(""),
            Text(req.phrase, style=f"bold {theme.MEDIUM}"),
            Text(self._step.why, style=theme.MUTED),
        ]

    # --- other choices -------------------------------------------------------------
    def action_details(self) -> None:
        store.log_event("approval.details_viewed", self._request.request_id)
        self.app.push_screen(ChoiceScreen(
            "▤ APPROVAL DETAILS", "", [Choice("back", "Back to the choices")],
            body=self._details_body(), chip="Details",
        ))

    def _details_body(self) -> List[RenderableType]:
        req, step = self._request, self._step
        scope = store.get_assessment().scope
        events = [e for e in store.list_events() if req.request_id in e.detail]
        return details_body([
            ("Step", [
                ("request", req.request_id, theme.KEY),
                ("step", f"{step.num} of {len(store.list_plan_steps())} · {step.action}", theme.MUTED),
                ("risk · gate", f"{step.risk} · {step.gate}", theme.RISK.get(step.risk, theme.MUTED)),
                ("tool", f"{step.tool} · {req.tool_info}", theme.MUTED),
                ("why", step.why, theme.MUTED),
            ]),
            ("Command", [
                ("exact", req.command, theme.TEXT),
                ("hash", req.command_hash, theme.MUTED),
            ]),
            ("Scope limits", [
                (label, ", ".join(str(v) for v in scope.get(key, [])), theme.MUTED)
                for key, label in SCOPE_LIMITS
            ]),
            ("Earlier steps", [
                (task.action, task.detail, theme.MUTED)
                for task in store.list_exec_tasks() if task.status == "DONE"
            ]),
            ("Audit trail", [
                (e.created_at.strftime("%H:%M:%S"), f"{e.kind} · {e.operator}", theme.MUTED)
                for e in events[-6:]
            ]),
        ])

    def action_reject(self) -> None:
        store.reject(self._request.request_id)
        self.app.goto("plan")

    def action_cancel(self) -> None:
        store.log_event("approval.cancelled", self._request.request_id)
        self.app.goto("plan")
