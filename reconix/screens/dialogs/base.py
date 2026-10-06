"""Base for every Reconix dialog: a titled frame over the dimmed dashboard.

    ╭ SCOPE MANIFEST · REVIEW ───────────────────────────────── DRAFT ╮
    │ ...content...                                                    │
    │ [Edit Scope] [› Approve Scope]          ● Testing paused until … │
    ╰──────────────────────────────────────────────────────────────────╯

Subclasses set HEADING / TONE, and implement `compose_content()` and `buttons()`.
Esc closes with None: for a gate that means "decide later", and nothing runs.
←/→ move between the buttons, ↑/↓ between fields, Enter presses the focused button.
"""

from typing import Iterable, List, Optional, Union

from rich.text import Text
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import ModalScreen
from textual.widget import Widget
from textual.widgets import Button, Static

from ... import theme
from ...widgets import Panel


def dialog_button(label: str, id: str, primary: bool = False, disabled: bool = False) -> Button:
    text = f"› {label}" if primary else label
    return Button(text, id=id, classes="btn-primary" if primary else "btn-ghost",
                  disabled=disabled, compact=True)


class DialogScreen(ModalScreen[Optional[str]]):
    HEADING = ""
    TONE = "cyan"     # a theme.CHIP tone: cyan | amber | violet | green | red

    BINDINGS = [
        Binding("escape", "close", "close"),
        Binding("left", "move_button(-1)", show=False),
        Binding("right", "move_button(1)", show=False),
        Binding("up", "app.focus_previous", show=False),
        Binding("down", "app.focus_next", show=False),
    ]

    # --- for subclasses -------------------------------------------------------------------
    def compose_content(self) -> ComposeResult:  # pragma: no cover - overridden
        return iter(())

    def compose_above(self) -> ComposeResult:
        """Widgets drawn above the frame (the summary's logo)."""
        return iter(())

    def compose_below(self) -> ComposeResult:
        """Widgets drawn under the frame."""
        return iter(())

    def buttons(self) -> Iterable[Button]:
        return ()

    def status(self) -> Union[str, Text]:
        """The note at the right end of the button row."""
        return ""

    def tag(self) -> Optional[Union[str, Text]]:
        """The chip or note at the right end of the top border."""
        return None

    def first_focus(self) -> Optional[Widget]:
        """What has focus when the dialog opens (default: the last button)."""
        buttons = self.query(Button)
        return buttons.last() if buttons else None

    def on_close(self) -> None:
        """Runs before Esc closes the dialog (e.g. void a confirmation token)."""

    # --- layout ----------------------------------------------------------------------------
    @property
    def color(self) -> str:
        return theme.CHIP.get(self.TONE, theme.CHIP["cyan"])[0]

    def compose(self) -> ComposeResult:
        with Vertical(id="dialog-wrap"):
            yield from self.compose_above()
            with Panel(Text(self.HEADING, style=f"bold {self.color}"), self.tag(),
                       color=self.color, id="frame", classes="dialog-frame"):
                yield from self.compose_content()
                buttons: List[Button] = list(self.buttons())
                with Horizontal(classes="dialog-actions"):
                    yield from buttons
                    yield Static(self.status(), id="dialog-status", classes="dialog-status")
            yield from self.compose_below()

    def on_mount(self) -> None:
        # Textual also calls each subclass's on_mount; they must not call super().
        target = self.first_focus()
        if target is not None:
            target.focus()

    def set_status(self, text: Union[str, Text]) -> None:
        self.query_one("#dialog-status", Static).update(text)

    def show_error(self, message: str) -> None:
        """A validation message from the store, shown in the status slot (never as markup)."""
        self.set_status(Text(message, style=theme.CRITICAL))

    # --- keys -------------------------------------------------------------------------------
    def action_close(self) -> None:
        self.on_close()
        self.dismiss(None)

    def action_move_button(self, step: int) -> None:
        buttons = [b for b in self.query(Button) if not b.disabled]
        if not buttons:
            return
        focused = self.focused
        index = buttons.index(focused) if focused in buttons else (-1 if step > 0 else 0)
        buttons[(index + step) % len(buttons)].focus()
