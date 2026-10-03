"""Frame 02 — Scope manifest review."""

import json

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Vertical
from textual.widgets import Static

from .base import ReconixScreen
from .. import store, theme
from ..models import Choice
from ..widgets import ChoiceMenu, Question, UserMessage, menu_hint


def _manifest_markup() -> str:
    """Render the scope manifest as lightly syntax-highlighted JSON."""
    lines = ["[#7D8B91]{[/]"]
    items = list(store.get_assessment().scope.items())
    for i, (key, value) in enumerate(items):
        comma = "" if i == len(items) - 1 else "[#7D8B91],[/]"
        val = json.dumps(value)
        color = theme.CRITICAL if key == "out_of_scope" else (
            theme.NUMBER if key == "allowed_ports" else theme.STRING
        )
        lines.append(
            f"  [{theme.KEY}]{key}[/][#7D8B91]:[/] [{color}]{val}[/]{comma}"
        )
    lines.append("[#7D8B91]}[/]")
    return "\n".join(lines)


class ScopeScreen(ReconixScreen):
    flow_name = "scope"
    mode_name = "SCOPE"

    BINDINGS = [
        Binding("enter", "choose", "select", show=False),
        Binding("escape", "reject", "reject"),
    ]

    def compose_body(self) -> ComposeResult:
        yield UserMessage(store.latest_request().text)
        yield Static(
            f"[{theme.CYAN}]◆ reconix[/] [{theme.DIM}]drafted a scope manifest for your approval[/]",
            classes="ai-label", markup=True,
        )
        with Vertical(classes="panel accent") as panel:
            panel.border_title = "⛉ SCOPE MANIFEST"
            panel.border_subtitle = "draft · unapproved"
            yield Static(_manifest_markup(), classes="panel-body", markup=True)
        yield Static(
            f"[{theme.LOW}]ℹ[/]  [{theme.MUTED}]The agent can only act inside this "
            "manifest. Anything else is blocked before a tool runs.[/]",
            classes="panel-note", markup=True,
        )
        yield Question(
            "Scope", "Approve this scope manifest?",
            [
                Choice("approve", "Approve scope",
                       "Lock the manifest and continue to the test plan.", recommended=True),
                Choice("edit", "Edit manifest", disabled=True),
                Choice("reject", "Reject", "Discard this draft and go back to the start.", "danger"),
            ],
            hint=menu_hint("go back"), menu_id="scope-menu",
        )

    def on_mount(self) -> None:
        self.query_one("#scope-menu", ChoiceMenu).focus()

    def action_approve(self) -> None:
        store.log_event("scope.approved")
        self.app.go_next()

    def action_reject(self) -> None:
        store.log_event("scope.rejected")
        self.app.go_prev()

    def on_choice_menu_chosen(self, event: ChoiceMenu.Chosen) -> None:
        event.stop()
        {"approve": self.action_approve, "reject": self.action_reject,
         "chat": self.chat_about}[event.choice_id]()

    def chat_topic(self) -> str:
        return "the scope manifest"
