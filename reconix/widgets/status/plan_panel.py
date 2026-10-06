"""The PLAN panel: the assessment's named tasks as a live checklist.

Each task shows where it stands — pending ·, loading ⠹ (spins on the tick), done ✓.
The panel's tag shows how many tasks are done.
"""

from typing import List

from rich.table import Table
from rich.text import Text
from textual.app import ComposeResult
from textual.widgets import Static

from ... import store, theme
from ...models import PlanTask
from ..panel import Panel

SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"


class PlanList(Static):
    """Renders the plan tasks. `set_tasks(tasks, frame)` redraws; `frame` spins the glyph."""

    def set_tasks(self, tasks: List[PlanTask], frame: int) -> None:
        if not tasks:
            self.update(Text("Pick a template to see the plan.", style=theme.DIM))
            return
        grid = Table.grid(padding=(0, 1))
        grid.add_column(width=1, no_wrap=True)
        grid.add_column(ratio=1)
        for task in tasks:
            grid.add_row(*_task_row(task, frame))
        self.update(grid)


def _task_row(task: PlanTask, frame: int):
    if task.status == "done":
        return Text("✓", style=theme.GREEN), Text(task.label, style=theme.TEXT)
    if task.status == "active":
        return (Text(SPINNER[frame % len(SPINNER)], style=theme.CYAN),
                Text(task.label, style=f"bold {theme.CYAN}"))
    return Text("·", style=theme.DIM), Text(task.label, style=theme.MUTED)


class PlanPanel(Panel):
    """The PLAN box in the side column. Holds a PlanList the run drives."""

    def __init__(self, **kwargs) -> None:
        super().__init__("PLAN", **kwargs)
        self._frame = 0

    def compose(self) -> ComposeResult:
        yield PlanList(id="plan-list")

    def on_mount(self) -> None:
        # Panel.on_mount also runs and draws the title; this adds the task list and tag.
        self.refresh_view()

    def refresh_view(self) -> None:
        tasks = store.plan_tasks()
        self.query_one(PlanList).set_tasks(tasks, self._frame)
        self._set_tag(tasks)

    def tick(self) -> None:
        """Once a second: spin the active task's glyph."""
        self._frame += 1
        self.query_one(PlanList).set_tasks(store.plan_tasks(), self._frame)

    def _set_tag(self, tasks: List[PlanTask]) -> None:
        if not tasks:
            self.set_tag(None)
            return
        done = sum(1 for task in tasks if task.status == "done")
        count_color = theme.GREEN if done == len(tasks) else theme.MUTED
        self.set_tag(Text(f"{done}/{len(tasks)}", style=count_color))
