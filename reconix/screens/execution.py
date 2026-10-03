"""Frame 05 — Live execution (animated progress + streaming log)."""

from rich.text import Text
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.widgets import ProgressBar, RichLog, Static

from .base import ReconixScreen
from .choice import ChoiceScreen
from .. import store, theme
from ..models import Choice, LogLine


class ExecutionScreen(ReconixScreen):
    flow_name = "execution"
    mode_name = "EXECUTION"

    BINDINGS = [
        Binding("enter", "advance", "view findings"),
        Binding("ctrl+c", "stop", "stop scan", show=False),
        Binding("escape", "detach", "detach", show=False),
    ]

    def __init__(self) -> None:
        super().__init__()
        self._line = 0
        self._done = False
        self._tasks = store.list_exec_tasks()
        self._output = store.list_scan_output()

    def compose_body(self) -> ComposeResult:
        total = len(self._tasks)
        done = sum(1 for t in self._tasks if t.status == "DONE")
        running_tool = next((t.tool for t in self._tasks if t.status == "RUNNING"), "")
        yield Static(
            f"[{theme.CYAN}]◆ reconix[/] [{theme.DIM}]executing approved plan · {total} steps[/]",
            classes="ai-label", markup=True,
        )
        with Vertical(classes="panel") as panel:
            panel.border_title = "◌ RUNNING"
            panel.border_subtitle = f"{done} of {total} complete"
            for task in self._tasks:
                running = task.status == "RUNNING"
                icon = f"[{theme.CYAN}]◌[/]" if running else f"[{theme.GREEN}]✓[/]"
                color = theme.TEXT if running else theme.MUTED
                dcolor = theme.CYAN if running else theme.DIM
                yield Static(
                    f"{icon} [{color}][b]{task.action:<20}[/b][/] [{dcolor}]{task.detail}[/]",
                    id=f"task-{task.action}", classes="task-row", markup=True,
                )
            with Horizontal(classes="overall"):
                yield Static(f"[{theme.DIM}]overall[/] ", markup=True)
                yield ProgressBar(total=100, show_eta=False, id="overall-bar")
        log = RichLog(id="live-log", markup=True, highlight=False, wrap=True)
        log.border_title = "▤ live output"
        log.border_subtitle = f"{running_tool} · ^C stop"
        yield log
        yield Static(
            f"[{theme.DIM}]streaming… press [/][{theme.TEXT}][b]→[/b][/]"
            f"[{theme.DIM}] or [/][{theme.TEXT}][b]Enter[/b][/]"
            f"[{theme.DIM}] when the scan finishes[/]",
            id="exec-hint", markup=True,
        )

    def on_mount(self) -> None:
        self.query_one("#overall-bar", ProgressBar).update(progress=40)
        self._timer = self.set_interval(0.6, self._tick)

    def _tick(self) -> None:
        log = self.query_one("#live-log", RichLog)
        bar = self.query_one("#overall-bar", ProgressBar)
        if self._line < len(self._output):
            log.write(self._log_text(self._output[self._line]))
            self._line += 1
            bar.update(progress=40 + int(60 * self._line / len(self._output)))
        else:
            self._finish()
            self._timer.stop()

    def _finish(self) -> None:
        if self._done:
            return
        self._done = True
        self._end_log_subtitle("done")
        self.call_after_refresh(self.refresh_progress)
        self.query_one("#overall-bar", ProgressBar).update(progress=100)
        panel = self.query_one(".panel", Vertical)
        panel.border_title = f"[{theme.GREEN}]✓ COMPLETE[/]"
        total = len(self._tasks)
        panel.border_subtitle = (
            f"{total} of {total} complete · {len(store.list_findings())} findings"
        )
        for task in self._tasks:
            if task.status == "RUNNING":
                self.query_one(f"#task-{task.action}", Static).update(
                    f"[{theme.GREEN}]✓[/] [{theme.MUTED}][b]{task.action:<20}[/b][/] "
                    f"[{theme.DIM}]{task.result}[/]"
                )
        self.query_one("#exec-hint", Static).update(
            f"[{theme.GREEN}]✓ scan complete — press [/][{theme.TEXT}][b]→[/b][/]"
            f"[{theme.GREEN}] or [/][{theme.TEXT}][b]Enter[/b][/]"
            f"[{theme.GREEN}] to view findings[/]"
        )
        store.log_event("execution.completed")

    def _end_log_subtitle(self, state: str) -> None:
        """Once the scan has ended, stop advertising ^C."""
        tool = next((t.tool for t in self._tasks if t.status == "RUNNING"), "scan")
        self.query_one("#live-log", RichLog).border_subtitle = f"{tool} · {state}"

    @staticmethod
    def _log_text(line: LogLine) -> Text:
        """Color one tool-output line. Built as Text, so tool output is never parsed as markup."""
        if line.kind == "match":
            sev_color = theme.SEVERITY.get(line.severity.upper(), theme.MUTED)
            return Text.assemble(
                ("[✓]", theme.GREEN), " ", (f"[{line.template}]", theme.KEY),
                f" {line.target} ", (f"[{line.severity}]", sev_color),
            )
        return Text.assemble(("[INF]", theme.LOW), f" {line.message}")

    def action_advance(self) -> None:
        self._finish()
        self.app.go_next()

    def action_stop(self) -> None:
        if self._done:
            return
        tool = next((t.tool for t in self._tasks if t.status == "RUNNING"), "the scan")

        def answer(choice: str) -> None:
            if choice == "stop":
                self._stop_scan(tool)

        self.app.push_screen(ChoiceScreen(
            "Stop scan", f"Stop {tool}?",
            [
                Choice("keep", "Keep running", "Let the scan finish."),
                Choice("stop", f"Stop {tool}", "Halt now; partial results are kept.", "danger"),
            ],
            chip="Execution", danger=True,
        ), answer)

    def _stop_scan(self, tool: str) -> None:
        if self._done:
            return
        self._done = True
        self._timer.stop()
        self._end_log_subtitle("stopped")
        store.log_event("execution.stopped", tool)
        self.refresh_progress()
        panel = self.query_one(".panel", Vertical)
        panel.border_title = f"[{theme.CRITICAL}]\u2715 STOPPED[/]"
        for task in self._tasks:
            if task.status == "RUNNING":
                self.query_one(f"#task-{task.action}", Static).update(
                    f"[{theme.CRITICAL}]\u2715[/] [{theme.MUTED}][b]{task.action:<20}[/b][/] "
                    f"[{theme.DIM}]stopped by operator[/]"
                )
        self.query_one("#exec-hint", Static).update(
            f"[{theme.CRITICAL}]\u2715 scan stopped — press [/][{theme.TEXT}][b]\u2192[/b][/]"
            f"[{theme.CRITICAL}] or [/][{theme.TEXT}][b]Enter[/b][/]"
            f"[{theme.CRITICAL}] to view partial findings[/]"
        )

    def action_detach(self) -> None:
        self.app.go_prev()
