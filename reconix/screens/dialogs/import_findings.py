"""IMPORT FINDINGS — load real tool output (nuclei / nmap / ZAP) into the assessment."""

from typing import Iterable

from rich.text import Text
from textual.app import ComposeResult
from textual.widgets import Button, Input, Label, Static

from ... import store, theme
from .base import DialogScreen, dialog_button


class ImportDialog(DialogScreen):
    """Dismisses with "imported" once findings are added, or None."""

    HEADING = "IMPORT FINDINGS"
    TONE = "cyan"

    def compose_content(self) -> ComposeResult:
        yield Static(Text("Add findings from a tool output file. Supported: nuclei (JSONL), "
                          "nmap (XML, -oX), OWASP ZAP (JSON). The file is only read.",
                          style=theme.MUTED), classes="dialog-note")
        yield Label("File path", classes="field-label")
        yield Input(id="path", placeholder="~/scans/nuclei.jsonl")

    def buttons(self) -> Iterable[Button]:
        return [dialog_button("Cancel", "cancel"), dialog_button("Import", "import", primary=True)]

    def status(self) -> Text:
        return Text("Findings are added to the current assessment", style=theme.MUTED)

    def first_focus(self):
        return self.query_one("#path", Input)

    def _import(self) -> None:
        try:
            tool, count = store.import_findings(self.query_one("#path", Input).value)
        except store.StoreValidationError as exc:
            self.show_error(str(exc))
            return
        self.notify(f"Imported {count} finding(s) from {tool} output.", title="Import")
        self.dismiss("imported")

    def on_input_submitted(self, event: Input.Submitted) -> None:
        event.stop()
        self._import()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        if event.button.id == "import":
            self._import()
        else:
            self.dismiss(None)
