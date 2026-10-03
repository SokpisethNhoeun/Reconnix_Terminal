"""Base screen: window chrome + body + footer, shared by all screens."""

from typing import Callable

from rich.text import Text
from textual.app import ComposeResult
from textual.containers import Vertical, VerticalScroll
from textual.screen import Screen
from textual.widgets import Footer, Static

from .. import store, theme
from ..widgets import ChoiceMenu, FlowProgress, Question, SessionBar


class ReconixScreen(Screen):
    """All flow screens inherit this. Subclasses implement `compose_body`.

    Set `flow_name` to the screen's key in the app flow (it drives the progress
    line), `mode_name` for the help title, and `scroll = False` for a fill body.
    """

    flow_name: str = ""
    mode_name: str = ""
    scroll: bool = True

    def compose(self) -> ComposeResult:
        yield SessionBar()
        yield FlowProgress(self.flow_name)
        container = VerticalScroll(id="body") if self.scroll else Vertical(id="body")
        with container:
            yield from self.compose_body()
        yield Footer()

    def compose_body(self) -> ComposeResult:  # pragma: no cover - overridden
        return iter(())

    # --- navigation helpers (delegate to the app) -----------------------------
    def action_next(self) -> None:
        self.app.go_next()

    def action_prev(self) -> None:
        self.app.go_prev()

    def think(self, message: str, seconds: float, then: Callable[[], None]) -> None:
        """Show a short "working" state, then run `then`. Screens without one run it now."""
        then()

    def refresh_progress(self) -> None:
        """Redraw the flow progress line after this screen changes a step's state."""
        self.query_one(FlowProgress).refresh_line()

    def action_choose(self) -> None:
        """Enter fallback when focus is outside the screen's menu: pick its highlight."""
        for menu in self.query(ChoiceMenu):
            if menu.can_focus:
                menu.choose_highlighted()
                return

    # --- answers from a Question ("Type something." / "Chat about this") ----------
    def chat_topic(self) -> str:
        """What \"Chat about this\" is about; screens with a Question override it."""
        return self.mode_name.lower()

    def chat_about(self) -> None:
        store.log_event(f"{self.flow_name}.chat")
        self.app.open_chat(f"About {self.chat_topic()}: ")

    def on_choice_menu_typed(self, event: ChoiceMenu.Typed) -> None:
        event.stop()
        try:
            store.add_feedback(self.flow_name, event.text)
        except store.StoreValidationError as exc:
            self.notify(str(exc), severity="warning", markup=False)
            return
        # Echo the feedback on screen (built as Text, so brackets are never markup).
        echo = Static(
            Text.assemble(("\U0001f4ac you  ", f"bold {theme.TEAL}"), (event.text, theme.TEXT)),
            classes="feedback-echo",
        )
        body = self.query_one("#body")
        questions = self.query(Question)
        if questions:
            body.mount(echo, before=questions.first())
        else:
            body.mount(echo)
        self.notify("Feedback noted \u2014 the planner isn't connected in this demo.",
                    severity="information")
