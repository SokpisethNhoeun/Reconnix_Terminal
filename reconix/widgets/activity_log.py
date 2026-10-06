"""Activity-log rows (SYS / AI / USER / TOOL / POLICY), used by the F4 Activity dialog."""

from typing import Iterable

from rich.table import Table
from rich.text import Text
from textual.app import ComposeResult
from textual.containers import VerticalScroll
from textual.widgets import Static

from .. import theme
from ..models import ActivityEntry


def activity_line(entry: ActivityEntry) -> Table:
    """`14:12:41  POLICY  Blocked: Path outside approved scope` (local time).

    A grid, so a long message wraps under itself instead of under the time.
    """
    grid = Table.grid(padding=(0, 2), expand=True)
    grid.add_column(width=8, no_wrap=True)
    grid.add_column(width=6, no_wrap=True)
    grid.add_column(ratio=1)
    grid.add_row(
        Text(entry.created_at.astimezone().strftime("%H:%M:%S"), style=theme.DIM),
        Text(entry.source, style=f"bold {theme.SOURCE.get(entry.source, theme.MUTED)}"),
        Text(entry.message, style=theme.TONE.get(entry.tone, theme.TEXT)),
    )
    return grid


def activity_row(entry: ActivityEntry) -> Static:
    return Static(activity_line(entry), classes=f"activity-row -{entry.tone}")


class ActivityRows(VerticalScroll):
    """Rows for a list of entries; used by the dashboard panel and the Activity dialog."""

    def __init__(self, entries: Iterable[ActivityEntry] = (), **kwargs) -> None:
        super().__init__(**kwargs)
        self._initial = list(entries)

    def compose(self) -> ComposeResult:
        yield from (activity_row(entry) for entry in self._initial)
