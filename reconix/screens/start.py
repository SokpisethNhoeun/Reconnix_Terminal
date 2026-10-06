"""Frame 01 — Assessment Start / empty state."""

from typing import Optional

from rich.table import Table
from rich.text import Text
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Center, Vertical
from textual.timer import Timer
from textual.widgets import Static

from .base import ReconixScreen
from .. import store, theme
from ..commands import COMMANDS
from ..widgets import PromptBox, spinner_line

# Colored by `#logo` in reconix.tcss.
LOGO = r"""██████╗ ███████╗ ██████╗ ██████╗ ███╗   ██╗██╗██╗  ██╗
██╔══██╗██╔════╝██╔════╝██╔═══██╗████╗  ██║██║╚██╗██╔╝
██████╔╝█████╗  ██║     ██║   ██║██╔██╗ ██║██║ ╚███╔╝
██╔══██╗██╔══╝  ██║     ██║   ██║██║╚██╗██║██║ ██╔██╗
██║  ██║███████╗╚██████╗╚██████╔╝██║ ╚████║██║██╔╝ ██╗
╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝"""

# (number, step, hint) for the "Start an assessment" panel
QUICKSTART = (
    ("1", "Pick a template, type its target", "/template"),
    ("2", "Or just type a target", '"https://staging.example.com"'),
    ("3", "Approve scope · run plan · approve risks", "↵ at each gate"),
)

PLACEHOLDER = "Type a target (URL, IPv4, repo or path), a question, or / for commands"


def _quickstart_steps() -> Table:
    """The onboarding steps, with hints right-aligned in their own column."""
    grid = Table.grid(expand=True)
    grid.add_column()
    grid.add_column(justify="right", no_wrap=True)
    for num, step, hint in QUICKSTART:
        grid.add_row(Text.assemble((num, f"bold {theme.CYAN}"), f"  {step}"),
                     Text(hint, style=theme.TEAL))
    return grid


def _reply_line() -> Text:
    """The last exchange at the prompt (your line and Reconix's answer), or the hint."""
    chat = store.list_chat()
    for i in range(len(chat) - 1, -1, -1):
        if chat[i].speaker == "you":
            answer = next((e for e in chat[i + 1:] if e.speaker == "reconix"), None)
            line = Text.assemble(("› ", theme.MUTED), (chat[i].text, theme.TEXT))
            if answer is not None:
                line.append("\n")
                line.append("◆ reconix  ", style=f"bold {theme.CYAN}")
                line.append(answer.text, style=theme.MUTED)
            return line
    return Text.assemble(("No active scope — type ", theme.MUTED),
                         ("/template", f"bold {theme.TEAL}"),
                         (" or a target below to begin.", theme.MUTED))


class StartScreen(ReconixScreen):
    flow_name = "start"
    mode_name = "CHAT"
    scroll = False

    BINDINGS = [
        Binding("enter", "begin", "start assessment"),
        Binding("question_mark", "help", "help", key_display="?"),
    ]

    def __init__(self) -> None:
        super().__init__()
        self._frame = 0
        self._spin: Optional[Timer] = None

    def compose_body(self) -> ComposeResult:
        with Vertical(id="start-center"):
            # `align` centres the children as one group, and the full-width text
            # lines make that group full width, so fixed-width blocks get a Center.
            with Center():
                yield Static(LOGO, id="logo", markup=False)
            yield Static("AI-Powered Security Testing Assistant", id="tagline")
            yield Static(
                "v0.4.0  ·  terminal interface  ·  authorized assessments only",
                id="version-line",
            )
            with Center():
                with Vertical(id="quickstart", classes="panel") as qs:
                    qs.border_title = "◆ Start an assessment"
                    yield Static(_quickstart_steps(), classes="muted")
            yield Static(_reply_line(), id="no-scope")
        yield PromptBox(
            COMMANDS, store.list_history, placeholder=PLACEHOLDER,
            initial=self.app.pending_prompt, id="prompt-box",
        )

    def on_mount(self) -> None:
        self.app.pending_prompt = ""
        self.query_one(PromptBox).focus_input()
        self.refresh_live()

    def action_begin(self) -> None:
        if not self._working():          # Enter while working must not re-send
            self.app.submit_request("")

    # --- live: Reconix's answer, and a spinner while the run heads for its first gate ------
    def _working(self) -> bool:
        run = store.get_run()
        return (run.started and not store.is_finished() and not store.waiting_gate()
                and not store.is_scope_approved())

    def refresh_live(self) -> None:
        self.query_one("#no-scope", Static).update(_reply_line())
        if self._working() and self._spin is None:
            self._spin = self.set_interval(0.12, self._spin_tick)
        elif not self._working() and self._spin is not None:
            self._spin.stop()
            self._spin = None
            self.query_one(PromptBox).set_busy(None)
        if self._spin is not None:
            self._draw_spinner()

    def _spin_tick(self) -> None:
        self._frame += 1
        self._draw_spinner()

    def _draw_spinner(self) -> None:
        chat = [e for e in store.list_chat() if e.speaker == "reconix"]
        message = chat[-1].text if chat else "reconix is reading the target…"
        self.query_one(PromptBox).set_busy(spinner_line(self._frame, message))

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
