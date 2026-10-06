"""Render `report.report_data()` as SARIF 2.1.0, for ingestion by CI and code scanning.

SARIF is plain JSON, so this needs no dependencies. Each finding becomes a result keyed by
its CWE (or OWASP, or finding id); severity maps to a SARIF level. Evidence is already masked.
"""

import json
from typing import Any, Dict, List

SARIF_LEVEL = {"CRITICAL": "error", "HIGH": "error", "MEDIUM": "warning",
               "LOW": "note", "INFO": "note"}


def _rule_id(finding: Dict[str, Any]) -> str:
    for key in ("cwe", "owasp"):
        values = finding.get(key) or []
        if values:
            return values[0]
    return finding["id"]


def render_sarif(data: Dict[str, Any]) -> str:
    rules: Dict[str, Dict[str, Any]] = {}
    results: List[Dict[str, Any]] = []
    for finding in data["findings"]:
        rule_id = _rule_id(finding)
        rules.setdefault(rule_id, {
            "id": rule_id,
            "name": finding["title"],
            "shortDescription": {"text": finding["title"]},
            "properties": {"category": finding.get("category", "")},
        })
        results.append({
            "ruleId": rule_id,
            "level": SARIF_LEVEL.get(finding["severity"].upper(), "warning"),
            "message": {"text": finding.get("description") or finding["title"]},
            "locations": [{"physicalLocation": {"artifactLocation": {
                "uri": finding.get("affected_url") or finding.get("path") or ""}}}],
            "properties": {
                "severity": finding["severity"],
                "cvss": finding.get("cvss_score") or None,
                "validation": finding.get("validation"),
                "status": finding.get("status"),
                "category": finding.get("category"),
                "remediation": finding.get("remediation"),
            },
        })
    document = {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": {"driver": {
                "name": "Reconix",
                "version": str(data.get("report_version") or "1.0"),
                "rules": list(rules.values()),
            }},
            "results": results,
        }],
    }
    return json.dumps(document, indent=2, ensure_ascii=False) + "\n"
