"""A titled box with an optional tag at the right end of its top border.

    ╭ ACTIVITY LOG ──────────────────────── live ╮

Textual draws one border title, so the tag is joined to the title with a run of
border characters sized to the current width.
"""

from typing import Optional, Union

from rich.text import Text
from textual.containers import Vertical
from textual.widget import Widget

from .. import theme

Label = Union[str, Text]


def bordered_title(width: int, title: Label, tag: Optional[Label] = None,
                   line_color: str = theme.BORDER_STR) -> Text:
    """The title, a rule, and the tag, fitted to a border of `width` cells."""
    left = Text.assemble(" ", title if isinstance(title, Text) else Text(title), " ")
    if not tag:
        return left
    right = Text.assemble(" ", tag if isinstance(tag, Text) else Text(tag, style=theme.MUTED), " ")
    # Textual keeps one border cell on each side of the title, plus the two corners.
    fill = width - 4 - left.cell_len - right.cell_len
    if fill < 1:
        return left
    return Text.assemble(left, ("─" * fill, line_color), right)


def set_bordered_title(widget: Widget, title: Label, tag: Optional[Label] = None,
                       line_color: str = theme.BORDER_STR) -> None:
    widget.border_title = bordered_title(widget.size.width, title, tag, line_color)


class Panel(Vertical):
    """A titled box. Dashboard panels take their border from CSS; dialogs pass `color`.

    `color` sets the border, the title and the rule to one tone, e.g. theme.MEDIUM for
    a draft. Without it the border comes from the stylesheet (so :focus-within works).
    """

    def __init__(self, title: Label = "", tag: Optional[Label] = None, *,
                 color: Optional[str] = None, id: Optional[str] = None,
                 classes: Optional[str] = None) -> None:
        super().__init__(id=id, classes=classes)
        self._title = title
        self._tag = tag
        self._color = color
        if color is not None:
            self.styles.border = ("round", color)

    def on_mount(self) -> None:
        # Textual also calls each subclass's on_mount; they must not call super().
        self._redraw_title()

    def on_resize(self) -> None:
        self._redraw_title()

    def set_title(self, title: Label) -> None:
        self._title = title
        self._redraw_title()

    def set_tag(self, tag: Optional[Label]) -> None:
        self._tag = tag
        self._redraw_title()

    def set_color(self, color: str) -> None:
        """Give the border, title and rule one color (e.g. green once a finding is confirmed)."""
        self._color = color
        self.styles.border = ("round", color)
        self._redraw_title()

    def _redraw_title(self) -> None:
        color = self._color or theme.CYAN
        title = self._title if isinstance(self._title, Text) else Text(
            self._title, style=f"bold {color}")
        set_bordered_title(self, title, self._tag, self._color or theme.BORDER_STR)
