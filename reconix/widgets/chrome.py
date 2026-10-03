"""Shared window chrome: the session bar and the flow progress line."""

from typing import List, Tuple

from rich.text import Text
from textual.widgets import Static

from .. import store, theme


class SessionBar(Static):
    """Top session bar: brand + assessment context + demo/model/policy status.

    The right-hand status drops its lower-priority parts on narrow terminals so it
    never overflows. "demo data" is shown (not "backend") because the data is mocked.
    """

    GAP = "   "

    def __init__(self) -> None:
        super().__init__(markup=True)

    def on_mount(self) -> None:
        # Render both halves; Static justifies left, so build a full-width line.
        self._refresh_line()

    def _refresh_line(self) -> None:
        width = self.size.width or 120
        assessment = store.get_assessment()
        left_t = Text.from_markup(
            f"[{theme.CYAN}]◆ [b]reconix[/b][/]  "
            f"[{theme.BORDER}]│[/]  "
            f"[{theme.MUTED}]{assessment.assessment_id} · {assessment.target}[/]"
        )
        # Most important first; trailing parts are dropped when the width is tight.
        parts = (
            f"[{theme.MEDIUM}]◆[/] [{theme.MUTED}]demo data[/]",
            f"[{theme.DIM}]model:[/] [{theme.MUTED}]{assessment.model}[/]",
            f"[{theme.DIM}]policy:[/] [{theme.CYAN}]{assessment.policy}[/]",
        )
        gap = Text(self.GAP)
        right_t = Text()
        for part in parts:
            piece = Text.from_markup(part)
            extra = (gap.cell_len if right_t.cell_len else 0) + piece.cell_len
            if left_t.cell_len + 2 + right_t.cell_len + extra > width:
                break
            if right_t.cell_len:
                right_t = Text.assemble(right_t, gap, piece)
            else:
                right_t = piece
        pad = max(1, width - left_t.cell_len - right_t.cell_len)
        self.update(Text.assemble(left_t, Text(" " * pad), right_t))

    def on_resize(self) -> None:
        self._refresh_line()


class FlowProgress(Static):
    """The rule under the session bar, showing where you are in the flow.

        ── ✓ Start ─ ✓ Scope ─ ● Plan ─ ○ Approval ─ ○ Execution ─ ○ Findings ─ ○ Report ───

    ✓ settled, ✕ stopped, ○ pending; the current step is bold cyan. On narrow
    terminals only the current step keeps its label.
    """

    SUB_STEPS = {"detail": "findings"}    # screens shown under another step
    PASSED_IS_DONE = ("start", "findings")  # no settling event; done once you move past

    def __init__(self, flow_name: str) -> None:
        super().__init__()
        self._current = self.SUB_STEPS.get(flow_name, flow_name)

    def on_mount(self) -> None:
        self.refresh_line()

    def on_resize(self) -> None:
        self.refresh_line()

    def refresh_line(self) -> None:
        self.update(self._render_line(self.size.width or 120))

    def _steps(self) -> List[str]:
        return [name for name in self.app.flow_order() if name not in self.SUB_STEPS]

    def _glyph(self, index: int, name: str, current: int, states: dict) -> Tuple[str, str]:
        state = states.get(name)
        if state == "stopped":
            return "✕", theme.CRITICAL
        if state == "done" or (name in self.PASSED_IS_DONE and index < current):
            return "✓", theme.GREEN
        if index == current:
            return "●", theme.CYAN
        return "○", theme.DIM

    def _render_line(self, width: int) -> Text:
        steps = self._steps()
        current = steps.index(self._current) if self._current in steps else -1
        states = store.step_states()
        full, compact = Text(), Text()
        for i, name in enumerate(steps):
            glyph, color = self._glyph(i, name, current, states)
            label = name.title()
            if i == current:
                label_style = f"bold {theme.CYAN}"
            else:
                label_style = theme.MUTED if glyph in ("✓", "✕") else theme.DIM
            if i:
                full.append(" ─ ", style=theme.BORDER)
                compact.append(" ", style=theme.BORDER)
            full.append(f"{glyph} ", style=color)
            full.append(label, style=label_style)
            compact.append(glyph, style=color)
            if i == current:
                compact.append(f" {label}", style=label_style)
        prefix = Text("── ", style=theme.BORDER)
        body = full if prefix.cell_len + full.cell_len + 2 <= width else compact
        line = Text.assemble(prefix, body, (" ", theme.BORDER))
        line.append("─" * max(0, width - line.cell_len), style=theme.BORDER)
        line.truncate(width)
        line.no_wrap = True
        return line
