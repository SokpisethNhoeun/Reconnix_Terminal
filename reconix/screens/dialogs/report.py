"""GENERATE REPORT — pick a format, watch the sections build, and save it to ./reports/."""

from typing import Iterable, List, Optional

from rich.table import Table
from rich.text import Text
from textual.app import ComposeResult
from textual.binding import Binding
from textual.timer import Timer
from textual.widgets import Button, Label, Static

from ... import store, theme
from ...models import Choice
from ...widgets import FormatPicker, progress_bar
from .base import DialogScreen, dialog_button


class ReportDialog(DialogScreen):
    """Dismisses with the saved report's path, or None."""

    HEADING = "GENERATE REPORT"
    TONE = "cyan"
    STEP_SECONDS = 0.35   # per section while "building"; 0 in tests

    BINDINGS = [Binding("enter", "generate", show=False)]   # when the format cards have focus

    def __init__(self) -> None:
        super().__init__()
        self._sections: List[str] = store.list_report_sections()
        self._done = 0
        self._timer: Optional[Timer] = None

    def tag(self) -> Text:
        return Text(store.assessment_label(), style=theme.MUTED)

    def compose_content(self) -> ComposeResult:
        yield Label("Format", classes="field-label")
        yield FormatPicker([
            Choice(f.id, f.name, f.description, disabled=not f.available)
            for f in store.list_report_formats()
        ], id="formats")
        yield Static(id="report-progress", classes="report-progress")
        yield Static(id="report-sections", classes="report-sections")

    def buttons(self) -> Iterable[Button]:
        return [dialog_button("Generate", "generate", primary=True),
                dialog_button("Close", "close")]

    def status(self) -> Text:
        return Text("←/→ format · Enter to generate", style=theme.DIM)

    def first_focus(self):
        return self.query_one("#formats", FormatPicker)

    def on_mount(self) -> None:
        self._redraw()

    # --- building -------------------------------------------------------------------------------
    def _redraw(self, active: bool = False) -> None:
        total = len(self._sections)
        percent = round(100 * self._done / total) if total else 0
        line = Table.grid(padding=(0, 2))
        line.add_column(width=9)
        line.add_column(ratio=1)
        line.add_column(width=5, justify="right")
        line.add_row(Text("Progress", style=theme.MUTED), progress_bar(percent, 52),
                     Text(f"{percent}%", style=theme.CYAN if percent < 100 else theme.GREEN))
        self.query_one("#report-progress", Static).update(line)
        grid = Table.grid(expand=True, padding=(0, 2))
        grid.add_column(ratio=1)
        grid.add_column(ratio=1)
        half = (total + 1) // 2
        cells = [self._section(i, active) for i in range(total)]
        for left, right in zip(cells[:half], cells[half:] + [Text("")]):
            grid.add_row(left, right)
        self.query_one("#report-sections", Static).update(grid)

    def _section(self, index: int, active: bool) -> Text:
        name = self._sections[index]
        if index < self._done:
            return Text.assemble(("✓ ", theme.GREEN), (name, theme.TEXT))
        if active and index == self._done:
            return Text.assemble(("⠿ ", theme.CYAN), (name, theme.CYAN))
        return Text.assemble(("· ", theme.DIM), (name, theme.MUTED))

    def _generate(self) -> None:
        if self._timer is not None:
            return
        if self.query_one("#formats", FormatPicker).selected is None:
            self.show_error("Pick a format that's in the demo.")
            return
        self.query_one("#generate", Button).disabled = True
        self._done = 0
        self._step()

    def _step(self) -> None:
        while self._done < len(self._sections):
            self._redraw(active=True)
            if self.STEP_SECONDS > 0:
                self._done += 1
                self._timer = self.set_timer(self.STEP_SECONDS, self._step)
                return
            self._done += 1
        self._timer = None
        self._redraw()
        try:
            path = store.generate_report(self.query_one("#formats", FormatPicker).selected)
        except (store.StoreValidationError, OSError) as exc:
            self.query_one("#generate", Button).disabled = False
            self.show_error(str(exc))
            return
        self.dismiss(path)

    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        if event.button.id == "generate":
            self._generate()
        else:
            self.dismiss(None)

    def action_generate(self) -> None:
        self._generate()
