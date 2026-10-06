"""EDIT SCOPE — change the drafted manifest before it is approved.

The constraints are edited as comma-separated lists and a number; the target itself is
fixed for the assessment. The store validates every field and the policy engine then
enforces exactly what was approved.
"""

from typing import Iterable, List

from rich.text import Text
from textual.app import ComposeResult
from textual.widgets import Button, Input, Label, Static

from ... import store, theme
from .base import DialogScreen, dialog_button


def _csv(values: List) -> str:
    return ", ".join(str(v) for v in values)


def _split(text: str) -> List[str]:
    return [part.strip() for part in text.split(",") if part.strip()]


class ScopeEditDialog(DialogScreen):
    """Dismisses with "edited" once the manifest is updated, or None."""

    HEADING = "EDIT SCOPE"
    TONE = "amber"

    def __init__(self) -> None:
        super().__init__()
        self._scope = store.get_scope()
        self._network = self._scope.kind == "network"

    def compose_content(self) -> ComposeResult:
        scope = self._scope
        yield Static(Text(f"Target {scope.target_url} — fixed for this assessment. Edit the "
                          "limits below; commas separate list items.", style=theme.MUTED),
                     classes="dialog-note")
        yield Label("Allowed methods", classes="field-label")
        yield Input(value=_csv(scope.allowed_methods), id="methods")
        yield Label("Excluded paths", classes="field-label")
        yield Input(value=_csv(scope.excluded_paths), id="excluded",
                    placeholder="none" if not scope.excluded_paths else "")
        if self._network:
            yield Label("Allowed ports", classes="field-label")
            yield Input(value=_csv(scope.allowed_ports), id="ports")
        yield Label("Tools", classes="field-label")
        yield Input(value=_csv(scope.tools), id="tools")
        yield Label("Time limit (minutes)", classes="field-label")
        yield Input(value=str(scope.time_limit_minutes), id="time-limit")

    def buttons(self) -> Iterable[Button]:
        return [dialog_button("Cancel", "cancel"),
                dialog_button("Save Scope", "save", primary=True)]

    def status(self) -> Text:
        return Text("Saved changes go back to the manifest for approval", style=theme.MUTED)

    def first_focus(self):
        return self.query_one("#methods", Input)

    def _value(self, field_id: str) -> str:
        return self.query_one(f"#{field_id}", Input).value

    def _save(self) -> None:
        changes = dict(
            allowed_methods=_split(self._value("methods")),
            excluded_paths=_split(self._value("excluded")),
            tools=_split(self._value("tools")),
            time_limit_minutes=self._value("time-limit").strip(),
        )
        if self._network:
            changes["allowed_ports"] = _split(self._value("ports"))
        try:
            store.edit_scope(**changes)
        except store.StoreValidationError as exc:
            self.show_error(str(exc))
            return
        self.dismiss("edited")

    def on_input_submitted(self, event: Input.Submitted) -> None:
        event.stop()
        self._save()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        if event.button.id == "save":
            self._save()
        else:
            self.dismiss(None)
