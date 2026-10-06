"""Render `report.report_data()` as a Markdown document.

Every value from the run (tool output, AI text, the operator's reason) is escaped,
so it reads as text: it can't add images, links, headings or break a table.
"""

import re
from typing import Any, Dict, List

_SPECIAL = re.compile(r"([\\`*_{}\[\]()<>#+!|~])")


def md(text: Any) -> str:
    """Escape Markdown syntax in one line of text."""
    return _SPECIAL.sub(r"\\\1", " ".join(str(text).split()))


def fence(lines: List[str]) -> List[str]:
    """A code block whose fence is longer than any run of backticks inside it."""
    longest = max((len(run) for line in lines for run in re.findall(r"`+", line)), default=0)
    ticks = "`" * max(3, longest + 1)
    return [ticks, *lines, ticks]


def _bullets(items: List[str]) -> List[str]:
    return [f"- {item}" for item in items] or ["- none"]


def render_markdown(data: Dict[str, Any]) -> str:
    scope = data["scope"]
    lines = [
        f"# Reconix report — {md(data['assessment_id'])}",
        "",
        f"Client: {md(data.get('client') or '—')}  ",
        f"Target: {md(data['target'])}  ",
        f"Template: {md(data['template'])} · {md(data.get('mode') or '')}  ",
        f"Standards: {md(', '.join(data.get('methodology', [])) or '—')}  ",
        f"Generated: {md(data['generated_at'])} · v{md(data.get('report_version') or '1.0')}",
        "",
        "## Executive summary",
        "",
        f"{md(data['summary'])}. {len(data['blocked_requests'])} out-of-scope request(s) were "
        f"blocked by policy, and {len(data['approvals'])} gated action(s) went to a human.",
        "",
        "## Methodology",
        "",
        "Reconix proposed each action, the policy engine checked it against the approved "
        "scope, and the tool service ran only permitted actions. MEDIUM and HIGH risk "
        "actions waited for an analyst's approval.",
        "",
        "## Approved scope and limitations",
        "",
        f"- Allowed actions: {md(', '.join(scope['allowed_actions']))}",
        f"- Allowed methods: {md(', '.join(scope['allowed_methods']))}",
        f"- Excluded paths: {md(', '.join(scope['excluded_paths']))}",
        f"- Time limit: {scope['time_limit_minutes']} minutes",
        f"- Tools: {md(', '.join(scope['tools']))}",
        "",
        "Blocked requests:",
        "",
        *_bullets([f"{md(b['request'])} — {md(b['reason'])}" for b in data["blocked_requests"]]),
        "",
        "Human approvals:",
        "",
        *_bullets([
            f"{md(a['risk'])} · {md(a['action'])} ({md(a['target'])}) — "
            f"{md(a['decision'].lower())} by {md(a['operator'])}"
            + (f": {md(a['reason'])}" if a["reason"] else "")
            for a in data["approvals"]
        ]),
        "",
        "## Findings and severity",
        "",
        "| ID | Severity | CVSS | Finding | Category | Status | Validation |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for f in data["findings"]:
        cvss = f"{f['cvss_score']:.1f}" if f.get("cvss_score") else "—"
        status = (f.get("status") or "open").replace("-", " ").title()
        lines.append(f"| {md(f['id'])} | {md(f['severity'])} | {cvss} | {md(f['title'])} | "
                     f"{md(f.get('category') or '—')} | {md(status)} | "
                     f"{md(f['validation'].title())} |")
    for f in data["findings"]:
        lines += [
            "",
            f"### {md(f['id'])} · {md(f['title'])}",
            "",
            md(f["description"]),
            "",
            f"Severity: {md(f['severity'])} · CVSS {f['cvss_score']:.1f} "
            f"({md(f.get('cvss_vector') or 'n/a')}) · Category: {md(f.get('category') or '—')}",
            "",
            f"Affected asset: {md(f['affected_url'])}",
            "",
            "Evidence and validation results (masked):",
            "",
            *fence([str(line) for line in f["evidence"]]),
            "",
            f"Impact: {md(f['impact'])}",
            "",
            f"Remediation: {md(f['remediation'])}",
            "",
            f"References: {md(', '.join(f['references']))}",
        ]
    retest = data.get("retest")
    if retest:
        counts = retest["counts"]
        lines += [
            "",
            "## Changes since last assessment",
            "",
            f"Compared with {md(retest['previous_label'])}: {counts['new']} new, "
            f"{counts['resolved']} resolved, {counts['recurring']} recurring.",
        ]
        if retest["new"]:
            lines += ["", "New findings:", ""]
            lines += [f"- {md(i['title'])} ({md(i['severity'])})" for i in retest["new"]]
    return "\n".join(lines) + "\n"
