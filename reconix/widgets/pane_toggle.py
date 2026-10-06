"""A small clickable button that opens and closes the right (status + plan) pane.

Lives next to the top bar so it stays visible whether the pane is open or closed.
Clicking it runs the dashboard's toggle action; F7 does the same from the keyboard.
"""

from rich.text import Text
from textual.widgets import Static

from .. import theme


class PaneToggle(Static):
    """Shows `⊟ Panel` when the side pane is open, `⊞ Panel` when it is closed."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._collapsed = False

    def on_mount(self) -> None:
        self._redraw()

    def on_click(self) -> None:
        self.screen.action_toggle_side()

    def set_collapsed(self, collapsed: bool) -> None:
        self._collapsed = collapsed
        self._redraw()

    def _redraw(self) -> None:
        glyph = "⊞" if self._collapsed else "⊟"
        self.update(Text.assemble((f" {glyph} ", f"bold {theme.CYAN}"), ("Panel ", theme.MUTED)))
