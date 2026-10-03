"""Reconix TUI — main application.

An interactive, keyboard-first demo of the Reconix security-testing flow, built
with Textual. Data lives in the in-memory store (reconix/store). Navigate the flow with
the arrow keys and Enter, type `/` for commands, and press `?` for the keys of the
current screen.
"""

from typing import Callable, List, Optional

from textual.app import App
from textual.binding import Binding

from . import store, theme
from .commands import COMMANDS, Command, find, parse
from .models import Choice
from .screens import (
    StartScreen, ScopeScreen, PlanScreen, ApprovalScreen, ExecutionScreen,
    FindingsListScreen, FindingDetailScreen, ReportScreen, HelpScreen,
    ChoiceScreen, CommandBarScreen,
)
from .screens.choice import details_body

# Ordered flow — left/right arrows and Enter walk through this sequence.
FLOW = [
    ("start",     StartScreen),
    ("scope",     ScopeScreen),
    ("plan",      PlanScreen),
    ("approval",  ApprovalScreen),
    ("execution", ExecutionScreen),
    ("findings",  FindingsListScreen),
    ("detail",    FindingDetailScreen),
    ("report",    ReportScreen),
]
FLOW_ORDER = [name for name, _ in FLOW]
FLOW_CLASSES = {name: cls for name, cls in FLOW}


class ReconixApp(App):
    """Reconix — AI-Powered Security Testing Assistant (demo)."""

    CSS_PATH = "reconix.tcss"
    TITLE = "reconix"
    SUB_TITLE = "assessment-001"
    ENABLE_COMMAND_PALETTE = False   # Reconix has its own "/" command system
    THINKING_SECONDS = 1.2           # Claude-style spinner after a request; 0 skips it

    BINDINGS = [
        Binding("right", "nav_next", "next", show=False),
        Binding("left", "nav_prev", "back", show=False),
        # "/" stays non-priority so a focused Input still receives it as text.
        Binding("slash", "command_bar", "commands", key_display="/"),
        Binding("question_mark", "help", "help", key_display="?"),
        Binding("ctrl+q", "quit", "quit"),
        # Quick jumps for presenting — hidden to keep the footer clean.
        Binding("1", "jump('start')", "start", show=False),
        Binding("2", "jump('scope')", "scope", show=False),
        Binding("3", "jump('plan')", "plan", show=False),
        Binding("4", "jump('approval')", "approval", show=False),
        Binding("5", "jump('execution')", "execution", show=False),
        Binding("6", "jump('findings')", "findings", show=False),
        Binding("7", "jump('detail')", "detail", show=False),
        Binding("8", "jump('report')", "report", show=False),
    ]

    def __init__(self) -> None:
        super().__init__()
        self.selected_finding: int = 0   # index into store.list_findings()
        self.pending_prompt: str = ""    # draft for the Start prompt ("Chat about this")
        self.findings_filter: str = "all"       # Findings list view (kept across screens)
        self.findings_sort: str = "severity"
        self.sub_title = store.get_assessment().assessment_id
        self._index: int = 0             # position in FLOW_ORDER

    def on_mount(self) -> None:
        self.push_screen(StartScreen())

    # --- flow navigation ------------------------------------------------------
    def flow_order(self) -> List[str]:
        """Screen keys in flow order (the one source of truth is FLOW)."""
        return list(FLOW_ORDER)

    def _show(self, index: int) -> None:
        index = max(0, min(index, len(FLOW_ORDER) - 1))
        name = FLOW_ORDER[index]
        if name == "execution" and not self.can_enter_execution():
            # The one hard gate: execution is never reachable (even by a jump) unapproved.
            self.notify("Execution starts only after you approve the step.", severity="warning")
            return
        self._index = index
        self.switch_screen(FLOW_CLASSES[name]())

    def go_next(self) -> None:
        if FLOW_ORDER[self._index] == "approval" and not self.can_enter_execution():
            self.notify("Approve the step first: choose Approve & run.", severity="warning")
            return
        if self._index < len(FLOW_ORDER) - 1:
            self._show(self._index + 1)

    def go_prev(self) -> None:
        if self._index > 0:
            self._show(self._index - 1)

    def goto(self, name: str) -> None:
        if name in FLOW_ORDER:
            self._show(FLOW_ORDER.index(name))

    # --- actions --------------------------------------------------------------
    def action_nav_next(self) -> None:
        self.go_next()

    def action_nav_prev(self) -> None:
        self.go_prev()

    def action_jump(self, name: str) -> None:
        self.goto(name)

    def action_help(self) -> None:
        if isinstance(self.screen, HelpScreen):
            self.pop_screen()
        else:
            self.push_screen(HelpScreen.for_screen(self.screen))

    def action_command_bar(self) -> None:
        self.push_screen(CommandBarScreen(), self._on_command_bar)

    def _on_command_bar(self, line: Optional[str]) -> None:
        if line:                     # runs after the bar has closed
            self.run_command_line(line)

    # --- slash commands and requests --------------------------------------------
    def run_command_line(self, text: str) -> bool:
        """Run `/name [arg]`. Returns False (and warns) for an unknown command."""
        name, arg = parse(text)
        command = find(COMMANDS, name)
        if command is None:
            self.notify(f"Unknown command /{name}. Type / to see the list.",
                        severity="warning", markup=False)
            return False
        self._remember(text)
        self.run_command(command, arg)
        return True

    def run_command(self, command: Command, arg: Optional[str] = None) -> None:
        """Run a command; if it needs a choice that wasn't typed, ask with a menu."""
        if command.choices is None:
            command.run(self, arg)
            return
        choices = command.choices(self)
        if arg and arg.lower() in {c.id for c in choices}:
            command.run(self, arg.lower())
            return

        def chosen(choice_id: Optional[str]) -> None:
            if choice_id:
                command.run(self, choice_id)

        question = command.question or command.description
        self.push_screen(
            ChoiceScreen(command.description, question, choices, chip=f"/{command.name}"), chosen,
        )

    def submit_request(self, text: str) -> bool:
        """A plain-language request from a prompt; empty starts the demo request."""
        text = text.strip()
        if text:
            try:
                store.add_request(text)
            except store.StoreValidationError as exc:
                self.notify(str(exc), severity="warning", markup=False)
                return False
            self._remember(text)
        self._think("reconix is drafting the scope manifest…", lambda: self.goto("scope"))
        return True

    def _think(self, message: str, then: Callable[[], None]) -> None:
        """Let the current screen show a short spinner, then run `then`."""
        think = getattr(self.screen, "think", None)
        if self.THINKING_SECONDS <= 0 or think is None:
            then()
        else:
            think(message, self.THINKING_SECONDS, then)

    def _remember(self, text: str) -> None:
        try:
            store.add_history(text)
        except store.StoreValidationError:
            pass   # history is best-effort; the action itself already succeeded

    # --- shared actions (screens and commands) --------------------------------------
    def export_report(self, fmt: str) -> None:
        store.log_event("report.export_requested", fmt)
        self.notify(f"Export to {fmt} isn't wired in this demo.", severity="information")

    def open_chat(self, draft: str = "") -> None:
        """Leave the current question and continue in the chat prompt."""
        self.pending_prompt = draft
        self.goto("start")

    def open_finding(self, index: int) -> None:
        self.selected_finding = index
        self.goto("detail")

    def show_audit(self) -> None:
        """Read-only view of the audit trail and any feedback typed at questions."""
        events = store.list_events()
        event_rows = [
            (e.created_at.strftime("%H:%M:%S"),
             f"{e.kind} · {e.detail}" if e.detail else e.kind, theme.MUTED)
            for e in events
        ] or [("", "No actions recorded yet.", theme.DIM)]
        sections = [("Events", event_rows)]
        feedback = store.list_feedback()
        if feedback:
            sections.append(("Your feedback",
                             [(f.gate, f.text, theme.MUTED) for f in feedback]))
        self.push_screen(ChoiceScreen(
            "\u25a4 AUDIT TRAIL", "", [Choice("close", "Close")],
            body=details_body(sections), chip="Audit",
        ))

    def can_enter_execution(self) -> bool:
        return store.is_approved(store.get_pending_approval().request_id)

    def open_execution(self) -> None:
        if not self.can_enter_execution():
            self.notify("Execution starts after approval. Use /approval.", severity="warning")
            return
        self.goto("execution")


def main() -> None:
    ReconixApp().run()


if __name__ == "__main__":
    main()
