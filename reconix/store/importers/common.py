"""Helpers shared by the tool-output parsers."""

from typing import List

from ...models import Finding
from ..redact import clean, redact

SEVERITY_MAP = {
    "critical": "CRITICAL", "high": "HIGH", "medium": "MEDIUM", "low": "LOW",
    "info": "INFO", "informational": "INFO", "information": "INFO", "unknown": "INFO",
    "": "INFO",
}


def severity(value: str) -> str:
    return SEVERITY_MAP.get(str(value).strip().lower().split()[0] if value else "", "INFO")


def mask(text: str) -> str:
    """Mask secrets in an evidence line and trim it, so nothing sensitive rides along."""
    text = redact(" ".join(str(text).split()))
    return text if len(text) <= 200 else text[:197] + "…"


def finding(index: int, sev: str, title: str, path: str, url: str, description: str,
            tool: str, impact: str = "", remediation: str = "", references=None,
            evidence=None) -> Finding:
    title, path, url, description, impact, remediation = (
        redact(str(v or "")) for v in (title, path, url, description, impact, remediation))
    return Finding(
        fid=f"IMP-{index:03d}", severity=severity(sev), title=title or "Imported finding",
        path=path or "—", validation="UNCONFIRMED",
        description=description or "Imported from tool output.",
        affected_url=url or path or "—",
        impact=impact or "Review the finding and confirm its impact.",
        remediation=remediation or "See the tool's guidance for remediation.",
        tool=f"{tool} (imported)",
        references=[clean(str(r)) for r in (references or [])],
        evidence=[mask(line) for line in (evidence or []) if str(line).strip()],
    )


def dedupe(findings: List[Finding]) -> List[Finding]:
    seen, out = set(), []
    for f in findings:
        key = (f.severity, f.title, f.path)
        if key not in seen:
            seen.add(key)
            out.append(f)
    return out
