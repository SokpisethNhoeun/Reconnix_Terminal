"""APPROVAL REQUIRED (MEDIUM) and HIGH-RISK ACTION · CONFIRMATION REQUIRED (HIGH).

MEDIUM is a plain Approve / Reject. HIGH opens the store's confirmation step when the
dialog appears, and Approve stays disabled until a reason is given. The store re-checks
everything (the token and the reason); this check only drives the button state.
"""

from copy import deepcopy
from typing import Iterable, Optional

from rich.text import Text
from textual.app import ComposeResult
from textual.widgets import Button, Input, Label, Static

from ... import store, theme
from ...store.approvals import MAX_REASON_LENGTH, MIN_REASON_LENGTH, clean_reason
from ...widgets import KeyValueGrid
from .base import DialogScreen, dialog_button


class ApprovalDialog(DialogScreen):
    """Dismisses with "approved", "rejected", or None (decide later; nothing runs)."""

    def __init__(self, request_id: str) -> None:
        super().__init__()
        # A copy: what the operator approves is what was shown, even if the store's row
        # changed meanwhile (the store then refuses the hash).
        self._request = deepcopy(store.get_approval(request_id))
        self._high = self._request.risk == "HIGH"
        self._token: Optional[str] = None

    @property
    def HEADING(self) -> str:  # noqa: N802 - matches the base class attribute
        return "HIGH-RISK ACTION · CONFIRMATION REQUIRED" if self._high else "APPROVAL REQUIRED"

    @property
    def TONE(self) -> str:  # noqa: N802
        return "red" if self._high else "green"

    def tag(self) -> Optional[Text]:
        return None if self._high else Text("proposed by AI · held by policy", style=theme.MUTED)

    # --- content -------------------------------------------------------------------------------
    def compose_content(self) -> ComposeResult:
        request = self._request
        paused = ("Paused. Requires a reason, then your approval." if self._high
                  else "Paused. This action will not run without your approval.")
        yield Static(Text.assemble(theme.risk_chip(request.risk), "  ",
                                   ("■ " + paused, theme.MEDIUM)), classes="dialog-note")
        yield KeyValueGrid([
            ("Action", request.action),
            ("Target", request.target),
            ("Purpose", request.purpose),
            ("Potential impact", request.impact),
            ("Exact request", Text(request.command, style=theme.MUTED)),
        ], label_width=16, classes="dialog-grid")
        if self._high:
            yield Label("Reason", classes="field-label -warn")
            yield Static(Text("A HIGH-risk action needs a short reason before you can approve it.",
                              style=theme.DIM), classes="field-hint")
            yield Input(id="reason", placeholder="Why is this action needed?",
                        max_length=MAX_REASON_LENGTH)

    def buttons(self) -> Iterable[Button]:
        return [dialog_button("Approve", "approve", primary=True, disabled=self._high),
                dialog_button("Reject", "reject")]

    def status(self) -> Text:
        return Text("Not executed", style=theme.DIM)

    def first_focus(self):
        # HIGH starts in the reason field; MEDIUM on Reject, so Enter alone never approves.
        return self.query_one("#reason", Input) if self._high else self.query_one("#reject", Button)

    def on_mount(self) -> None:
        if self._high:
            try:
                self._token = store.request_confirmation(self._request.request_id,
                                                         self._request.command_hash)
            except store.StoreValidationError as exc:
                self.notify(str(exc), severity="warning", markup=False)
                self.dismiss(None)

    # --- the HIGH-risk reason ------------------------------------------------------------------
    def _ready(self) -> bool:
        reason = clean_reason(self.query_one("#reason", Input).value)
        return len(reason) >= MIN_REASON_LENGTH

    def on_input_changed(self, event: Input.Changed) -> None:
        event.stop()
        self.query_one("#approve", Button).disabled = not self._ready()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        event.stop()
        if self._ready():
            self.query_one("#approve", Button).focus()

    # --- decisions -------------------------------------------------------------------------------
    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        if event.button.id == "approve":
            self._approve()
        elif event.button.id == "reject":
            self._reject()

    def _approve(self) -> None:
        request = self._request
        try:
            if self._high:
                store.approve(request.request_id, command_hash=request.command_hash,
                              confirmation_token=self._token,
                              reason=self.query_one("#reason", Input).value)
            else:
                store.approve(request.request_id, command_hash=request.command_hash)
        except store.StoreValidationError as exc:
            self.show_error(str(exc))
            return
        self.dismiss("approved")

    def _reject(self) -> None:
        try:
            store.reject(self._request.request_id)
        except store.StoreValidationError as exc:
            self.show_error(str(exc))
            return
        self.dismiss("rejected")

    def on_close(self) -> None:
        if self._high:
            store.decline_confirmation(self._request.request_id)
