"""ASSESSMENT STATUS: the state chip, the assessment facts, and the Approvals/Findings tiles."""

from datetime import timedelta
from typing import Optional

from rich.text import Text
from textual.app import ComposeResult

from ... import store, theme
from ...flow.phases import phase_style
from ...models import GATE_SCOPE
from ..kv_grid import KeyValueGrid
from ..panel import Panel
from .counter_tiles import CounterTiles

SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"


def clock(delta: Optional[timedelta]) -> str:
    seconds = int(delta.total_seconds()) if delta else 0
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


class StatusPanel(Panel):
    def __init__(self, **kwargs) -> None:
        super().__init__("ASSESSMENT STATUS", **kwargs)
        self._frame = 0

    def compose(self) -> ComposeResult:
        yield KeyValueGrid(id="status-grid", label_width=11)
        yield CounterTiles(id="counters")

    def on_mount(self) -> None:
        self.refresh_view()

    def tick(self) -> None:
        """Once a second: advance the spinner and the clock."""
        self._frame += 1
        self.query_one("#status-grid", KeyValueGrid).set_rows(self._rows())

    def refresh_view(self) -> None:
        self.query_one("#status-grid", KeyValueGrid).set_rows(self._rows())
        self.query_one(CounterTiles).set_counts(store.counters())

    # --- the facts grid -------------------------------------------------------------------
    def _rows(self):
        run = store.get_run()
        assessment = store.get_assessment()
        template = store.selected_template()
        return [
            ("State", self._state_chip()),
            ("Assessment", Text(assessment.assessment_id, style=f"bold {theme.CYAN}")
             if assessment.assessment_id else Text("not assigned", style=theme.DIM)),
            ("Target", Text(assessment.target) if run.target_known else _dash()),
            ("Template", Text(template.name) if template else _dash()),
            ("Scope", self._scope_text()),
            ("Time", self._time_text()),
        ]

    def _state_chip(self) -> Text:
        style = phase_style(store.display_phase())
        label = style.label
        if style.busy and store.get_run().started and not store.waiting_gate():
            label = f"{SPINNER[self._frame % len(SPINNER)]} {label}"
        return theme.chip(label, style.tone)

    @staticmethod
    def _scope_text() -> Text:
        if store.is_scope_approved():
            return Text("✓ approved · enforced", style=theme.GREEN)
        if store.waiting_gate() == GATE_SCOPE:
            return Text("draft · awaiting approval", style=theme.MEDIUM)
        return _dash()

    @staticmethod
    def _time_text() -> Text:
        """How long the run has been going (no limit shown — just the elapsed time)."""
        elapsed = store.elapsed()
        if elapsed is None:
            return _dash()
        return Text(clock(elapsed), style=theme.TEXT)


def _dash() -> Text:
    return Text("—", style=theme.DIM)
