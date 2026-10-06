"""FINDINGS — the table, and the details of the highlighted finding under it."""

from functools import partial
from typing import Iterable, Optional

from rich.panel import Panel as RichPanel
from rich.text import Text
from textual.app import ComposeResult
from textual.widgets import Button, DataTable, Static

from ... import store, theme
from ...models import Choice, Finding
from ...widgets import KeyValueGrid, Panel
from ..choice import ChoiceScreen
from .base import DialogScreen, dialog_button

STATUS_TONE = {"fixed": ("FIXED", "green"), "accepted": ("ACCEPTED", "amber"),
               "false-positive": ("FALSE+", "red")}


def validation_cell(finding: Finding) -> Text:
    if not finding.needs_review:
        return Text("✓ Confirmed", style=f"bold {theme.GREEN}")
    label = finding.validation.capitalize()
    color = theme.MEDIUM if finding.validation == "UNCONFIRMED" else theme.MUTED
    return Text.assemble((f"? {label} ", f"bold {color}"), theme.chip("REVIEW", "amber"))


def status_cell(finding: Finding) -> Text:
    tone = STATUS_TONE.get(finding.status)
    return theme.chip(*tone) if tone else Text("· Open", style=theme.MUTED)


def detail_rows(finding: Finding):
    evidence = RichPanel(Text("\n".join(finding.evidence), style=theme.MUTED),
                         border_style=theme.BORDER_STR, padding=(0, 1), expand=True)
    cvss = f"{finding.cvss_score:.1f}" if finding.cvss_score else "—"
    return [
        ("Status", status_cell(finding)),
        ("Severity", Text(f"{finding.severity} · CVSS {cvss}", style=theme.MEDIUM)),
        ("Category", finding.category or "—"),
        ("Description", finding.description),
        ("Affected URL", Text(finding.affected_url, style=theme.CYAN)),
        ("Evidence", evidence),
        ("Impact", Text(finding.impact, style=theme.MEDIUM)),
        ("References", " · ".join(finding.references)),
        ("Remediation", Text(finding.remediation, style=theme.GREEN)),
    ]


class FindingsDialog(DialogScreen):
    TONE = "cyan"

    def __init__(self, fid: Optional[str] = None) -> None:
        super().__init__()
        self._findings = store.list_findings()
        self._start = fid

    @property
    def HEADING(self) -> str:  # noqa: N802 - matches the base class attribute
        return f"FINDINGS · {store.assessment_label() or 'not assigned'}"

    def tag(self) -> Text:
        count = len(self._findings)
        return Text(f"{count} finding{'' if count == 1 else 's'}", style=theme.MUTED)

    def compose_content(self) -> ComposeResult:
        if not self._findings:
            yield Static(Text("No findings yet. They appear here as testing finds them.",
                              style=theme.MUTED), classes="dialog-note")
            return
        table = DataTable(id="findings-table", cursor_type="row", zebra_stripes=False)
        table.add_columns("ID", "SEVERITY", "FINDING", "STATUS", "VALIDATION")
        self._add_rows(table)
        yield table
        with Panel(id="finding-detail", classes="finding-detail"):
            yield KeyValueGrid(label_width=13, id="finding-grid")

    def _add_rows(self, table: DataTable) -> None:
        for finding in self._findings:
            # Every cell is Text: DataTable would parse a plain str as markup.
            table.add_row(Text(finding.fid), theme.severity_chip(finding.severity),
                          Text(finding.title), status_cell(finding),
                          validation_cell(finding), key=finding.fid)

    def buttons(self) -> Iterable[Button]:
        triage = dialog_button("Triage ▸", "triage", disabled=not self._findings)
        return [triage, dialog_button("Import…", "import"), dialog_button("Close", "close")]

    def status(self) -> Text:
        return Text("↑/↓ choose · Triage to set status · Esc to close", style=theme.DIM)

    def first_focus(self):
        tables = self.query(DataTable)
        return tables.first() if tables else self.query_one("#close", Button)

    def on_mount(self) -> None:
        if not self._findings:
            return
        table = self.query_one(DataTable)
        ids = [f.fid for f in self._findings]
        if self._start in ids:
            table.move_cursor(row=ids.index(self._start))
        self._show(ids[table.cursor_row])

    def on_data_table_row_highlighted(self, event: DataTable.RowHighlighted) -> None:
        event.stop()
        if event.row_key.value is not None:
            self._show(event.row_key.value)

    def _show(self, fid: str) -> None:
        finding = store.get_finding(fid)
        detail = self.query_one("#finding-detail", Panel)
        confirmed = not finding.needs_review
        color = theme.TEAL if confirmed else theme.MEDIUM
        detail.set_color(color)
        detail.set_title(Text(f"FINDING {finding.fid} · {finding.title.upper()}",
                              style=f"bold {color}"))
        detail.set_tag(theme.chip("CONFIRMED", "green") if confirmed
                       else theme.chip("NEEDS REVIEW", "amber"))
        self.query_one("#finding-grid", KeyValueGrid).set_rows(detail_rows(finding))

    def _highlighted_fid(self) -> Optional[str]:
        if not self._findings:
            return None
        table = self.query_one(DataTable)
        row = max(0, min(table.cursor_row, len(self._findings) - 1))
        return self._findings[row].fid

    def _open_triage(self) -> None:
        fid = self._highlighted_fid()
        if fid is None:
            return
        finding = store.get_finding(fid)
        choices = [Choice(key, store.TRIAGE_LABELS[key], "") for key in store.TRIAGE_STATUS]
        current = store.TRIAGE_STATUS.index(finding.status) if finding.status in \
            store.TRIAGE_STATUS else 0
        self.app.push_screen(
            ChoiceScreen(f"TRIAGE · {fid}", f"Set the status of finding {fid}:", choices,
                         default=current, chip="Triage"),
            partial(self._apply_triage, fid))

    def _apply_triage(self, fid: str, status: Optional[str]) -> None:
        if not status:
            return
        store.triage_finding(fid, status=status)
        self._findings = store.list_findings()
        table = self.query_one(DataTable)
        table.clear()
        self._add_rows(table)
        ids = [f.fid for f in self._findings]
        if fid in ids:
            table.move_cursor(row=ids.index(fid))
        self._show(fid)

    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        if event.button.id == "triage":
            self._open_triage()
        else:
            self.dismiss("import" if event.button.id == "import" else None)
