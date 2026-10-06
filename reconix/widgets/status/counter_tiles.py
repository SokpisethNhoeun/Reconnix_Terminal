"""Two counter tiles: Approvals and Findings."""

from typing import Dict

from rich.text import Text
from textual.app import ComposeResult
from textual.containers import Horizontal
from textual.widgets import Static

from ... import theme

TILES = (("approvals", "Approvals"), ("findings", "Findings"))

# Color of a non-zero count; zero is always plain text.
ACCENT = {"approvals": theme.MEDIUM}


class CounterTiles(Horizontal):
    def compose(self) -> ComposeResult:
        for key, _ in TILES:
            yield Static(id=f"tile-{key}", classes="tile")

    def set_counts(self, counts: Dict[str, int]) -> None:
        for key, label in TILES:
            value = counts.get(key, 0)
            color = ACCENT.get(key, theme.TEXT) if value else theme.TEXT
            self.query_one(f"#tile-{key}", Static).update(Text.assemble(
                (label, theme.MUTED), "\n", (f"{value:,}", f"bold {color}"),
            ))
