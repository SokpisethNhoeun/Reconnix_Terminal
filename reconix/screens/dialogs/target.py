"""NEW ASSESSMENT — type the target for the template picked with /template.

The store checks the target against that template (an IPv4 address or range for Network,
a URL for Web URL and API, a git repo URL or a local path for Source Code) before the
dialog closes. The dashboard then starts the run, which goes straight to the Scope
Manifest gate: picking the template here never skips the scope approval.
"""

from typing import Iterable

from rich.text import Text
from textual.app import ComposeResult
from textual.widgets import Button, Input, Label, Static

from ... import store, theme
from .base import DialogScreen, dialog_button


class TargetDialog(DialogScreen):
    """Dismisses with the target text once the store accepts it, or None (Esc / Cancel)."""

    HEADING = "NEW ASSESSMENT"
    TONE = "cyan"

    def __init__(self, template_id: str) -> None:
        super().__init__()
        self._template = store.get_template(template_id)

    @property
    def template_id(self) -> str:
        return self._template.id

    def tag(self) -> Text:
        return theme.chip(self._template.name.upper())

    def compose_content(self) -> ComposeResult:
        template = self._template
        yield Static(Text(f"{template.name}: {template.description}.", style=theme.MUTED),
                     classes="dialog-note")
        yield Label(Text(f"Target — {template.target_hint}"), classes="field-label")
        yield Input(placeholder=template.example, id="target")
        error = Static("", id="target-error", classes="dialog-note")
        error.display = False                       # shown with the store's first error
        yield error
        if store.get_run().started:
            yield Static(Text("This starts a new assessment; the current one stays under F6.",
                              style=theme.DIM), classes="dialog-note")

    def buttons(self) -> Iterable[Button]:
        return [dialog_button("Cancel", "cancel"),
                dialog_button("Start", "start", primary=True)]

    def status(self) -> Text:
        return Text("You approve the scope before any testing", style=theme.MUTED)

    def first_focus(self):
        return self.query_one("#target", Input)

    def show_error(self, message: str) -> None:
        # "Source Code needs … — e.g. …" is too long for the button row: give it a line.
        error = self.query_one("#target-error", Static)
        error.update(Text(message, style=theme.CRITICAL))
        error.display = True

    def _start(self) -> None:
        value = self.query_one("#target", Input).value
        try:
            store.check_target(self._template.id, value)
        except store.StoreValidationError as exc:
            self.show_error(str(exc))
            return
        self.dismiss(value)

    def on_input_submitted(self, event: Input.Submitted) -> None:
        event.stop()
        self._start()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        if event.button.id == "start":
            self._start()
        else:
            self.dismiss(None)
