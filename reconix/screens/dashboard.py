"""The dashboard — the one main screen: assistant, status, activity log, prompt and F-keys.

Everything the run needs a human for opens as a dialog over it. The dashboard hosts the
RunController, redraws from the store after every step, and opens each gate's dialog
when the store says the run is waiting there.
"""

from typing import List, Optional

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.events import Resize
from textual.screen import Screen

from .. import store
from ..commands import COMMANDS
from ..flow import RunController
from ..models import GATE_ACCOUNT, GATE_APPROVAL_PREFIX, GATE_SCOPE, GATE_TEMPLATE
from ..widgets import (
    AssistantLog, FKeyBar, PaneToggle, PlanPanel, PromptBox, StatusPanel, TopBar,
)
from ..widgets.fkey_bar import FKey
from .dialogs import (
    ActivityDialog, ApprovalDialog, DialogScreen, FindingsDialog, ImportDialog, ReportDialog,
    ScopeEditDialog, ScopeManifestDialog, SecureInputDialog, SummaryDialog, TemplateDialog,
)

PLACEHOLDER = "Type a target (URL, IPv4, repo or path), a question, or /template."


class DashboardScreen(Screen):
    mode_name = "DASHBOARD"
    NARROW = 120          # below this width the side column stacks under the assistant

    BINDINGS = [
        Binding("f2", "findings", "findings", key_display="F2"),
        Binding("f3", "scope", "scope manifest", key_display="F3"),
        Binding("f4", "activity", "activity log", key_display="F4"),
        Binding("f5", "report", "generate report", key_display="F5"),
        Binding("f6", "assessments", "assessments", key_display="F6"),
        Binding("f7", "toggle_side", "toggle the status/plan pane", key_display="F7"),
        Binding("escape", "focus_prompt", "back to the prompt", show=False),
    ]

    def __init__(self) -> None:
        super().__init__()
        self.controller = RunController(self)
        self._gate_on_screen = ""     # the gate whose dialog is open, if any
        self._deferred_gate = ""      # a gate that arrived while another dialog was open
        self._save_warned = False     # warn about a failed save once, not on every redraw

    def compose(self) -> ComposeResult:
        with Horizontal(id="top"):
            yield TopBar(id="top-bar")
            yield PaneToggle(id="pane-toggle")
        with Horizontal(id="main"):
            yield AssistantLog(id="assistant")
            with Vertical(id="side"):
                yield StatusPanel(id="status")
                yield PlanPanel(id="plan")
        yield PromptBox(COMMANDS, store.list_history, placeholder=PLACEHOLDER, id="prompt-box")
        yield FKeyBar(self._fkeys(), id="fkeys")

    def on_mount(self) -> None:
        self.query_one(PromptBox).focus_input()
        self.set_interval(1.0, self._tick)
        # A reopened assessment that was playing between gates must keep going; a gate it
        # stopped at reopens on Enter (or F3 for scope).
        if store.get_run().started and not store.is_finished() and not store.waiting_gate():
            self.controller.resume()

    def on_unmount(self) -> None:
        self.controller.stop()
        store.autosave()

    def on_resize(self, event: Resize) -> None:
        self.set_class(event.size.width < self.NARROW, "-narrow")

    def _tick(self) -> None:
        if store.get_run().started and not store.is_finished():
            self.query_one(StatusPanel).tick()
            self.query_one(PlanPanel).tick()

    # --- RunHost: what the controller calls ----------------------------------------------------
    def refresh_view(self) -> None:
        self.query_one(TopBar).refresh_line()
        self.query_one(AssistantLog).sync()
        self.query_one(StatusPanel).refresh_view()
        self.query_one(PlanPanel).refresh_view()
        self.query_one(FKeyBar).set_keys(self._fkeys())
        self._save()

    def _save(self) -> None:
        """Keep the saved copy the web dashboard reads in step (the store skips no-ops)."""
        if not store.autosave() and not self._save_warned:
            self._save_warned = True
            self.notify("Couldn't save this assessment for the web dashboard. "
                        "Check that ~/.reconix/assessments is writable.",
                        title="Not saved", severity="warning")

    def open_gate(self, gate: str) -> None:
        """Show the dialog for `gate`, if the run is really waiting there right now."""
        if self._gate_on_screen or not self._waiting_at(gate):
            return
        if self.app.screen is not self:
            # Another dialog (say, Findings) is open: open this one when it closes.
            self._deferred_gate = gate
            return
        self._deferred_gate = ""
        self._gate_on_screen = gate
        self.app.push_screen(self._gate_dialog(gate),
                             lambda result: self._gate_closed(gate, result))

    def on_screen_resume(self) -> None:
        if self._deferred_gate:
            self.open_gate(self._deferred_gate)

    def run_failed(self, message: str) -> None:
        self.notify(message, title="The run stopped", severity="error", markup=False)

    def run_finished(self) -> None:
        self.refresh_view()
        if store.is_completed():
            self.notify("Assessment complete. Press F5 to generate the report.",
                        title="Reconix")

    # --- gates ------------------------------------------------------------------------------------
    def _waiting_at(self, gate: str) -> bool:
        """The run waits at `gate` and no steps are queued (a decided gate can linger
        in `waiting_gate` until the controller's next step plays)."""
        return bool(gate) and store.waiting_gate() == gate and not self.controller.busy

    @staticmethod
    def _gate_dialog(gate: str) -> DialogScreen:
        if gate == GATE_TEMPLATE:
            return TemplateDialog()
        if gate == GATE_SCOPE:
            return ScopeManifestDialog()
        if gate == GATE_ACCOUNT:
            return SecureInputDialog()
        return ApprovalDialog(gate[len(GATE_APPROVAL_PREFIX):])

    def _gate_closed(self, gate: str, result: Optional[str]) -> None:
        self._gate_on_screen = ""
        self.refresh_view()
        if result == "edit":
            self.app.push_screen(ScopeEditDialog(), self._scope_edited)
            return
        if result is None:
            self.notify("Nothing runs until you decide. Press Enter on an empty prompt "
                        "to continue.", title="Paused")
            return
        self.controller.resume()

    def _scope_edited(self, result: Optional[str]) -> None:
        self.refresh_view()
        self.open_gate(GATE_SCOPE)       # back to the manifest for approval

    # --- the prompt -------------------------------------------------------------------------------
    def submit(self, text: str) -> bool:
        """Handle a typed line. True when it was accepted (the prompt then clears).

        Before a run the store reads it: a target starts the run (an empty line uses the
        demo request), anything else gets a short answer. At a gate an empty line reopens
        the gate's dialog. Otherwise the text goes to the assistant.
        """
        text = text.strip()
        if store.get_run().started and not text:
            self.open_gate(store.waiting_gate())
            return True
        try:
            result = store.submit_prompt(text or store.DEMO_REQUEST)
        except store.StoreValidationError as exc:
            self.notify(str(exc), severity="warning", markup=False)
            return False
        self.refresh_view()
        if result == "started":
            self.controller.resume()
        return True

    def start(self, text: str, template_id: str) -> bool:
        """Start the run on `text` with the template picked by /template."""
        try:
            store.start_run(text, template_id)
        except store.StoreValidationError as exc:
            self.notify(str(exc), severity="warning", markup=False)
            return False
        self.refresh_view()
        self.controller.resume()
        return True

    def on_prompt_box_submitted(self, event: PromptBox.Submitted) -> None:
        event.stop()
        if self.app.submit_request(event.text):
            event.box.clear()

    def on_prompt_box_command_submitted(self, event: PromptBox.CommandSubmitted) -> None:
        event.stop()
        if self.app.run_command_line(event.text):
            event.box.clear()

    def action_focus_prompt(self) -> None:
        self.query_one(PromptBox).focus_input()

    # --- F-keys and the dialogs behind them -------------------------------------------------------
    @staticmethod
    def _fkeys() -> List[FKey]:
        return [("F2", "Findings", True), ("F3", "Scope", True), ("F4", "Activity", True),
                ("F5", "Generate Report", store.is_completed()), ("F6", "Assessments", True),
                ("F7", "Panel", True)]

    def action_toggle_side(self) -> None:
        """Open or close the right (status + plan) pane; the assistant fills the width."""
        collapsed = not self.has_class("-side-collapsed")
        self.set_class(collapsed, "-side-collapsed")
        self.query_one(PaneToggle).set_collapsed(collapsed)

    def action_findings(self, fid: Optional[str] = None) -> None:
        self.app.push_screen(FindingsDialog(fid), self._findings_closed)

    def _findings_closed(self, result: Optional[str]) -> None:
        if result == "import":
            self.app.push_screen(ImportDialog(), lambda _r: self.refresh_view())

    def action_import(self) -> None:
        self.app.push_screen(ImportDialog(), lambda _r: self.refresh_view())

    def action_scope(self) -> None:
        if self._waiting_at(GATE_SCOPE):
            self.open_gate(GATE_SCOPE)       # still waiting: show it for approval
        elif store.get_scope() is None:
            self.notify("No scope yet — start an assessment and pick a template first.",
                        severity="warning")
        else:
            self.app.push_screen(ScopeManifestDialog(read_only=True))

    def action_activity(self) -> None:
        self.app.push_screen(ActivityDialog())

    def action_assessments(self) -> None:
        self.app.open_assessments()

    def action_report(self) -> None:
        if not store.is_completed():
            self.notify("The report is available once the assessment is complete.",
                        severity="warning")
            return
        self.app.push_screen(ReportDialog(), self._report_closed)

    def _report_closed(self, path: Optional[str]) -> None:
        self.refresh_view()
        if path:
            self.app.push_screen(SummaryDialog())

    def open_summary(self) -> None:
        self.app.push_screen(SummaryDialog())
