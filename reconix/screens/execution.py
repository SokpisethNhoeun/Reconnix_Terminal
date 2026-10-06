"""Frame 05 — Live execution: the plan's tasks, an overall bar, and the live output.

The run plays on its own (the app hosts it). This screen redraws after every step, says
when the run is paused at a gate (Enter opens it), and offers ^C to stop.
"""

from rich.text import Text
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.widgets import ProgressBar, Static

from .base import ReconixScreen
from .choice import ChoiceScreen
from .. import store, theme
from ..models import GATE_ACCOUNT, GATE_APPROVAL_PREFIX, PROGRESS_BARS, Choice, PlanTask
from ..widgets import RunLog

TESTING_BARS = tuple(bar for bar in PROGRESS_BARS if bar != "report")


def run_state() -> str:
    """"running" | "approval" | "login" | "complete" | "stopped"."""
    run = store.get_run()
    if run.stopped:
        return "stopped"
    if run.completed:
        return "complete"
    gate = store.waiting_gate()
    if gate and store.gate_state(gate) == "pending":
        if gate.startswith(GATE_APPROVAL_PREFIX):
            return "approval"
        if gate == GATE_ACCOUNT:
            return "login"
    return "running"


def overall_percent() -> int:
    progress = store.phase_progress()
    return round(sum(progress[bar] for bar in TESTING_BARS) / len(TESTING_BARS))


def task_line(task: PlanTask) -> Text:
    percent = store.phase_progress().get(task.key, 0)
    color, glyph = theme.STATUS.get(task.status, (theme.DIM, "·"))
    detail = {"done": "done", "active": f"{percent}%"}.get(task.status, "queued")
    if task.key == "report" and task.status == "active":
        detail = "ready · export it from the Report screen"
    text_color = theme.TEXT if task.status == "active" else theme.MUTED
    return Text.assemble((f"{glyph} ", color), (f"{task.label:<30}", f"bold {text_color}"),
                         (detail, theme.CYAN if task.status == "active" else theme.DIM))


PANEL_TITLE = {
    "running": ("◌ RUNNING", theme.CYAN),
    "approval": ("⏸ WAITING FOR YOUR APPROVAL", theme.MEDIUM),
    "login": ("⏸ WAITING FOR THE TARGET LOGIN", theme.MEDIUM),
    "complete": ("✓ COMPLETE", theme.GREEN),
    "stopped": ("✕ STOPPED", theme.CRITICAL),
}


def hint_line(state: str) -> Text:
    key = ("Enter", f"bold {theme.TEXT}")
    if state == "approval":
        request = store.get_approval(store.waiting_gate()[len(GATE_APPROVAL_PREFIX):])
        return Text.assemble((f"⏸ paused — {request.action} ({request.risk}) needs your "
                              "approval. Press ", theme.MEDIUM), key, (" to review it.",
                                                                       theme.MEDIUM))
    if state == "login":
        return Text.assemble(("⏸ paused — testing needs the target login. Press ",
                              theme.MEDIUM), key, (" to add it securely.", theme.MEDIUM))
    if state == "complete":
        return Text.assemble(("✓ assessment complete — press ", theme.GREEN),
                             ("→", f"bold {theme.TEXT}"), (" or ", theme.GREEN), key,
                             (" to view findings", theme.GREEN))
    if state == "stopped":
        return Text.assemble((f"✕ stopped ({store.get_run().stopped}) — press ", theme.CRITICAL),
                             ("→", f"bold {theme.TEXT}"), (" or ", theme.CRITICAL), key,
                             (" to view partial findings", theme.CRITICAL))
    return Text.assemble(("streaming… findings appear as they are found · ", theme.DIM),
                         ("^C", f"bold {theme.TEXT}"), (" to stop", theme.DIM))


class ExecutionScreen(ReconixScreen):
    flow_name = "execution"
    mode_name = "EXECUTION"

    BINDINGS = [
        Binding("enter", "advance", "continue"),
        Binding("ctrl+c", "stop", "stop the run", show=False),
        Binding("escape", "detach", "back to plan", show=False),
    ]

    def compose_body(self) -> ComposeResult:
        tasks = store.plan_tasks()
        yield Static(Text.assemble(("◆ reconix ", theme.CYAN), (
            f"executing approved plan · {len(tasks)} tasks · "
            f"{store.selected_template().name} template", theme.DIM)), classes="ai-label")
        with Vertical(classes="panel", id="exec-panel"):
            for task in tasks:
                yield Static(task_line(task), id=f"task-{task.key}", classes="task-row")
            with Horizontal(classes="overall"):
                yield Static(Text("overall ", style=theme.DIM))
                yield ProgressBar(total=100, show_eta=False, id="overall-bar")
        log = RunLog(id="live-log")
        log.border_title = "▤ live output"
        yield log
        yield Static(id="exec-hint")

    def on_mount(self) -> None:
        self.refresh_live()

    def refresh_live(self) -> None:
        state = run_state()
        tasks = store.plan_tasks()
        for task in tasks:
            self.query_one(f"#task-{task.key}", Static).update(task_line(task))
        self.query_one("#overall-bar", ProgressBar).update(progress=overall_percent())
        panel = self.query_one("#exec-panel", Vertical)
        title, color = PANEL_TITLE[state]
        panel.border_title = Text(title, style=f"bold {color}")
        counters = store.counters()
        done = sum(1 for t in tasks if t.status == "done")
        panel.border_subtitle = Text(f"{done} of {len(tasks)} complete · "
                                     f"{counters['requests']} requests · "
                                     f"{counters['blocked']} blocked · "
                                     f"{counters['findings']} finding"
                                     f"{'' if counters['findings'] == 1 else 's'}")
        log = self.query_one("#live-log", RunLog)
        log.sync()
        log.border_subtitle = self._log_subtitle(state)
        self.query_one("#exec-hint", Static).update(hint_line(state))

    @staticmethod
    def _log_subtitle(state: str) -> Text:
        """Built as Text: the tools come from the (editable) scope, never markup."""
        tools = ", ".join(store.get_scope().tools)
        return Text({"running": f"{tools} · ^C stop", "complete": f"{tools} · done",
                     "stopped": f"{tools} · stopped"}.get(state, f"{tools} · paused"))

    # --- keys ---------------------------------------------------------------------------------
    def action_advance(self) -> None:
        state = run_state()
        if state in ("approval", "login"):
            self.app.open_gate(store.waiting_gate())
        elif state in ("complete", "stopped"):
            self.app.goto("findings")
        else:
            self.notify("Still running. Findings appear as they are found (6).")

    def action_stop(self) -> None:
        if run_state() in ("complete", "stopped"):
            return

        def answer(choice: str) -> None:
            if choice == "stop":
                self.app.stop_run()

        self.app.push_screen(ChoiceScreen(
            "Stop the run", "Stop this assessment?",
            [
                Choice("keep", "Keep running", "Let the plan finish."),
                Choice("stop", "Stop now", "Nothing else runs; findings so far are kept.",
                       "danger"),
            ],
            chip="Execution", danger=True,
        ), answer)

    def action_detach(self) -> None:
        self.app.goto("plan")
