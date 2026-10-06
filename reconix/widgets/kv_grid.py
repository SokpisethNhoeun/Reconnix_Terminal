"""Aligned label/value rows — the status panel, scope manifest, approvals and findings use it."""

from typing import Iterable, List, Optional, Tuple, Union

from rich.console import RenderableType
from rich.table import Table
from rich.text import Text
from textual.widgets import Static

from .. import theme

Value = Union[str, RenderableType]
Row = Tuple[str, Value]


def kv_table(rows: Iterable[Row], label_width: int = 12, label_color: str = theme.MUTED,
             value_color: str = theme.TEXT) -> Table:
    """A borderless two-column grid. Strings are plain text (never markup); any other
    renderable (Text, a Rich Panel for evidence) is shown as it is."""
    grid = Table.grid(padding=(0, 2))
    grid.add_column(style=label_color, no_wrap=True, width=label_width)
    grid.add_column(ratio=1)
    for label, value in rows:
        grid.add_row(label, Text(value, style=value_color) if isinstance(value, str) else value)
    return grid


class KeyValueGrid(Static):
    """A Static showing `kv_table(rows)`; call `set_rows()` to update it."""

    def __init__(self, rows: Iterable[Row] = (), *, label_width: int = 12,
                 id: Optional[str] = None, classes: Optional[str] = None) -> None:
        self._label_width = label_width
        self._rows: List[Row] = list(rows)
        super().__init__(kv_table(self._rows, label_width), id=id, classes=classes)

    def set_rows(self, rows: Iterable[Row]) -> None:
        self._rows = list(rows)
        self.update(kv_table(self._rows, self._label_width))
