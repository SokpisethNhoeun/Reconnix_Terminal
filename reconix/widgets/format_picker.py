"""A row of cards to pick one option with ←/→ (the report formats)."""

from typing import List, Optional, Sequence

from rich.panel import Panel as RichPanel
from rich.table import Table
from rich.text import Text
from textual.binding import Binding
from textual.widgets import Static

from .. import theme
from ..models import Choice


class FormatPicker(Static, can_focus=True):
    """Cards for each Choice; disabled ones are dimmed and skipped. Read `selected`."""

    BINDINGS = [
        Binding("left", "move(-1)", show=False),
        Binding("right", "move(1)", show=False),
    ]

    def __init__(self, choices: Sequence[Choice], *, id: Optional[str] = None) -> None:
        super().__init__(id=id)
        self._choices: List[Choice] = list(choices)
        self._index = next((i for i, c in enumerate(self._choices) if not c.disabled), 0)

    @property
    def selected(self) -> Optional[str]:
        choice = self._choices[self._index] if self._choices else None
        return choice.id if choice and not choice.disabled else None

    def on_mount(self) -> None:
        self._redraw()

    def on_focus(self) -> None:
        self._redraw()

    def on_blur(self) -> None:
        self._redraw()

    def action_move(self, step: int) -> None:
        count = len(self._choices)
        for offset in range(1, count + 1):
            index = (self._index + step * offset) % count
            if not self._choices[index].disabled:
                self._index = index
                break
        self._redraw()

    def _card(self, index: int, choice: Choice) -> RichPanel:
        chosen = index == self._index
        if choice.disabled:
            body = Text.assemble((choice.label, f"bold {theme.DIM}"), "\n",
                                 ("not in demo", f"italic {theme.DIM}"))
            border = theme.BORDER
        else:
            mark = "✓ " if chosen else ""
            body = Text.assemble((mark + choice.label, f"bold {theme.TEXT}"), "\n",
                                 (choice.hint, theme.MUTED))
            border = (theme.GREEN if self.has_focus else theme.TEAL) if chosen else theme.BORDER_STR
        return RichPanel(body, border_style=border, padding=(0, 1), expand=True)

    def _redraw(self) -> None:
        grid = Table.grid(expand=True, padding=(0, 1))
        for _ in self._choices:
            grid.add_column(ratio=1)
        grid.add_row(*(self._card(i, c) for i, c in enumerate(self._choices)))
        self.update(grid)

