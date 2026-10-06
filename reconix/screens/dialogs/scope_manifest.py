"""SCOPE MANIFEST · REVIEW — nothing is tested until the operator approves it."""

from typing import Iterable

from rich.text import Text
from textual.app import ComposeResult
from textual.widgets import Button, Static

from ... import store, theme
from ...widgets import KeyValueGrid
from .base import DialogScreen, dialog_button


def manifest_rows():
    scope = store.get_scope()
    excluded = Text()
    for i, path in enumerate(scope.excluded_paths):
        if i:
            excluded.append("  ")
        excluded.append(f"× {path}", style=theme.CRITICAL)
    return [
        ("Target", Text(scope.target_url, style=theme.CYAN)),
        ("Assessment", scope.assessment_type),
        ("Allowed actions", ", ".join(scope.allowed_actions)),
        ("Allowed methods", ", ".join(scope.allowed_methods)),
        ("Excluded path" if len(scope.excluded_paths) == 1 else "Excluded paths", excluded),
        ("Time limit", f"{scope.time_limit_minutes} minutes"),
        ("Tools", ", ".join(scope.tools)),
    ]


class ScopeManifestDialog(DialogScreen):
    """Review mode dismisses with "approved", "edit" or None. `read_only` only shows it (F3)."""

    HEADING = "SCOPE MANIFEST · REVIEW"

    def __init__(self, read_only: bool = False) -> None:
        super().__init__()
        self._read_only = read_only
        self._approved = store.is_scope_approved()

    @property
    def TONE(self) -> str:  # noqa: N802 - matches the base class attribute
        return "green" if self._approved else "amber"

    def tag(self) -> Text:
        return theme.chip("APPROVED", "green") if self._approved else theme.chip("DRAFT", "amber")

    def compose_content(self) -> ComposeResult:
        yield Static(Text("Prepared by the AI Assistant. No testing begins until this scope "
                          "is approved.", style=theme.MUTED), classes="dialog-note")
        yield KeyValueGrid(manifest_rows(), label_width=16, classes="dialog-grid")

    def buttons(self) -> Iterable[Button]:
        if self._read_only:
            return [dialog_button("Close", "close")]
        return [dialog_button("Edit Scope", "edit"),
                dialog_button("Approve Scope", "approve", primary=True)]

    def status(self) -> Text:
        if self._approved:
            return Text("✓ Approved · enforced", style=theme.GREEN)
        return Text("● Testing paused until approval", style=theme.MEDIUM)

    def first_focus(self):
        # The safe choice has focus: Enter alone never approves the scope.
        return self.query_one("#close" if self._read_only else "#edit", Button)

    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        if event.button.id == "close":
            self.dismiss(None)
        elif event.button.id == "edit":
            self.dismiss("edit")
        elif event.button.id == "approve":
            try:
                store.approve_scope()
            except store.StoreValidationError as exc:
                self.show_error(str(exc))
                return
            self.dismiss("approved")
