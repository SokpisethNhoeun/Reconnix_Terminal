"""The built-in slash commands. Handlers only call ReconixApp methods."""

from typing import TYPE_CHECKING, List

from .. import store
from ..models import Choice
from .registry import Command

if TYPE_CHECKING:
    from ..app import ReconixApp


# --- argument choices ----------------------------------------------------------
def _finding_choices(app: "ReconixApp") -> List[Choice]:
    return [Choice(f.fid, f"{f.fid}  {f.title}", f.severity) for f in store.list_findings()]


def _template_choices(app: "ReconixApp") -> List[Choice]:
    return [Choice(t.id, t.name, t.description, disabled=not t.available)
            for t in store.list_templates()]


COMMANDS = (
    Command("help", "Show the keys", lambda app, arg: app.action_help()),
    Command("findings", "List the findings (F2)", lambda app, arg: app.open_findings()),
    Command("finding", "Open one finding…", lambda app, fid: app.open_findings(fid),
            choices=_finding_choices, question="Which finding?",
            empty="No findings yet. They appear as testing finds them."),
    Command("template", "Pick a template, then type its target",
            lambda app, tid: app.open_template(tid), choices=_template_choices,
            question="Which kind of target?", aliases=("templates",)),
    Command("activity", "Activity log and audit trail (F4)",
            lambda app, arg: app.open_activity(), aliases=("audit", "log")),
    Command("report", "Generate the report (F5)", lambda app, arg: app.open_report(),
            aliases=("export",)),
    Command("summary", "Show the assessment summary", lambda app, arg: app.open_summary()),
    Command("assessments", "List and reopen assessments (F6)",
            lambda app, arg: app.open_assessments(), aliases=("list",)),
    Command("import", "Import tool output (nuclei/nmap/ZAP)", lambda app, arg: app.open_import()),
    Command("web", "Open the web dashboard in your browser",
            lambda app, arg: app.open_web_dashboard(), aliases=("dashboard",)),
    Command("new", "Start a new assessment (optionally on a target)",
            lambda app, arg: app.new_assessment(arg), aliases=("start",)),
    Command("quit", "Quit Reconix", lambda app, arg: app.exit(), aliases=("exit",)),
)
