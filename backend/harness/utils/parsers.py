"""Turn raw tool output (as returned by the MCP server) into Finding objects.

These are deliberately tolerant: tool output formats drift between versions, so
each parser extracts what it can and never raises on unexpected lines. Pure
functions with no I/O, so they're unit-testable offline (see tests/).
"""

from __future__ import annotations

import json
import re

from ..models import Finding, Severity

# e.g. "22/tcp   open  ssh     OpenSSH 8.4p1"
_NMAP_PORT = re.compile(
    r"^(?P<port>\d+)/(?P<proto>tcp|udp)\s+(?P<state>\w+)\s+(?P<service>[\w\-/]+)?\s*(?P<version>.*)$"
)


def parse_nmap(output: str, scan_id: int) -> list[Finding]:
    findings: list[Finding] = []
    for line in output.splitlines():
        m = _NMAP_PORT.match(line.strip())
        if not m or m.group("state") != "open":
            continue
        port = m.group("port")
        proto = m.group("proto")
        service = (m.group("service") or "unknown").strip()
        version = (m.group("version") or "").strip()
        findings.append(
            Finding(
                scan_id=scan_id,
                severity=Severity.INFO,
                title=f"Open port {port}/{proto} ({service})",
                description=f"nmap reports {service} open on {port}/{proto}.",
                evidence=line.strip(),
                location=f"{port}/{proto}",
                verified=True,
            )
        )
    return findings


def parse_nuclei(output: str, scan_id: int) -> list[Finding]:
    """Parse nuclei JSONL (one JSON object per line)."""
    findings: list[Finding] = []
    for line in output.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        info = obj.get("info", {}) or {}
        template = obj.get("template-id") or obj.get("templateID") or "nuclei"
        matched = obj.get("matched-at") or obj.get("matched_at") or obj.get("host") or ""
        classification = info.get("classification", {}) or {}
        cve_ids = classification.get("cve-id") or classification.get("cve_id") or []
        cve = cve_ids[0] if isinstance(cve_ids, list) and cve_ids else (cve_ids or None)
        cvss = classification.get("cvss-score") or classification.get("cvss_score")
        findings.append(
            Finding(
                scan_id=scan_id,
                severity=Severity.coerce(info.get("severity", "info")),
                title=info.get("name") or template,
                description=(info.get("description") or "").strip(),
                evidence=line,
                location=str(matched),
                cve_id=cve,
                cvss_score=float(cvss) if isinstance(cvss, (int, float)) else None,
                verified=True,
            )
        )
    return findings


_SQLMAP_PARAM = re.compile(r"Parameter:\s*(?P<param>.+?)\s*\((?P<place>[^)]+)\)")
_SQLMAP_TYPE = re.compile(r"^\s*Type:\s*(?P<type>.+)$", re.MULTILINE)


def parse_sqlmap(output: str, scan_id: int) -> list[Finding]:
    findings: list[Finding] = []
    vulnerable = (
        "is vulnerable" in output
        or "sqlmap identified the following injection point" in output.lower()
        or "Parameter:" in output
    )
    if not vulnerable:
        return findings

    types = [m.group("type").strip() for m in _SQLMAP_TYPE.finditer(output)]
    params = _SQLMAP_PARAM.findall(output)
    if params:
        for param, place in params:
            findings.append(
                Finding(
                    scan_id=scan_id,
                    severity=Severity.HIGH,
                    title=f"SQL injection in parameter '{param}' ({place})",
                    description="sqlmap confirmed an injectable parameter."
                    + (f" Technique(s): {', '.join(types)}." if types else ""),
                    evidence=_excerpt(output),
                    location=param,
                    verified=True,
                )
            )
    else:
        findings.append(
            Finding(
                scan_id=scan_id,
                severity=Severity.HIGH,
                title="SQL injection confirmed by sqlmap",
                description="sqlmap reported the target as vulnerable to SQL injection.",
                evidence=_excerpt(output),
                verified=True,
            )
        )
    return findings


def _excerpt(text: str, limit: int = 1500) -> str:
    text = text.strip()
    return text if len(text) <= limit else text[:limit] + "\n...[truncated]"


_ANSI = re.compile(r"\x1b\[[0-9;?]*[a-zA-Z]")


def _clean(text: str) -> str:
    return _ANSI.sub("", text)


def parse_whatweb(output: str, scan_id: int) -> list[Finding]:
    """whatweb prints one line per target: 'URL [200 OK] Plugin[val], Plugin2, …'."""
    findings: list[Finding] = []
    for line in _clean(output).splitlines():
        line = line.strip()
        if not line or not line.lower().startswith("http"):
            continue
        url = line.split()[0]
        findings.append(
            Finding(
                scan_id=scan_id,
                severity=Severity.INFO,
                title="Technology fingerprint (whatweb)",
                description="Detected technologies/plugins on the target.",
                evidence=_excerpt(line, 1000),
                location=url,
                verified=True,
            )
        )
    return findings


# nikto lines that are run metadata, not findings.
_NIKTO_SKIP = (
    "Target IP", "Target Hostname", "Target Port", "Start Time", "End Time",
    "host(s) tested", "Scan terminated", "requests:", "error(s) and",
)


def parse_nikto(output: str, scan_id: int) -> list[Finding]:
    findings: list[Finding] = []
    for line in _clean(output).splitlines():
        line = line.strip()
        if not line.startswith("+ "):
            continue
        msg = line[2:].strip()
        if any(msg.startswith(p) or p in msg for p in _NIKTO_SKIP):
            continue
        low = msg.lower()
        if any(k in low for k in ("not present", "not set", "without", "httponly", "header missing", "missing:")):
            sev = Severity.LOW
        elif any(k in low for k in ("osvdb", "vulnerable", "injection", "traversal", "disclosure", "outdated")):
            sev = Severity.MEDIUM
        else:
            sev = Severity.INFO
        findings.append(
            Finding(
                scan_id=scan_id,
                severity=sev,
                title=_trim(msg, 110),
                description="Reported by nikto.",
                evidence=msg,
                verified=True,
            )
        )
    return findings


def parse_commix(output: str, scan_id: int) -> list[Finding]:
    out = _clean(output)
    low = out.lower()
    if not any(k in low for k in ("is vulnerable", "injection point", "seems to be injectable", "resumed")):
        return []
    return [
        Finding(
            scan_id=scan_id,
            severity=Severity.CRITICAL,
            title="OS command injection confirmed by commix",
            description="commix reported an injectable parameter allowing OS command execution.",
            evidence=_excerpt(out),
            verified=True,
        )
    ]


_GOBUSTER = re.compile(r"^(/\S*)\s+\(Status:\s*(\d+)\)")


def parse_gobuster(output: str, scan_id: int) -> list[Finding]:
    findings: list[Finding] = []
    for line in _clean(output).splitlines():
        m = _GOBUSTER.match(line.strip())
        if not m:
            continue
        path, status = m.group(1), m.group(2)
        findings.append(
            Finding(
                scan_id=scan_id,
                severity=Severity.INFO,
                title=f"Discovered path {path} (HTTP {status})",
                description="Content discovered by gobuster.",
                evidence=line.strip(),
                location=path,
                verified=True,
            )
        )
    return findings


def _trim(text: str, n: int) -> str:
    text = (text or "").strip()
    return text if len(text) <= n else text[: n - 1] + "…"


def parse_httpprobe(output: str, scan_id: int) -> list[Finding]:
    """Parse the HttpProbeScanner's JSON-line output (one request per line).

    Flags IDOR/BOLA when one authenticated session reads ≥2 distinct objects by
    id (HTTP 200 with differing bodies); otherwise records the statuses as info.
    """
    recs: list[dict] = []
    for line in output.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            recs.append(json.loads(line))
        except (json.JSONDecodeError, ValueError):
            continue
    if not recs:
        return []
    if len(recs) == 1 and "error" in recs[0]:
        return [Finding(scan_id=scan_id, severity=Severity.INFO, title="Authenticated probe error",
                        description="The authenticated HTTP probe could not complete.",
                        evidence=str(recs[0])[:400], location="")]
    ided_ok = [r for r in recs if r.get("status") == 200 and r.get("body") and r.get("id") not in (None, "-")]
    distinct_bodies = {r["body"] for r in ided_ok}
    if len(ided_ok) >= 2 and len(distinct_bodies) >= 2:
        ids = ", ".join(str(r["id"]) for r in ided_ok)
        ev = " | ".join(f"id={r['id']} {r['status']} len={r.get('len')}" for r in ided_ok)
        # Distinct body SIZES raise confidence: real per-object data differs in size, while a
        # templated catch-all (SPA root, "object <id> not found") differs only by the echoed
        # id — same length. Same-length-but-different-content is possible BOLA but ambiguous,
        # so report it MEDIUM/unverified rather than claiming a verified HIGH on a likely page.
        lens = {r.get("len") if isinstance(r.get("len"), int) else len(r["body"]) for r in ided_ok}
        if len(lens) >= 2:
            return [Finding(
                scan_id=scan_id, severity=Severity.HIGH, title="Broken access control (IDOR/BOLA)",
                description=f"With one authenticated session, objects addressed by id returned HTTP 200 "
                            f"with distinct bodies of differing size (ids: {ids}) — the session reads "
                            f"objects it does not own.",
                evidence=ev[:500], location=str(ided_ok[0].get("url", "")), verified=True)]
        return [Finding(
            scan_id=scan_id, severity=Severity.MEDIUM, title="Possible broken access control (IDOR/BOLA)",
            description=f"Objects addressed by id returned HTTP 200 with different content but identical "
                        f"size (ids: {ids}). This may be real per-object data or a templated catch-all; "
                        f"verify the bodies are distinct objects before confirming.",
            evidence=ev[:500], location=str(ided_ok[0].get("url", "")), verified=False)]
    # Surface status AND body length per id: identical lengths across ids suggest a catch-all
    # (e.g. an SPA root), differing lengths suggest real per-object data.
    statuses = ", ".join(f"{r.get('id')}:{r.get('status')}(len={r.get('len')})" for r in recs)
    return [Finding(scan_id=scan_id, severity=Severity.INFO, title="Authenticated probe result",
                    description="Authenticated HTTP probe responses (status + body length per id). "
                                "Differing lengths across object ids indicate real per-object data.",
                    evidence=statuses[:500], location=str(recs[0].get("url", "")))]


def parse_upload(output: str, scan_id: int) -> list[Finding]:
    """Parse the UploadScanner's own verdict string."""
    if not output.startswith("UPLOAD_VULNERABLE"):
        return []
    # format: "UPLOAD_VULNERABLE <upload_url> -> <retrieve_url> marker=<m>"
    detail = output[len("UPLOAD_VULNERABLE"):].strip()
    loc = detail.split(" -> ")[0].strip() if "->" in detail else detail
    return [
        Finding(
            scan_id=scan_id,
            severity=Severity.HIGH,
            title="Unrestricted file upload",
            description="An uploaded file with an arbitrary name/extension was stored and "
            "retrieved back verbatim, indicating no validation of upload type/content.",
            evidence=detail[:500],
            location=loc,
            verified=True,
        )
    ]


_ZAP_RISK = {
    "critical": Severity.CRITICAL,
    "high": Severity.HIGH,
    "medium": Severity.MEDIUM,
    "low": Severity.LOW,
    "informational": Severity.INFO,
    "info": Severity.INFO,
}
# "[Medium] Content Security Policy (CSP) Header Not Set (High) — http://host/x"
_ZAP_LINE = re.compile(
    r"^\[(?P<risk>[A-Za-z]+)\]\s+(?P<rest>.+?)\s+[—–-]\s+(?P<url>https?://\S+)\s*$"
)
_ZAP_CONF = re.compile(r"\s*\((High|Medium|Low|Informational)\)\s*$")
_ZAP_CWE = re.compile(r"CWE-(\d+)")


def parse_zap(output: str, scan_id: int) -> list[Finding]:
    """Parse the Kali MCP `zap_alerts` text output into Findings.

    Deduplicates by (alert name, risk, url) so Juice Shop's hundreds of repeated
    passive alerts collapse to the distinct issues per URL.
    """
    findings: list[Finding] = []
    seen: set[tuple[str, str, str]] = set()
    current: Finding | None = None
    for raw_line in _clean(output).splitlines():
        line = raw_line.rstrip()
        m = _ZAP_LINE.match(line.strip())
        if m:
            risk = m.group("risk")
            name = _ZAP_CONF.sub("", m.group("rest")).strip()  # drop trailing (Confidence)
            url = m.group("url")
            key = (name, risk.lower(), url)
            if key in seen:
                current = None
                continue
            seen.add(key)
            current = Finding(
                scan_id=scan_id,
                severity=_ZAP_RISK.get(risk.lower(), Severity.INFO),
                title=name,
                description="Reported by OWASP ZAP.",
                location=url,
                verified=True,
            )
            findings.append(current)
        elif current is not None and line.strip():
            # continuation: evidence=... and/or CWE-NNN
            detail = line.strip()
            cwe = _ZAP_CWE.search(detail)
            if cwe:
                current.cve_id = f"CWE-{cwe.group(1)}"
            if detail.startswith("evidence="):
                current.evidence = detail[len("evidence="):].strip()[:500]
    return findings
