"""ADD A KNOWLEDGE FILE — point the AI at a reference document (a knowledge add-on)."""

from typing import Dict, List, Optional

from rich.text import Text

from ... import store, theme
from .base import FormField, FormScreen


class AddOnForm(FormScreen):
    """Dismisses with "added" once a source is saved, or None."""

    TITLE = "ADD A KNOWLEDGE FILE"
    CHIP = "Add-on"
    SUBMIT = "Add"

    def fields(self) -> List[FormField]:
        return [FormField("path", "File path", placeholder="~/docs/runbook.md")]

    def note(self) -> Optional[Text]:
        return Text(
            "Read once, passages kept on this computer (redacted), used as reference by the "
            "AI; never run.",
            style=theme.MUTED,
        )

    def footer(self) -> str:
        return "Supported: .txt .md .json .yaml .yml .docx .pdf · Esc to cancel"

    def submit(self, values: Dict[str, str]) -> Optional[str]:
        source = store.add_source(values["path"])
        self.app.notify(f"Added {source.name} — {source.chunks} passage(s).",
                        title="Add-on", markup=False)
        return "added"
