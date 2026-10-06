"""IMPORT FINDINGS — load real tool output (nuclei / nmap / ZAP) into the assessment."""

from typing import Dict, List, Optional

from rich.text import Text

from ... import store, theme
from .base import FormField, FormScreen


class ImportForm(FormScreen):
    """Dismisses with "imported" once findings are added, or None."""

    TITLE = "⇣ IMPORT FINDINGS"
    CHIP = "Import"
    SUBMIT = "Import"

    def fields(self) -> List[FormField]:
        return [FormField("path", "File path", placeholder="~/scans/nuclei.jsonl")]

    def note(self) -> Optional[Text]:
        return Text("Add findings from a tool output file. Supported: nuclei (JSONL), nmap "
                    "(XML, -oX), OWASP ZAP (JSON). The file is only read, never run.",
                    style=theme.MUTED)

    def footer(self) -> str:
        return "Findings are added to the current assessment · Esc to cancel"

    def submit(self, values: Dict[str, str]) -> Optional[str]:
        tool, count = store.import_findings(values["path"])
        self.app.notify(f"Imported {count} finding(s) from {tool} output.", title="Import",
                        markup=False)
        return "imported"
