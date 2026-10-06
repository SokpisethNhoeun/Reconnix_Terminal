"""ACTIVITY — the full activity log, plus the operator's audit trail and feedback."""

from typing import Iterable, List, Tuple

from rich.table import Table
from rich.text import Text
from textual.app import ComposeResult
from textual.containers import VerticalScroll
from textual.widgets import Button, Static

from ... import store, theme
from ...widgets import activity_row
from .base import DialogScreen, dialog_button


def audit_table(rows: List[Tuple[str, str, str]]) -> Table:
    grid = Table.grid(padding=(0, 2))
    grid.add_column(style=theme.DIM, no_wrap=True)
    grid.add_column(style=theme.VIOLET, no_wrap=True)
    grid.add_column(style=theme.MUTED)
    for time, kind, detail in rows:
        grid.add_row(time, kind, Text(detail))
    if not rows:
        grid.add_row("", "", Text("No operator actions recorded yet."))
    return grid


class AuditTable(Static):
    """The audit trail as a grid; `rows` keeps (time, kind, detail) for reading back."""

    def __init__(self) -> None:
        events = store.list_events()
        self.rows = [(e.created_at.astimezone().strftime("%H:%M:%S"), e.kind, e.detail)
                     for e in events]
        super().__init__(audit_table(self.rows), id="audit-table")


class ActivityDialog(DialogScreen):
    HEADING = "ACTIVITY"
    TONE = "cyan"

    def tag(self) -> Text:
        rows, events = len(store.list_activity()), len(store.list_events())
        return Text(f"{rows} rows · {events} audit events", style=theme.MUTED)

    def compose_content(self) -> ComposeResult:
        with VerticalScroll(id="activity-body", classes="dialog-body"):
            yield Static(Text("Activity log", style=f"bold {theme.TEXT}"))
            yield from (activity_row(entry) for entry in store.list_activity())
            yield Static(Text("\nAudit trail", style=f"bold {theme.TEXT}"))
            yield AuditTable()
            feedback = store.list_feedback()
            if feedback:
                yield Static(Text("\nYour feedback", style=f"bold {theme.TEXT}"))
                for item in feedback:
                    yield Static(Text.assemble((f"{item.gate:<10}", theme.DIM),
                                               (item.text, theme.MUTED)))

    def buttons(self) -> Iterable[Button]:
        return [dialog_button("Close", "close")]

    def status(self) -> Text:
        return Text("↑/↓ or PgUp/PgDn to scroll · Esc to close", style=theme.DIM)

    def first_focus(self):
        return self.query_one("#activity-body", VerticalScroll)

    def on_mount(self) -> None:
        self.query_one("#activity-body", VerticalScroll).scroll_end(animate=False)

    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        self.dismiss(None)
