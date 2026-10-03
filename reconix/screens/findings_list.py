"""Frame 06 — Findings list (filterable, sortable, arrow-key selectable table)."""

from typing import Optional

from rich.text import Text
from textual.app import ComposeResult
from textual.binding import Binding
from textual.widgets import DataTable, Static
from textual.widgets.data_table import RowDoesNotExist

from .base import ReconixScreen
from .choice import ChoiceScreen
from .. import store, theme
from ..models import Choice


class FindingsListScreen(ReconixScreen):
    flow_name = "findings"
    mode_name = "FINDINGS"

    BINDINGS = [
        Binding("enter", "open", "open finding"),
        Binding("f", "filter", "filter"),
        Binding("s", "sort", "sort"),
        Binding("escape", "back", "back", show=False),
    ]

    def compose_body(self) -> ComposeResult:
        findings = store.list_findings()
        counts = store.severity_counts()
        confirmed = store.confirmed_count()
        yield Static(
            f"[{theme.CYAN}]◆ reconix[/] [{theme.DIM}]assessment complete · "
            f"{len(findings)} findings · {confirmed} confirmed[/]",
            classes="ai-label", markup=True,
        )
        strip = "   ".join(
            f"[{theme.SEVERITY[s]}]■ {s}[/] [{theme.TEXT}][b]{counts[s]}[/b][/]"
            for s in store.SEVERITY_ORDER
        )
        yield Static(strip, id="sev-strip", markup=True)
        yield Static(id="view-line", classes="muted", markup=True)
        table = DataTable(id="findings-table", cursor_type="row", zebra_stripes=True)
        table.add_columns("#", "SEVERITY", "TITLE", "TARGET / COMPONENT", "TOOL", "CVE / CWE", "STATUS")
        yield table
        yield Static(
            f"[{theme.MUTED}]No findings match this filter — press [/]"
            f"[{theme.TEXT}][b]f[/b][/][{theme.MUTED}] to change it.[/]",
            id="findings-empty", classes="panel-note", markup=True,
        )
        yield Static(
            f"[{theme.DIM}]↑/↓ select · ↵ open · f filter · s sort · → report[/]",
            markup=True, classes="muted",
        )

    def on_mount(self) -> None:
        self._fill(keep=str(self.app.selected_finding))

    # --- table ------------------------------------------------------------------------
    def _fill(self, keep: Optional[str] = None) -> None:
        """Rebuild rows for the current filter and sort, keeping the cursor on `keep`."""
        table = self.query_one("#findings-table", DataTable)
        if keep is None:
            keep = self._cursor_key()
        table.clear()
        rows = store.find_findings(self.app.findings_filter, self.app.findings_sort)
        for index, f in rows:
            sev = Text(f"■ {f.severity}", style=f"bold {theme.SEVERITY[f.severity]}")
            scolor, sglyph = theme.STATUS.get(f.status, (theme.MUTED, "○"))
            table.add_row(
                str(index + 1), sev, f.title, f.target, Text(f.tool, style=theme.TEAL),
                Text(f.ref, style=theme.KEY), Text(f"{sglyph} {f.status}", style=f"bold {scolor}"),
                key=str(index),
            )
        table.display = bool(rows)
        self.query_one("#findings-empty", Static).display = not rows
        self.query_one("#view-line", Static).update(
            f"[{theme.DIM}]filter:[/] [{theme.TEAL}]{store.filter_label(self.app.findings_filter)}[/]"
            f"[{theme.DIM}]  ·  sort:[/] [{theme.TEAL}]{store.sort_label(self.app.findings_sort)}[/]"
            f"[{theme.DIM}]  ·  showing {len(rows)} of {len(store.list_findings())}[/]"
        )
        if rows:
            self._move_to(keep)
            table.focus()

    def _cursor_key(self) -> Optional[str]:
        table = self.query_one("#findings-table", DataTable)
        if table.row_count == 0:
            return None
        return table.coordinate_to_cell_key(table.cursor_coordinate).row_key.value

    def _move_to(self, key: Optional[str]) -> None:
        table = self.query_one("#findings-table", DataTable)
        for candidate in (key, str(self.app.selected_finding)):
            if candidate is None:
                continue
            try:
                table.move_cursor(row=table.get_row_index(candidate))
                return
            except RowDoesNotExist:
                continue
        table.move_cursor(row=0)

    # --- actions ----------------------------------------------------------------------
    def action_open(self) -> None:
        key = self._cursor_key()
        if key is not None:
            self.app.open_finding(int(key))

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        if event.row_key.value is not None:
            self.app.open_finding(int(event.row_key.value))

    def action_filter(self) -> None:
        counts = store.filter_counts()
        ids = [fid for fid, _ in store.FINDING_FILTERS]
        current = self.app.findings_filter
        choices = [
            Choice(fid, f"{label} · {counts[fid]}" + ("  (current)" if fid == current else ""))
            for fid, label in store.FINDING_FILTERS
        ]

        def answer(filter_id: Optional[str]) -> None:
            if filter_id:
                self.app.findings_filter = filter_id
                self._fill()

        self.app.push_screen(ChoiceScreen(
            "Filter findings", "Show which findings?", choices,
            default=ids.index(current), chip="Filter",
        ), answer)

    def action_sort(self) -> None:
        ids = [sid for sid, _ in store.FINDING_SORTS]
        self.app.findings_sort = ids[(ids.index(self.app.findings_sort) + 1) % len(ids)]
        self._fill()

    def action_back(self) -> None:
        self.app.go_prev()
