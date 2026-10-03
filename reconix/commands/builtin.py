"""The built-in slash commands. Handlers only call ReconixApp methods."""

from typing import TYPE_CHECKING, Callable, List, Optional

from .. import store
from ..models import Choice
from .registry import Command

if TYPE_CHECKING:
    from ..app import ReconixApp


# --- argument choices ----------------------------------------------------------
def _finding_choices(app: "ReconixApp") -> List[Choice]:
    return [Choice(f.fid.lower(), f"{f.fid}  {f.title}", f.severity) for f in store.list_findings()]


def _export_choices(app: "ReconixApp") -> List[Choice]:
    return [
        Choice("pdf", "PDF", "printable report"),
        Choice("docx", "DOCX", "editable document"),
        Choice("json", "JSON", "machine-readable findings"),
    ]


# --- handlers --------------------------------------------------------------------
def _goto(name: str) -> Callable[["ReconixApp", Optional[str]], None]:
    def run(app: "ReconixApp", arg: Optional[str]) -> None:
        app.goto(name)
    return run


def _open_finding(app: "ReconixApp", fid: Optional[str]) -> None:
    ids = [f.fid.lower() for f in store.list_findings()]
    app.open_finding(ids.index(fid or ""))


COMMANDS = (
    Command("help", "Show shortcuts for this screen", lambda app, arg: app.action_help()),
    Command("new", "Back to the start prompt", _goto("start"), aliases=("start",)),
    Command("scope", "Review the scope manifest", _goto("scope")),
    Command("plan", "Review the test plan", _goto("plan")),
    Command("approval", "Open the approval gate", _goto("approval")),
    Command("status", "Live execution (after approval)",
            lambda app, arg: app.open_execution(), aliases=("execution",)),
    Command("findings", "List all findings", _goto("findings")),
    Command("finding", "Open one finding…", _open_finding,
            choices=_finding_choices, question="Which finding?"),
    Command("report", "Open the assessment report", _goto("report")),
    Command("audit", "Show the audit trail", lambda app, arg: app.show_audit()),
    Command("export", "Export the report…", lambda app, fmt: app.export_report((fmt or "").upper()),
            choices=_export_choices, question="Export the report as…"),
    Command("quit", "Quit Reconix", lambda app, arg: app.exit(), aliases=("exit",)),
)
