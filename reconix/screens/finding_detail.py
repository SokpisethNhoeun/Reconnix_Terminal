"""Frame 07 — Finding detail (evidence + AI analysis)."""

from typing import List, Tuple

from rich.text import Text
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.widgets import Static

from .base import ReconixScreen
from .choice import ChoiceScreen
from .. import store, theme
from ..models import Choice


class FindingDetailScreen(ReconixScreen):
    flow_name = "detail"
    mode_name = "DETAIL"

    BINDINGS = [
        Binding("v", "validate", "validate (PoC)"),
        Binding("r", "report", "report"),
        Binding("left_square_bracket", "step(-1)", "previous finding", show=False),
        Binding("right_square_bracket", "step(1)", "next finding", show=False),
        Binding("left", "to_list", "back to list"),
        Binding("escape", "to_list", "back", show=False),
    ]

    def compose_body(self) -> ComposeResult:
        f = store.get_finding(self.app.selected_finding)
        scolor, sglyph = theme.STATUS.get(f.status, (theme.MUTED, "○"))
        sev = theme.SEVERITY[f.severity]

        order, inside = self._order()
        position = order.index(self.app.selected_finding) + 1
        where = (f"({position} of {len(order)})" if inside
                 else f"(outside filter · {position} of {len(order)})")
        yield Static(Text.assemble(
            ("← findings", theme.CYAN), ("  /  ", theme.BORDER), (f.fid, f"bold {theme.MUTED}"),
            (f"  {where}", theme.DIM), ("  ·  [ prev  ·  ] next", theme.DIM),
        ), id="breadcrumb")
        with Vertical(classes="panel", id="detail-header") as hdr:
            yield Static(
                f"[{sev}]■ {f.severity}[/]   [{theme.TEXT}][b]{f.title}[/b][/]      "
                f"[{scolor}]● {f.status}[/]",
                markup=True,
            )
            yield Static(
                f"[{theme.MUTED}]{f.fid} · {f.target} · detected by {f.tool}[/]    "
                f"[{theme.KEY}]CVSS {f.cvss} · {f.ref}[/]",
                markup=True,
            )
        with Horizontal(id="detail-cols"):
            with Vertical(classes="panel") as ev:
                ev.border_title = "▤ EVIDENCE"
                ev.border_subtitle = f"{f.tool}"
                for label, text, ckey in f.evidence:
                    if label:
                        yield Static(f"[{theme.DIM}]{label}[/]", markup=True)
                    if text:
                        color = {
                            "text": theme.TEXT, "string": theme.STRING,
                            "green": theme.GREEN, "dim": theme.DIM,
                        }.get(ckey, theme.TEXT)
                        yield Static(f"[{color}]{text}[/]", markup=True)
                yield Static("")
                yield Static(
                    f"[{theme.TEAL}]✓ Validated via controlled PoC (detection-only) "
                    f"— status {f.status}[/]"
                    if f.status == "CONFIRMED" else
                    f"[{theme.MEDIUM}]○ Not yet validated — press [b]v[/b] "
                    "to run a controlled PoC[/]",
                    classes="panel-note", markup=True,
                )
            with Vertical(classes="panel") as an:
                an.border_title = "✦ AI ANALYSIS"
                an.border_subtitle = "grounded in OWASP · CWE · NVD"
                yield Static(f"[{theme.HIGH}][b]Impact[/b][/]", markup=True)
                yield Static(f"[{theme.MUTED}]{f.impact}[/]", markup=True)
                yield Static("")
                yield Static(f"[{theme.TEAL}][b]Remediation[/b][/]", markup=True)
                yield Static(f"[{theme.MUTED}]{f.remediation}[/]", markup=True)
                yield Static("")
                yield Static(f"[{theme.LOW}][b]References[/b][/]", markup=True)
                for ref in f.references:
                    yield Static(f"[{theme.DIM}]•[/] [{theme.KEY}]{ref}[/]", markup=True)

    def action_validate(self) -> None:
        index = self.app.selected_finding
        finding = store.get_finding(index)
        if finding.status == "CONFIRMED":
            self.notify(f"{finding.fid} is already validated.", severity="information")
            return
        sev = theme.SEVERITY.get(finding.severity, theme.MUTED)
        body = [
            Text.assemble((f"{finding.fid}  ", theme.KEY), (finding.title, theme.TEXT)),
            Text.assemble(("severity  ", theme.DIM),
                          (f"{finding.severity} · CVSS {finding.cvss}", sev)),
            Text("A detection-only proof of concept confirms the finding "
                 "without exploiting it.", style=theme.MUTED),
        ]

        def answer(choice: str) -> None:
            if choice == "run":
                store.validate_finding(index)
                self.notify(f"{finding.fid} validated (detection-only).",
                            severity="information")
                self.app.goto("detail")

        self.app.push_screen(ChoiceScreen(
            "Validate finding", f"Run a controlled PoC for {finding.fid}?",
            [
                Choice("no", "No, don't validate", "Leave the status unchanged."),
                Choice("run", "Run PoC (detection-only)",
                       "Confirms the finding; nothing is exploited."),
            ],
            body=body, chip="Validate",
        ), answer)

    # --- previous / next in the Findings list order -----------------------------------
    def _order(self) -> Tuple[List[int], bool]:
        """Store indices in the list's filter+sort order, and whether this finding is in it."""
        app = self.app
        order = [i for i, _ in store.find_findings(app.findings_filter, app.findings_sort)]
        if app.selected_finding in order:
            return order, True
        # Opened via /finding, or validated out of the filter: walk everything instead.
        return [i for i, _ in store.find_findings("all", app.findings_sort)], False

    def action_step(self, delta: int) -> None:
        order, _ = self._order()
        position = order.index(self.app.selected_finding) + delta
        if not 0 <= position < len(order):
            self.app.bell()          # at an end: no wrap-around
            return
        self.app.open_finding(order[position])

    def action_report(self) -> None:
        self.app.goto("report")

    def action_to_list(self) -> None:
        self.app.goto("findings")
