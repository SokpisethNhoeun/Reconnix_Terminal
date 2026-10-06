"""Parse an OWASP ZAP JSON report into findings."""

import json
from typing import List

from ...models import Finding
from ..errors import StoreValidationError
from .common import dedupe, finding


def parse(text: str) -> List[Finding]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        raise StoreValidationError("Could not read the ZAP report (invalid JSON).") from None
    sites = data.get("site") if isinstance(data, dict) else None
    if isinstance(sites, dict):
        sites = [sites]
    if not sites:
        raise StoreValidationError("No ZAP alerts found in the file.")
    findings, i = [], 0
    for site in sites:
        for alert in site.get("alerts", []):
            i += 1
            instances = alert.get("instances", []) or []
            url = instances[0].get("uri", "") if instances else site.get("@name", "")
            refs = [r for r in (alert.get("reference", "") or "").split("\n") if r.strip()]
            cwe = alert.get("cweid")
            if cwe and cwe not in ("-1", "", None):
                refs.append(f"CWE-{cwe}")
            findings.append(finding(
                i, (alert.get("riskdesc", "") or "").split(" ")[0], alert.get("name", ""),
                _path(url), url, _strip(alert.get("desc", "")), "ZAP",
                impact=_strip(alert.get("otherinfo", "")),
                remediation=_strip(alert.get("solution", "")),
                references=refs,
                evidence=[f"{ins.get('method', 'GET')} {ins.get('uri', '')}"
                          for ins in instances[:3]],
            ))
    if not findings:
        raise StoreValidationError("No ZAP alerts found in the file.")
    return dedupe(findings)


def _strip(html: str) -> str:
    import re
    return " ".join(re.sub(r"<[^>]+>", " ", html or "").split())


def _path(url: str) -> str:
    if "://" in url:
        rest = url.split("://", 1)[1]
        return "/" + rest.split("/", 1)[1] if "/" in rest else "/"
    return url or "—"
