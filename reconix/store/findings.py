"""Normalized findings and the counts the screens show."""

from typing import Dict, List, Tuple

from ..models import Finding
from . import lists
from .activity import log_event
from .errors import StoreValidationError

SEVERITY_ORDER = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO")


def list_findings() -> List[Finding]:
    return list(lists.FINDINGS)


def get_finding(index: int) -> Finding:
    return lists.FINDINGS[index]


def validate_finding(index: int) -> Finding:
    """Mark a finding confirmed after a controlled, detection-only PoC."""
    finding = lists.FINDINGS[index]
    finding.status = "CONFIRMED"
    log_event("finding.validated", finding.fid)
    return finding


def key_findings(limit: int = 4) -> List[Finding]:
    """The findings highlighted in the report (list is already severity-ordered)."""
    return list(lists.FINDINGS[:limit])


def severity_counts() -> Dict[str, int]:
    counts = {sev: 0 for sev in SEVERITY_ORDER}
    for finding in lists.FINDINGS:
        counts[finding.severity] += 1
    return counts


def confirmed_count() -> int:
    return sum(1 for f in lists.FINDINGS if f.status == "CONFIRMED")


# --- filtering and sorting (a backend would take these as query parameters) ------
FINDING_FILTERS: Tuple[Tuple[str, str], ...] = (
    ("all", "All findings"),
    ("high_up", "Critical & High"),
    ("medium", "Medium"),
    ("low", "Low"),
    ("info", "Info"),
    ("not_confirmed", "Not confirmed"),
    ("confirmed", "Confirmed"),
)
FINDING_SORTS: Tuple[Tuple[str, str], ...] = (
    ("severity", "severity"),
    ("cvss", "CVSS \u2193"),
    ("status", "status"),
)
STATUS_ORDER = ("CONFIRMED", "NEEDS REVIEW", "INCONCLUSIVE", "UNCONFIRMED")


def _matches(filter_id: str, finding: Finding) -> bool:
    if filter_id == "high_up":
        return finding.severity in ("CRITICAL", "HIGH")
    if filter_id in ("medium", "low", "info"):
        return finding.severity == filter_id.upper()
    if filter_id == "not_confirmed":
        return finding.status != "CONFIRMED"
    if filter_id == "confirmed":
        return finding.status == "CONFIRMED"
    return True


def _cvss(finding: Finding) -> float:
    try:
        return float(finding.cvss)
    except ValueError:
        return 0.0


def find_findings(filter_id: str = "all", sort_id: str = "severity") -> List[Tuple[int, Finding]]:
    """(store index, finding) pairs matching a filter, in a stable sort order."""
    if filter_id not in dict(FINDING_FILTERS):
        raise StoreValidationError(f"Unknown filter {filter_id}.")
    if sort_id not in dict(FINDING_SORTS):
        raise StoreValidationError(f"Unknown sort {sort_id}.")
    rows = [(i, f) for i, f in enumerate(lists.FINDINGS) if _matches(filter_id, f)]
    if sort_id == "cvss":
        rows.sort(key=lambda row: -_cvss(row[1]))
    elif sort_id == "status":
        rows.sort(key=lambda row: STATUS_ORDER.index(row[1].status)
                  if row[1].status in STATUS_ORDER else len(STATUS_ORDER))
    else:
        rows.sort(key=lambda row: SEVERITY_ORDER.index(row[1].severity))
    return rows


def filter_label(filter_id: str) -> str:
    return dict(FINDING_FILTERS).get(filter_id, filter_id)


def sort_label(sort_id: str) -> str:
    return dict(FINDING_SORTS).get(sort_id, sort_id)


def filter_counts() -> Dict[str, int]:
    return {fid: len(find_findings(fid)) for fid, _ in FINDING_FILTERS}

