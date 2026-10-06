"""The function-key strip under the prompt, with the navigation hints on the right."""

from typing import Iterable, Tuple

from rich.text import Text
from textual.widgets import Static

from .. import theme

# (key, label, enabled)
FKey = Tuple[str, str, bool]

HINTS = (("↑↓", "navigate"), ("Tab", "switch"), ("Enter", "select"), ("Esc", "back"),
         ("/", "commands"), ("?", "help"))


class FKeyBar(Static):
    """`F2 Findings  F3 Scope  F4 Activity  F5 Generate Report        ↑↓ navigate  Tab switch …`"""

    def __init__(self, keys: Iterable[FKey] = (), **kwargs) -> None:
        super().__init__(**kwargs)
        self._keys = list(keys)

    def on_mount(self) -> None:
        self._redraw()

    def on_resize(self) -> None:
        self._redraw()

    def set_keys(self, keys: Iterable[FKey]) -> None:
        self._keys = list(keys)
        self._redraw()

    def _redraw(self) -> None:
        width = self.size.width or 120
        left = Text()
        for key, label, enabled in self._keys:
            if left:
                left.append("  ")
            if enabled:
                left.append(f" {key} {label} ", style=f"{theme.TEXT} on {theme.RAISED}")
            else:
                left.append(f" {key} {label} ", style=f"{theme.DIM} on {theme.SURFACE2}")
        hints = Text("  ").join(
            Text.assemble((key, theme.MUTED), " ", (what, theme.DIM)) for key, what in HINTS
        )
        # Drop hints from the end until the line fits.
        parts = list(HINTS)
        while parts and left.cell_len + hints.cell_len + 2 > width:
            parts.pop()
            hints = Text("  ").join(
                Text.assemble((key, theme.MUTED), " ", (what, theme.DIM)) for key, what in parts
            )
        pad = max(1, width - left.cell_len - hints.cell_len)
        line = Text.assemble(left, " " * pad, hints)
        line.truncate(width)
        self.update(line)
