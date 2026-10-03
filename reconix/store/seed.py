"""Demo rows loaded into the in-memory lists at startup.

Everything here is canned and illustrative — no real scanning happens. The target
`staging.example.com` is a reserved example domain (RFC 2606).
"""

from copy import deepcopy

from ..models import (
    ApprovalRequest, Assessment, ExecTask, Finding, HistoryEntry, LogLine, PlanStep,
    UserRequest,
)
from . import lists

ASSESSMENT_ID = "assessment-001"
TARGET = "staging.example.com"


# --------------------------------------------------------------------- assessment
def _assessment() -> Assessment:
    return Assessment(
        assessment_id=ASSESSMENT_ID,
        target=TARGET,
        model="vllm/qwen2.5-32b",
        policy="strict",
        operator="local",
        template="network + web assessment",
        scope={
            "scope_id": ASSESSMENT_ID,
            "targets": [TARGET],
            "allowed_actions": [
                "host_discovery", "port_scan", "service_detection",
                "http_check", "web_vuln_scan",
            ],
            "allowed_ports": [80, 443, 8080, 8443],
            "allowed_url_patterns": [f"https://{TARGET}/*"],
            "excluded_paths": ["/admin", "/billing"],
            "allowed_http_methods": ["GET", "HEAD", "OPTIONS"],
            "allowed_tools": ["nmap", "nuclei", "zap", "httpx"],
            "out_of_scope": ["*.prod.example.com", "payment-gw"],
        },
        intent={
            "target": TARGET,
            "type": "web_url",
            "task": "web_vulnerability_assessment",
            "confidence": "0.92",
        },
        summary=(
            "The assessment of staging.example.com identified 6 findings across network and web "
            "layers. One high-severity SQL injection was confirmed via controlled, detection-only "
            "validation; a second high-severity exposure (Tomcat Manager) needs manual review. "
            "No critical issues were found. Overall risk: HIGH."
        ),
    )


USER_REQUEST = "scan staging.example.com for exposed services and obvious web issues"


# --------------------------------------------------------------------------- plan
PLAN = [
    PlanStep(1, "host_discovery", "nmap -sn staging.example.com", "LOW", "auto",
             "Confirms the host is up before deeper checks.", "nmap"),
    PlanStep(2, "port_scan", "nmap -p 80,443,8080,8443 -sV staging.example.com", "LOW", "auto",
             "Limited to the ports allowed in the scope manifest.", "nmap"),
    PlanStep(3, "service_detection", "nmap -sV --version-intensity 5 staging.example.com", "LOW", "auto",
             "Identifies service versions for CVE matching.", "nmap"),
    PlanStep(4, "http_probe", "httpx -status-code -title -tech-detect -u https://staging.example.com", "LOW", "auto",
             "Fingerprints the web stack, read-only.", "httpx"),
    PlanStep(5, "web_vuln_scan", "nuclei -u https://staging.example.com -tags cve,exposure -severity medium,high", "HIGH", "approve",
             "Sends active probes that may alter app state. Detection-only mode is enforced.", "nuclei"),
]


def _approval_request(step: PlanStep) -> ApprovalRequest:
    return ApprovalRequest(
        request_id="approval-001",
        step_num=step.num,
        command=f"{step.command} -rl 20 -timeout 10",
        command_hash="sha256:9f3a…c1",
        phrase=f"APPROVE {step.action} ON {TARGET} FOR {ASSESSMENT_ID}",
        summary="active injection probes",
        tool_info="v3.x · templates: cve, exposure, sqli, xss",
        context="3 live services, 2 web endpoints",
    )


# ---------------------------------------------------------------------- findings
FINDINGS = [
    Finding(
        "REC-001", "HIGH", "SQL Injection (error-based)", "/product?id=", "nuclei", "CWE-89",
        "CONFIRMED", "8.6",
        "Unsanitized input in the id parameter reaches a SQL query. An attacker could read "
        "or alter database records, potentially exposing user data.",
        "Use parameterized queries / prepared statements. Validate and type-cast the id "
        "input. Run the app with a least-privilege DB account. Retest after the fix.",
        ["OWASP A03:2021 — Injection", "CWE-89 — SQL Injection", "OWASP WSTG-INPV-05"],
        [
            ("request", "", "dim"),
            ("", "GET /product?id=12' HTTP/1.1", "text"),
            ("", "Host: staging.example.com", "text"),
            ("response", "", "dim"),
            ("", "HTTP/1.1 500 Internal Server Error", "text"),
            ("", "… error in your SQL syntax near …", "string"),
            ("matcher", "", "dim"),
            ("", 'word: "SQL syntax" → matched', "green"),
        ],
    ),
    Finding(
        "REC-002", "HIGH", "Tomcat Manager exposed", "staging:8443/manager", "nuclei", "CWE-284",
        "NEEDS REVIEW", "7.5",
        "The Tomcat Manager console is reachable from the network. If weak credentials are "
        "in use it could allow application deployment.",
        "Restrict /manager to an internal admin network, enforce strong unique credentials, "
        "or disable the Manager app in production-like environments.",
        ["CWE-284 — Improper Access Control", "OWASP A01:2021 — Broken Access Control"],
        [
            ("request", "", "dim"),
            ("", "GET /manager/html HTTP/1.1", "text"),
            ("response", "", "dim"),
            ("", "HTTP/1.1 401 Unauthorized", "text"),
            ("", 'WWW-Authenticate: Basic realm="Tomcat Manager"', "string"),
        ],
    ),
    Finding(
        "REC-003", "MEDIUM", "Reflected input in search", "/search?q=", "zap", "CWE-79",
        "UNCONFIRMED", "6.1",
        "User input in the q parameter is reflected in the page without encoding, which may "
        "allow cross-site scripting.",
        "Context-aware output encoding for all reflected input, plus a strict "
        "Content-Security-Policy.",
        ["CWE-79 — Cross-site Scripting", "OWASP A03:2021 — Injection"],
        [("note", "", "dim"), ("", "Marker string reflected unencoded in response body.", "text")],
    ),
    Finding(
        "REC-004", "MEDIUM", "Missing security headers", TARGET, "nuclei", "CWE-693",
        "UNCONFIRMED", "5.3",
        "Responses lack Content-Security-Policy, X-Frame-Options and HSTS, weakening "
        "browser-side defenses.",
        "Add CSP, X-Frame-Options/frame-ancestors, Strict-Transport-Security and "
        "X-Content-Type-Options headers at the reverse proxy.",
        ["CWE-693 — Protection Mechanism Failure", "OWASP Secure Headers Project"],
        [("missing", "", "dim"), ("", "content-security-policy, x-frame-options, strict-transport-security", "text")],
    ),
    Finding(
        "REC-005", "LOW", "TLS 1.0 enabled", "staging:443", "nmap", "CWE-327",
        "INCONCLUSIVE", "3.7",
        "The server still negotiates TLS 1.0, a deprecated protocol version.",
        "Disable TLS 1.0/1.1; allow TLS 1.2+ with modern cipher suites.",
        ["CWE-327 — Broken or Risky Crypto", "RFC 8996 — Deprecating TLS 1.0/1.1"],
        [("handshake", "", "dim"), ("", "TLSv1.0 accepted — needs manual confirmation", "text")],
    ),
    Finding(
        "REC-006", "INFO", "Server version disclosure", "Apache/2.4.x", "httpx", "CWE-200",
        "UNCONFIRMED", "0.0",
        "The Server header discloses the web server product and version.",
        "Set ServerTokens Prod / suppress version banners.",
        ["CWE-200 — Information Exposure"],
        [("header", "", "dim"), ("", "Server: Apache/2.4.x (Debian)", "text")],
    ),
]


# --------------------------------------------------------------------- execution
EXEC_TASKS = [
    ExecTask("host_discovery",    "nmap",   "DONE",    "3 live hosts"),
    ExecTask("port_scan",         "nmap",   "DONE",    "7 open ports"),
    ExecTask("service_detection", "nmap",   "DONE",    "5 services"),
    ExecTask("http_probe",        "httpx",  "DONE",    "2 endpoints"),
    ExecTask("web_vuln_scan",     "nuclei", "RUNNING", "nuclei · running",
             result=f"{len(FINDINGS)} findings"),
]

SCAN_OUTPUT = [
    LogLine("info", message="nuclei v3.3 · templates loaded"),
    LogLine("info", message="targets: 2 · rate-limit: 20 req/s · detection-only"),
    LogLine("match", template="http-missing-security-headers",
            target="https://staging.example.com", severity="info"),
    LogLine("match", template="tomcat-manager-exposure",
            target="https://staging.example.com:8443", severity="high"),
    LogLine("match", template="sql-error-message", target="/product?id=", severity="high"),
    LogLine("match", template="reflected-input", target="/search?q=", severity="medium"),
    LogLine("match", template="weak-tls-version", target="staging.example.com:443", severity="low"),
    LogLine("info", message=f"scan complete · {len(FINDINGS)} results · normalizing…"),
]


# -------------------------------------------------------------------------- load
def load_demo_data() -> None:
    """Empty every list and fill it with fresh copies of the demo rows."""
    for table in lists.ALL_LISTS:
        table.clear()
    lists.ASSESSMENTS.append(_assessment())
    lists.REQUESTS.append(UserRequest(USER_REQUEST))
    lists.PROMPT_HISTORY.append(HistoryEntry(USER_REQUEST))
    lists.PLAN_STEPS.extend(deepcopy(PLAN))
    lists.APPROVAL_REQUESTS.append(_approval_request(PLAN[4]))
    lists.EXEC_TASKS.extend(deepcopy(EXEC_TASKS))
    lists.SCAN_OUTPUT.extend(deepcopy(SCAN_OUTPUT))
    lists.FINDINGS.extend(deepcopy(FINDINGS))
