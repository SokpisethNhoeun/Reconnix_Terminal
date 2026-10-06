"""Normalized findings. Only the findings the run has revealed so far are listed."""

from typing import List

from ..models import Finding
from . import lists
from .errors import StoreValidationError

SEVERITY_ORDER = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO")

# The triage lifecycle an analyst can move a finding through.
TRIAGE_STATUS = ("open", "fixed", "accepted", "false-positive")
TRIAGE_LABELS = {"open": "Open", "fixed": "Fixed", "accepted": "Accepted risk",
                 "false-positive": "False positive"}


def list_findings() -> List[Finding]:
    """Revealed findings, most severe first (seed order breaks ties)."""
    revealed = set(lists.current().run.revealed)
    rows = [f for f in lists.current().findings if f.fid in revealed]
    rows.sort(key=lambda f: SEVERITY_ORDER.index(f.severity))
    return rows


def get_finding(fid: str) -> Finding:
    for finding in list_findings():
        if finding.fid == fid:
            return finding
    raise StoreValidationError(f"No finding {fid}.")


def finding_exists(fid: str) -> bool:
    return any(f.fid == fid for f in lists.current().findings)


def confirmed_count() -> int:
    return sum(1 for f in list_findings() if not f.needs_review)


def review_count() -> int:
    return sum(1 for f in list_findings() if f.needs_review)


def findings_line() -> str:
    """e.g. "3 findings: 1 confirmed, 2 marked for review"."""
    total = len(list_findings())
    noun = "finding" if total == 1 else "findings"
    return (f"{total} {noun}: {confirmed_count()} confirmed, "
            f"{review_count()} marked for review")


# --- analyst triage -----------------------------------------------------------------------------
def triage_finding(fid: str, *, status: str = None, severity: str = None,
                   note: str = "") -> Finding:
    """Record an analyst's triage decision on a finding: a lifecycle status and/or a
    severity override, with an optional justification.

    Deterministic and analyst-driven — this is never the LLM's decision. Returns the Finding.
    When the backend lands, keep this name and signature and have it POST the decision.
    """
    from .activity import log_event
    from .transcript import add_activity

    finding = get_finding(fid)                 # only revealed findings can be triaged
    if status is not None:
        if status not in TRIAGE_STATUS:
            raise StoreValidationError(f"Unknown triage status {status}.")
        finding.status = status
    if severity is not None:
        if severity not in SEVERITY_ORDER:
            raise StoreValidationError(f"Unknown severity {severity}.")
        finding.severity_override = "" if severity == finding.severity else severity
    if note:
        finding.triage_note = note
    detail = TRIAGE_LABELS.get(finding.status, finding.status)
    if finding.severity_override:
        detail += f" · severity → {finding.severity_override}"
    add_activity("USER", f"Triage {fid}: {detail}", tone="ok")
    log_event("finding.triaged", f"{fid} {finding.status}")
    return finding


# --- importing real tool output ---------------------------------------------------------------
MAX_IMPORT_BYTES = 5_000_000


def import_findings(path_text: str):
    """Read a nuclei/nmap/ZAP output file and add its findings to the current assessment.

    The file is only read, never executed. Returns (tool, count). Imported findings are
    shown immediately and marked with an IMP- id and the source tool.
    """
    from pathlib import Path

    from .activity import log_event
    from .importers import parse_auto
    from .transcript import add_activity, add_chat

    text = (path_text or "").strip()
    if not text:
        raise StoreValidationError("Enter the path to a tool output file.")
    path = Path(text).expanduser()
    if not path.is_file():
        raise StoreValidationError("No file at that path.")
    if path.stat().st_size > MAX_IMPORT_BYTES:
        raise StoreValidationError("That file is too large to import (over 5 MB).")
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        raise StoreValidationError("Couldn't read that file.") from None

    tool, parsed = parse_auto(content)
    assessment = lists.current()
    existing = {(f.severity, f.title, f.path) for f in assessment.findings}
    n = sum(1 for f in assessment.findings if f.fid.startswith("IMP-"))
    added = 0
    for f in parsed:
        if (f.severity, f.title, f.path) in existing:    # skip ones already present
            continue
        n += 1
        added += 1
        f.fid = f"IMP-{n:03d}"
        assessment.findings.append(f)
        assessment.run.revealed.append(f.fid)       # imported findings show at once
    add_activity("USER", f"Imported {added} finding(s) from {tool} output", tone="ok")
    add_chat("text", "reconix",
             f"Imported {added} finding(s) from {tool} output ({path.name}).", tone="ok")
    log_event("findings.imported", f"{tool} {added}")
    return tool, added
