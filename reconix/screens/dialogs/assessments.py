"""ASSESSMENTS — the session's assessments: start a new one, or reopen a past one."""

from typing import Iterable

from rich.text import Text
from textual.app import ComposeResult
from textual.widgets import Button, DataTable, Static

from ... import store, theme
from .base import DialogScreen, dialog_button

STATUS_TONE = {"Completed": "green", "Stopped": "red", "Running": "cyan",
               "Awaiting input": "amber", "New": "muted"}


class AssessmentsDialog(DialogScreen):
    """Dismisses with "new", an assessment index (as a str), or None."""

    HEADING = "ASSESSMENTS"
    TONE = "cyan"

    def tag(self) -> Text:
        n = len(store.list_assessments())
        return Text(f"{n} this session", style=theme.MUTED)

    def compose_content(self) -> ComposeResult:
        yield Static(Text("Everything is kept in memory for this session only.",
                          style=theme.MUTED), classes="dialog-note")
        table = DataTable(id="assessments-table", cursor_type="row", zebra_stripes=False)
        table.add_columns("", "Assessment", "Target", "Template", "Status", "Findings")
        for card in store.list_assessments():
            marker = Text("●", style=theme.CYAN) if card.current else Text(" ")
            status = theme.chip(card.status, STATUS_TONE.get(card.status, "muted"))
            yield_row = (marker, Text(card.label), Text(card.target, style=theme.MUTED),
                         Text(card.template), status, Text(str(card.findings)))
            table.add_row(*yield_row, key=str(card.index))
        yield table

    def buttons(self) -> Iterable[Button]:
        return [dialog_button("New assessment", "new"),
                dialog_button("Open", "open", primary=True),
                dialog_button("Close", "close")]

    def status(self) -> Text:
        return Text("↑/↓ choose · Enter open · Esc close", style=theme.DIM)

    def first_focus(self):
        return self.query_one(DataTable)

    def _open_selected(self) -> None:
        table = self.query_one(DataTable)
        if table.row_count:
            key = table.coordinate_to_cell_key((table.cursor_row, 0)).row_key.value
            self.dismiss(key)

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        event.stop()
        if event.row_key.value is not None:
            self.dismiss(event.row_key.value)

    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        if event.button.id == "new":
            self.dismiss("new")
        elif event.button.id == "open":
            self._open_selected()
        else:
            self.dismiss(None)
