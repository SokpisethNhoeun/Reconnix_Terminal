"""The top bar: brand and version on the left, assessment, status and policy on the right."""

from rich.text import Text
from textual.widgets import Static

from .. import __version__, store, theme
from ..flow.phases import phase_style


class TopBar(Static):
    """`◆ RECONIX v0.4.0 · AI-guided …   assessment RCX-DEMO-001  status testing  policy ● on`

    The tagline and then the assessment drop out on narrow terminals so it never wraps.
    """

    GAP = "   "

    def on_mount(self) -> None:
        self.refresh_line()

    def on_resize(self) -> None:
        self.refresh_line()

    def refresh_line(self) -> None:
        width = self.size.width or 120
        brand = Text.assemble(("◆ ", theme.CYAN), ("RECONIX", f"bold {theme.CYAN}"),
                              ("  ", ""), (f"v{__version__}", theme.MUTED))
        tagline = Text(" · AI-guided security testing assistant", style=theme.MUTED)
        assessment = store.assessment_label() or "—"
        status = phase_style(store.display_phase()).label.lower()
        right_parts = [
            Text.assemble(("assessment ", theme.MUTED), (assessment, theme.TEXT)),
            Text.assemble(("status ", theme.MUTED), (status, theme.TEXT)),
            Text.assemble(("policy ", theme.MUTED), ("● ", theme.GREEN), ("enforced", theme.GREEN)),
        ]
        left = Text.assemble(brand, tagline)
        right = Text(self.GAP).join(right_parts)
        if left.cell_len + right.cell_len + 2 > width:
            left = brand
        if left.cell_len + right.cell_len + 2 > width:
            right = Text(self.GAP).join(right_parts[1:])
        pad = max(1, width - left.cell_len - right.cell_len)
        line = Text.assemble(left, " " * pad, right)
        line.truncate(width)
        self.update(line)
