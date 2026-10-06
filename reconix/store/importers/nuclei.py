"""Parse nuclei JSONL output (one JSON object per line) into findings."""

import json
from typing import List

from ...models import Finding
from ..errors import StoreValidationError
from .common import dedupe, finding


def parse(text: str) -> List[Finding]:
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            raise StoreValidationError("Could not read the nuclei output (invalid JSON line).") \
                from None
    findings = []
    for i, row in enumerate(rows, 1):
        info = row.get("info", {}) if isinstance(row, dict) else {}
        url = row.get("matched-at") or row.get("matched_at") or row.get("host", "")
        evidence = row.get("extracted-results") or row.get("extracted_results") or []
        if row.get("template-id") or row.get("template_id"):
            tid = row.get("template-id") or row.get("template_id")
            evidence = list(evidence) + [f"template: {tid}"]
        findings.append(finding(
            i, info.get("severity", "info"), info.get("name", ""),
            _path(url), url, info.get("description", ""), "nuclei",
            remediation=info.get("remediation", ""),
            references=info.get("reference") or info.get("references") or [],
            evidence=evidence,
        ))
    if not findings:
        raise StoreValidationError("No nuclei results found in the file.")
    return dedupe(findings)


def _path(url: str) -> str:
    if "://" in url:
        rest = url.split("://", 1)[1]
        return "/" + rest.split("/", 1)[1] if "/" in rest else "/"
    return url
