"""ASSESSMENT SUMMARY — the closing card after the report is saved."""

import webbrowser
from pathlib import Path
from typing import Iterable

from rich.table import Table
from rich.text import Text
from textual.app import ComposeResult
from textual.widgets import Button, Static

from ... import store, theme
from ...widgets import kv_table
from .base import DialogScreen, dialog_button

FLOW = ("Plan", "Approve Scope", "Test", "Validate", "Analyze", "Report")


def _open_in_browser(display_path: str) -> bool:
    """Open a saved report file in the default browser; True if a browser was launched."""
    try:
        url = Path(display_path).resolve().as_uri()
        return webbrowser.open(url)
    except (OSError, ValueError, webbrowser.Error):
        return False


def flow_line() -> Text:
    line = Text(justify="center")
    for i, step in enumerate(FLOW):
        if i:
            line.append("  →  ", style=theme.DIM)
        line.append(step, style=f"bold {theme.CYAN if i % 2 == 0 else theme.MEDIUM}")
    return line


class SummaryDialog(DialogScreen):
    HEADING = "ASSESSMENT SUMMARY"
    TONE = "green"

    def tag(self) -> Text:
        summary = store.assessment_summary()
        tone = "green" if summary.status == "Completed" else "red"
        return theme.chip(summary.status.upper(), tone)

    def compose_above(self) -> ComposeResult:
        yield Static(Text("◆  R E C O N I X", style=f"bold {theme.CYAN}", justify="center"),
                     classes="summary-logo")

    def compose_content(self) -> ComposeResult:
        summary = store.assessment_summary()
        status_color = theme.GREEN if summary.status == "Completed" else theme.CRITICAL
        left = kv_table([
            ("Assessment", summary.assessment_id),
            ("Status", Text(summary.status, style=status_color)),
            ("Blocked actions", f"{summary.blocked} (out of scope)"),
            ("Report", summary.report_path or Text("not generated yet (F5)", style=theme.DIM)),
        ], label_width=15)
        right = kv_table([
            ("Target", summary.target),
            ("Findings", f"{summary.confirmed} confirmed · {summary.for_review} for review"),
            ("Human approvals", f"{len(summary.approvals)} ({', '.join(summary.approvals)})"
             if summary.approvals else "none"),
        ], label_width=15)
        grid = Table.grid(expand=True, padding=(0, 4))
        grid.add_column(ratio=1)
        grid.add_column(ratio=1)
        grid.add_row(left, right)
        yield Static(grid, classes="dialog-grid")

    def compose_below(self) -> ComposeResult:
        yield Static(flow_line(), classes="summary-flow")
        yield Static(Text("AI-guided security testing. Human-controlled execution.",
                          style=f"bold {theme.TEXT}", justify="center"), classes="summary-tagline")

    def buttons(self) -> Iterable[Button]:
        actions: list = []
        if store.assessment_summary().report_path:
            actions.append(dialog_button("Open report", "open-report", primary=True))
        actions.append(dialog_button("Close", "close"))
        return actions

    def _open_report(self) -> None:
        path = store.assessment_summary().report_path
        if path and _open_in_browser(path):
            self.set_status(Text(f"Opened {path} in your browser.", style=theme.GREEN))
        else:
            self.show_error(f"Couldn't open a browser. The report is saved at {path}.")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        if event.button.id == "open-report":
            self._open_report()
            return
        self.dismiss(None)
