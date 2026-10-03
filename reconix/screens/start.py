"""Frame 01 — Assessment Start / empty state."""

from typing import Callable

from rich.table import Table
from rich.text import Text
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Center, Vertical
from textual.widgets import Static

from .base import ReconixScreen
from .. import store, theme
from ..commands import COMMANDS
from ..widgets import PromptBox

# Colored by `#logo` in reconix.tcss.
LOGO = r"""██████╗ ███████╗ ██████╗ ██████╗ ███╗   ██╗██╗██╗  ██╗
██╔══██╗██╔════╝██╔════╝██╔═══██╗████╗  ██║██║╚██╗██╔╝
██████╔╝█████╗  ██║     ██║   ██║██╔██╗ ██║██║ ╚███╔╝
██╔══██╗██╔══╝  ██║     ██║   ██║██║╚██╗██║██║ ██╔██╗
██║  ██║███████╗╚██████╗╚██████╔╝██║ ╚████║██║██╔╝ ██╗
╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝"""

# (number, step, hint) for the "Start an assessment" panel
QUICKSTART = (
    ("1", "Define your authorized scope", "/scope init"),
    ("2", "Describe a task in plain language", '"scan staging.example.com"'),
    ("3", "Review the plan, approve, and run", "↵ at each gate"),
)


def _quickstart_steps() -> Table:
    """The onboarding steps, with hints right-aligned in their own column."""
    grid = Table.grid(expand=True)
    grid.add_column()
    grid.add_column(justify="right", no_wrap=True)
    for num, step, hint in QUICKSTART:
        grid.add_row(Text.assemble((num, f"bold {theme.CYAN}"), f"  {step}"),
                     Text(hint, style=theme.TEAL))
    return grid


class StartScreen(ReconixScreen):
    flow_name = "start"
    mode_name = "CHAT"
    scroll = False

    BINDINGS = [
        Binding("enter", "begin", "start assessment"),
        Binding("question_mark", "help", "help", key_display="?"),
        Binding("escape", "skip_thinking", "skip", show=False),
    ]

    SPINNER = ("✻", "✶", "✽", "✢", "·", "✢", "✽", "✶")

    def __init__(self) -> None:
        super().__init__()
        self._thinking = False
        self._then: Callable[[], None] = lambda: None
        self._message = ""
        self._frame = 0

    def compose_body(self) -> ComposeResult:
        with Vertical(id="start-center"):
            # `align` centres the children as one group, and the full-width text
            # lines make that group full width, so fixed-width blocks get a Center.
            with Center():
                yield Static(LOGO, id="logo", markup=False)
            yield Static("AI-Powered Security Testing Assistant", id="tagline")
            yield Static(
                "v0.3.0  ·  terminal interface  ·  authorized assessments only",
                id="version-line",
            )
            with Center():
                with Vertical(id="quickstart", classes="panel") as qs:
                    qs.border_title = "◆ Start an assessment"
                    yield Static(_quickstart_steps(), classes="muted")
            yield Static(
                f"[{theme.MUTED}]No active scope — type [/]"
                f"[{theme.TEAL}][b]/scope[/b][/] "
                f"[{theme.MUTED}]or a request below to begin.[/]",
                id="no-scope", markup=True,
            )
        yield PromptBox(
            COMMANDS, store.list_history,
            placeholder="Describe a security task, or type / for commands",
            initial=self.app.pending_prompt, id="prompt-box",
        )

    def on_mount(self) -> None:
        self.app.pending_prompt = ""
        self.query_one(PromptBox).focus_input()

    def action_begin(self) -> None:
        if not self._thinking:          # Enter while thinking must not re-send
            self.app.submit_request("")

    # --- Claude-style "thinking" spinner above the prompt -------------------------
    def think(self, message: str, seconds: float, then: Callable[[], None]) -> None:
        self._thinking, self._then, self._message, self._frame = True, then, message, 0
        self.query_one(PromptBox).set_busy(self._spinner_line())
        self._spin = self.set_interval(0.12, self._spin_tick)
        self._done = self.set_timer(seconds, self._finish_thinking)

    def _spinner_line(self) -> Text:
        glyph = self.SPINNER[self._frame % len(self.SPINNER)]
        return Text.assemble((f"{glyph} ", f"bold {theme.CYAN}"), (self._message, theme.TEXT),
                             ("   esc to skip", theme.DIM))

    def _spin_tick(self) -> None:
        self._frame += 1
        self.query_one(PromptBox).set_busy(self._spinner_line())

    def _finish_thinking(self) -> None:
        if not self._thinking:
            return
        if self.app.screen is not self:  # a dialog is open on top: wait for it
            self._done = self.set_timer(0.2, self._finish_thinking)
            return
        self._thinking = False
        self._spin.stop()
        self._done.stop()
        self.query_one(PromptBox).set_busy(None)
        self._then()

    def action_skip_thinking(self) -> None:
        if self._thinking:
            self._finish_thinking()

    def action_help(self) -> None:
        self.app.action_help()

    def on_prompt_box_submitted(self, event: PromptBox.Submitted) -> None:
        event.stop()
        if self.app.submit_request(event.text):
            event.box.clear()

    def on_prompt_box_command_submitted(self, event: PromptBox.CommandSubmitted) -> None:
        event.stop()
        if self.app.run_command_line(event.text):
            event.box.clear()
