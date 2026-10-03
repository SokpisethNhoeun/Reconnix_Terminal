"""Frame 08 — Security assessment report."""

from rich.text import Text
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.widgets import Button, DataTable, Static

from .base import ReconixScreen
from .. import store, theme


class ReportScreen(ReconixScreen):
    flow_name = "report"
    mode_name = "REPORT"

    BINDINGS = [
        Binding("p", "export_pdf", "export PDF"),
        Binding("w", "export_docx", "export DOCX"),
        Binding("j", "export_json", "export JSON"),
        Binding("escape", "back", "back", show=False),
    ]

    def compose_body(self) -> ComposeResult:
        assessment = store.get_assessment()
        yield Static(
            f"[{theme.CYAN}]◆ reconix[/] [{theme.DIM}]security assessment report · "
            f"{assessment.assessment_id}[/]",
            classes="ai-label", markup=True,
        )
        with Vertical(classes="panel") as panel:
            panel.border_title = "▬ SECURITY ASSESSMENT REPORT"
            panel.border_subtitle = "OWASP WSTG format"
            yield Static(f"[{theme.TEXT}][b]Executive Summary[/b][/]", markup=True)
            yield Static(f"[{theme.MUTED}]{assessment.summary}[/]", markup=True)
            yield Static("")
            yield Static(f"[{theme.TEXT}][b]Findings by Severity[/b][/]", markup=True)
            counts = store.severity_counts()
            peak = max(counts.values()) or 1
            for sev in store.SEVERITY_ORDER:
                n = counts[sev]
                bar_len = int(28 * n / peak)
                line = Text()
                line.append(f"{sev.title():<9}", style=theme.MUTED)
                line.append("█" * bar_len, style=theme.SEVERITY[sev])
                line.append("░" * (28 - bar_len), style=theme.BORDER)
                line.append(f"  {n}", style=f"bold {theme.SEVERITY[sev]}")
                yield Static(line)
            yield Static("")
            yield Static(f"[{theme.TEXT}][b]Key Findings[/b][/]", markup=True)
            table = DataTable(id="report-table", cursor_type="none", zebra_stripes=True)
            table.add_columns("ID", "FINDING", "SEVERITY", "VALIDATION", "SOURCE")
            for f in store.key_findings(limit=4):
                sev = Text(f"■ {f.severity}", style=f"bold {theme.SEVERITY[f.severity]}")
                val_color = theme.TEAL if f.status == "CONFIRMED" else theme.MEDIUM
                table.add_row(
                    Text(f.fid, style=theme.KEY), f.title, sev,
                    Text(f.status.title(), style=val_color),
                    Text(f.tool, style=theme.MUTED),
                )
            yield table
        with Horizontal(classes="actions"):
            yield Button("p  Export PDF", classes="primary", id="pdf")
            yield Button("w  Export DOCX", classes="ghost-cyan", id="docx")
            yield Button("j  Export JSON", classes="ghost-cyan", id="json")
            yield Button("Web dashboard (not in demo)", classes="ghost-cyan", id="web", disabled=True)
        yield Static(
            f"[{theme.DIM}]report generated · ← back · 1 to restart · ^Q quit[/]",
            markup=True,
        )

    def _export(self, fmt: str) -> None:
        self.app.export_report(fmt)

    def action_export_pdf(self) -> None: self._export("PDF")
    def action_export_docx(self) -> None: self._export("DOCX")
    def action_export_json(self) -> None: self._export("JSON")

    def action_back(self) -> None:
        self.app.go_prev()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        {"pdf": self.action_export_pdf, "docx": self.action_export_docx,
         "json": self.action_export_json}[event.button.id]()
