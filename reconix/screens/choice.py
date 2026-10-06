"""Dialog: a question with ↑/↓ choices (e.g. `/finding` without an id)."""

from typing import Optional, Sequence

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Vertical
from textual.screen import ModalScreen

from ..models import Choice
from ..widgets import ChoiceMenu, Question, menu_hint


class ChoiceScreen(ModalScreen[Optional[str]]):
    """Dismisses with the chosen id, or None on Esc.

    There are deliberately no letter shortcuts: a stray key must never confirm a
    choice the operator didn't mean.
    """

    BINDINGS = [
        Binding("enter", "choose", "select", show=False),   # if focus is on the body
        Binding("escape", "cancel", "cancel"),
    ]

    def __init__(self, title: str, question: str, choices: Sequence[Choice], *,
                 default: int = 0, chip: str = "Question") -> None:
        super().__init__()
        self._title = title
        self._question = question
        self._choices = list(choices)
        self._default = default
        self._chip = chip

    def compose(self) -> ComposeResult:
        with Vertical(classes="dialog") as box:
            box.border_title = self._title
            yield Question(self._chip, self._question, self._choices,
                           hint=menu_hint("cancel"), default=self._default,
                           menu_id="dialog-menu")

    def on_mount(self) -> None:
        self.query_one("#dialog-menu", ChoiceMenu).focus()

    def on_choice_menu_chosen(self, event: ChoiceMenu.Chosen) -> None:
        event.stop()
        self.dismiss(event.choice_id)

    def action_choose(self) -> None:
        self.query_one("#dialog-menu", ChoiceMenu).choose_highlighted()

    def action_cancel(self) -> None:
        self.dismiss(None)
