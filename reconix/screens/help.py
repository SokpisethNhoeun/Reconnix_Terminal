"""Help overlay — the keys for what is focused now, plus the global key map."""

from typing import List, Sequence, Tuple

from rich.table import Table
from rich.text import Text
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Vertical
from textual.screen import ModalScreen, Screen
from textual.widgets import DataTable, Input, OptionList, Static

from .. import theme
from ..widgets import ChoiceMenu, PromptInput

Row = Tuple[str, str]

GLOBAL_ROWS: List[Row] = [
    ("Tab", "move focus: prompt, panels, fields, buttons"),
    ("Esc", "close a dialog (nothing runs until you decide)"),
    ("/", "command suggestions"),
    ("?", "toggle this help"),
    ("^Q", "quit"),
]

PROMPT_ROWS: List[Row] = [
    ("Enter", "send the request; on an empty prompt, start the demo or reopen a paused step"),
    ("/", "show command suggestions as you type"),
    ("↑  /  ↓", "prompt history, or move in the open menu"),
    ("Tab", "complete the highlighted command"),
    ("Esc", "close the menu, then clear the prompt"),
    ("^R", "search prompt history"),
]

LIST_ROWS: List[Row] = [
    ("↑  /  ↓", "move between rows"),
    ("Enter", "confirm the highlighted choice"),
]

FIELD_ROWS: List[Row] = [
    ("Tab  /  ↓", "next field or button"),
    ("Enter", "next field, or confirm"),
]

DIALOG_ROWS: List[Row] = [
    ("←  /  →", "move between the buttons"),
    ("Enter", "press the focused button"),
]


def context_rows(screen: Screen) -> List[Row]:
    """Keys that work on `screen` right now: the focused widget's, then the screen's own."""
    focused = screen.focused
    if isinstance(focused, PromptInput):
        rows = list(PROMPT_ROWS)
    elif isinstance(focused, Input):
        rows = list(FIELD_ROWS)
    elif isinstance(focused, (ChoiceMenu, OptionList, DataTable)):
        rows = list(LIST_ROWS)
    elif isinstance(screen, ModalScreen):
        rows = list(DIALOG_ROWS)
    else:
        rows = []
    seen = {keys.lower() for keys, _ in rows} | {desc for _, desc in rows}
    for binding in type(screen).BINDINGS:
        if not isinstance(binding, Binding):
            binding = Binding(*binding)
        keys = screen.app.get_key_display(binding)
        if binding.description and not {keys.lower(), binding.description} & seen:
            seen.update((keys.lower(), binding.description))
            rows.append((keys, binding.description))
    return rows


class HelpScreen(ModalScreen):
    BINDINGS = [
        Binding("question_mark", "close", "close", key_display="?"),
        Binding("escape", "close", "close"),
    ]

    def __init__(self, title: str = "⌨ Keyboard", rows: Sequence[Row] = ()) -> None:
        super().__init__()
        self._title = title
        self._rows = list(rows)

    @classmethod
    def for_screen(cls, screen: Screen) -> "HelpScreen":
        mode = getattr(screen, "mode_name", "") or getattr(screen, "HEADING", "")
        return cls(f"⌨ Shortcuts · {mode}" if mode else "⌨ Keyboard", context_rows(screen))

    def compose(self) -> ComposeResult:
        with Vertical(id="help-box") as box:
            box.border_title = self._title
            if self._rows:
                yield Static(Text("Here", style=f"bold {theme.TEXT}"))
                yield from (self._row(keys, desc) for keys, desc in self._rows)
                yield Static("")
            yield Static(Text("Everywhere", style=f"bold {theme.TEXT}"))
            yield from (self._row(keys, desc) for keys, desc in GLOBAL_ROWS)
            yield Static("")
            yield Static(Text("in-memory demo data · ? or Esc closes this", style=theme.DIM))

    @staticmethod
    def _row(keys: str, desc: str) -> Static:
        grid = Table.grid(padding=(0, 1))
        grid.add_column(width=10, no_wrap=True)
        grid.add_column(ratio=1)
        grid.add_row(Text(keys, style=f"bold {theme.CYAN}"), Text(desc, style=theme.MUTED))
        return Static(grid)

    def action_close(self) -> None:
        self.app.pop_screen()
