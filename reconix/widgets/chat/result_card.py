"""A small boxed result inside the chat, e.g. "▸ Discovery · OWASP ZAP" with counts."""

from typing import Sequence, Tuple

from rich.table import Table
from rich.text import Text
from textual.widgets import Static

from ... import theme


class ResultCard(Static):
    def __init__(self, title: str, rows: Sequence[Tuple[str, str]]) -> None:
        grid = Table.grid(expand=True)
        grid.add_column(style=theme.MUTED, no_wrap=True)
        grid.add_column(justify="right", no_wrap=True)
        for label, value in rows:
            grid.add_row(Text(label), Text(value, style=theme.TEXT))
        super().__init__(grid, classes="result-card")
        self.border_title = Text.assemble(("▸ ", theme.CYAN), (title, theme.CYAN))
