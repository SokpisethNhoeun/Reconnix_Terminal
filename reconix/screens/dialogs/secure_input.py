"""SECURE INPUT — the target login a step needs: a cookie, email + password, or a code.

The fields come from the challenge the run raised. Secret fields are masked and kept out
of the clipboard; a one-time code is validated and used once, never stored. Secrets are
wrapped in `Secret` as they leave the inputs, and every field is cleared on close.
"""

from typing import Iterable, List

from rich.text import Text
from textual.app import ComposeResult
from textual.widgets import Button, Input, Label, Static

from ... import store, theme
from ...models import AuthField, Secret
from ...widgets import SecretInput
from .base import DialogScreen, dialog_button

CODE_TONE = {"otp": "amber", "password+otp": "amber", "cookie": "violet", "password": "violet"}


class SecureInputDialog(DialogScreen):
    """Dismisses with "saved" once the login is accepted, or None."""

    HEADING = "SECURE INPUT"

    def __init__(self) -> None:
        super().__init__()
        self._challenge = store.current_auth_challenge()
        self.HEADING = self._challenge.title
        self.TONE = CODE_TONE.get(self._challenge.kind, "violet")

    def tag(self) -> Text:
        if self._challenge.kind == "otp":
            return theme.chip("NOT STORED", "amber")
        return theme.chip("SESSION VAULT", "violet")

    def _fields(self) -> List[AuthField]:
        return list(self._challenge.fields)

    def compose_content(self) -> ComposeResult:
        yield Static(Text(self._challenge.note, style=theme.MUTED), classes="dialog-note")
        for field in self._fields():
            yield Label(field.label + ("  (used once, not stored)" if field.otp else ""),
                        classes="field-label" + (" -warn" if field.otp else ""))
            if field.secret:
                yield SecretInput(id=field.id, max_length=4096)
            elif field.otp:
                yield Input(id=field.id, max_length=6, placeholder=field.placeholder,
                            type="integer")
            else:
                yield Input(id=field.id, max_length=64, placeholder=field.placeholder)

    def buttons(self) -> Iterable[Button]:
        label = "Submit code" if self._challenge.kind == "otp" else "Save login"
        return [dialog_button(label, "save", primary=True)]

    def status(self) -> Text:
        return Text(f"Scope: {store.get_assessment().target} only", style=theme.MUTED)

    def first_focus(self):
        return self.query_one(f"#{self._fields()[0].id}", Input)

    def _collect(self):
        values = {}
        for field in self._fields():
            widget = self.query_one(f"#{field.id}", Input)
            values[field.id] = Secret(widget.value) if field.secret else widget.value
        return values

    def _clear(self) -> None:
        for field in self._fields():
            self.query_one(f"#{field.id}", Input).value = ""

    def _save(self) -> None:
        try:
            store.provide_auth(self._collect())
        except store.StoreValidationError as exc:
            self.show_error(str(exc))
            return
        except Exception:   # e.g. a backend outage: never let it surface with the secret
            self._clear()
            self.show_error("Couldn't save the login. Try again.")
            return
        self._clear()
        self.dismiss("saved")

    def on_input_submitted(self, event: Input.Submitted) -> None:
        event.stop()
        fields = self._fields()
        ids = [f.id for f in fields]
        i = ids.index(event.input.id)
        if i + 1 < len(ids):
            self.query_one(f"#{ids[i + 1]}", Input).focus()
        else:
            self._save()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        self._save()

    def on_close(self) -> None:
        self._clear()
