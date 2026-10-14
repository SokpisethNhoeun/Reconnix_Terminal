"""Render the findings of `report.report_data()` as CSV (for spreadsheets and triage).

Uses the standard library's csv writer, so every value is quoted and escaped safely,
and a text cell a spreadsheet would run as a formula (=, +, -, @) starts with a quote
instead. Evidence is left out; it is masked but can be multi-line.
"""

import csv
import io
from typing import Any, Dict

COLUMNS = ["ID", "Severity", "CVSS", "Status", "Validation", "Category", "Finding",
           "Location", "Affected URL", "CWE", "OWASP", "Tool", "Remediation"]

FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def _cell(value: Any) -> Any:
    """`value`, with a leading quote when a spreadsheet would read the text as a formula."""
    if isinstance(value, str) and value.startswith(FORMULA_START):
        return "'" + value
    return value


def render_csv(data: Dict[str, Any]) -> str:
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(COLUMNS)
    for f in data["findings"]:
        writer.writerow([_cell(value) for value in (
            f["id"], f["severity"], f.get("cvss_score") or "", f.get("status", ""),
            f.get("validation", ""), f.get("category", ""), f["title"], f.get("path", ""),
            f.get("affected_url", ""), " ".join(f.get("cwe", [])), " ".join(f.get("owasp", [])),
            f.get("tool", ""), f.get("remediation", ""),
        )])
    return out.getvalue()
