"""SELECT A TEMPLATE — the AI suggests one; the operator chooses."""

from rich.text import Text
from textual.app import ComposeResult
from textual.binding import Binding
from textual.widgets import Static

from ... import store, theme
from ...models import Choice
from ...widgets import ChoiceMenu, CompactMenu
from .base import DialogScreen

LABEL_WIDTH = 14


class TemplateDialog(DialogScreen):
    """Dismisses with the chosen template id, or None (decide later)."""

    HEADING = "SELECT A TEMPLATE"
    TONE = "cyan"

    BINDINGS = [Binding("enter", "choose", show=False)]

    def compose_content(self) -> ComposeResult:
        yield Static(Text("Templates set default tools, actions, and limits. You review "
                          "everything before testing.", style=theme.MUTED), classes="dialog-note")
        templates = store.list_templates()
        choices = [
            Choice(t.id, t.name.ljust(LABEL_WIDTH), t.description, disabled=not t.available,
                   tag="AI SUGGESTED" if t.suggested else "")
            for t in templates
        ]
        default = next((i for i, t in enumerate(templates) if t.suggested), 0)
        yield CompactMenu(choices, default=default, id="template-menu")

    def status(self) -> Text:
        return Text("Enter to select · ↑/↓ to navigate · Esc to decide later", style=theme.DIM)

    def first_focus(self):
        return self.query_one("#template-menu", ChoiceMenu)

    def action_choose(self) -> None:
        self.query_one("#template-menu", ChoiceMenu).choose_highlighted()

    def on_choice_menu_chosen(self, event: ChoiceMenu.Chosen) -> None:
        event.stop()
        try:
            store.select_template(event.choice_id)
        except store.StoreValidationError as exc:
            self.show_error(str(exc))
            return
        self.dismiss(event.choice_id)
