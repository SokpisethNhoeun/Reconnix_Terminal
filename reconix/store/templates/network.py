"""Network template: hosts, ports and exposed services on a range or host."""

from ...models import Finding, ScopeManifest, Template
from ...models.parser import ParsedTarget
from .base import RunBundle, RunProfile, approval, build_rest, make_plan

SPEC = Template("network", "Network", "Hosts, ports, and exposed services",
                target_hint="an IPv4 address or range, or a hostname", example="10.0.0.0/24")

ALLOWED_PORTS = [22, 80, 443, 8080, 8443]


def build_scope(parsed: ParsedTarget) -> ScopeManifest:
    return ScopeManifest(
        kind="network", target_url=parsed.target_url, assessment_type="Network",
        allowed_actions=["Host discovery", "port scan", "service detection"],
        allowed_methods=["TCP connect"],
        excluded_paths=[],       # network scope uses allowed_ports + the target range
        time_limit_minutes=30,
        tools=["nmap", "testssl.sh"],
        allowed_ports=list(ALLOWED_PORTS),
    )


def _findings(host: str) -> list:
    return [
        Finding(
            "001", "HIGH", "Management console exposed", f"{host}:8443/manager", "CONFIRMED",
            description="A Tomcat Manager console answered on 8443 and accepted a login form.",
            affected_url=f"https://{host}:8443/manager",
            impact="If credentials are weak, an attacker could deploy code to the host.",
            remediation="Restrict the console to an admin network or disable it.",
            tool="nmap", references=["CWE-284", "OWASP A05:2021"],
            cvss_score=7.3, cvss_vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:L",
            category="Network",
            evidence=["8443/tcp open ssl/http Apache Tomcat",
                      "GET /manager/html → 401 WWW-Authenticate: Basic"],
        ),
        Finding(
            "002", "MEDIUM", "Deprecated TLS 1.0 offered", f"{host}:443", "UNCONFIRMED",
            description="The HTTPS service still negotiates TLS 1.0.",
            affected_url=f"https://{host}:443",
            impact="Weak protocol versions expose traffic to downgrade attacks.",
            remediation="Disable TLS 1.0/1.1 and prefer TLS 1.2+ with modern ciphers.",
            tool="testssl.sh", references=["CWE-327"],
            cvss_score=5.9, cvss_vector="CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N",
            category="Network",
            evidence=["TLS 1.0   offered (NOT ok)", "TLS 1.2   offered (OK)"],
        ),
        Finding(
            "003", "LOW", "SSH banner reveals version", f"{host}:22", "INCONCLUSIVE",
            description="The SSH service banner discloses its exact version.",
            affected_url=f"{host}:22",
            impact="Version disclosure helps an attacker match known exploits.",
            remediation="Suppress the detailed banner where the SSH server allows it.",
            tool="nmap", references=["CWE-200"],
            cvss_score=3.7, cvss_vector="CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N",
            category="Network",
            evidence=["22/tcp open ssh OpenSSH 8.2p1 (banner shown)"],
        ),
    ]


def build_run(assessment) -> RunBundle:
    host = assessment.target
    scope = build_scope(ParsedTarget("network", host, host, "network range", "network", True))
    findings = _findings(host)
    out_of_scope = "198.51.100.9"     # a host outside the approved range (RFC 5737)
    profile = RunProfile(
        target_kind="network range", tools=scope.tools,
        discovery_tool="nmap",
        discovery_card=("Discovery · nmap",
                        (("Live hosts", "6"), ("Open ports", "11"), ("Services", "7"))),
        discovery_requests=(0, 0),
        blocked=("TCP", out_of_scope),
        scan_card=("Services · nmap",
                   (("Web", "2"), ("SSH", "1"), ("Management console", "1"))),
        scan_requests=(0, 0, 0),
        candidate_note="Management console on 8443 may accept weak credentials. Proposing a "
                       "single, controlled login check.",
        candidate_log="Candidate F-001 · exposed console",
        medium=approval(
            "approval-001", risk="MEDIUM", action="Banner and TLS check (read-only)",
            target=f"TCP {host}:8443", method="TCP", path=f"{host}:8443",
            purpose="Record the service banner and TLS versions on the console port",
            impact="Low. Connects once, sends no credentials",
            command=f"connect {host}:8443 · read banner + TLS"),
        high=approval(
            "approval-002", risk="HIGH", action="single_login_probe",
            target=f"TCP {host}:8443/manager", method="TCP", path=f"{host}:8443",
            purpose="Try one known default credential against the management console",
            impact="One authentication attempt. No change to the host",
            command=f"POST {host}:8443/manager/html · one default credential"),
        findings=findings,
        analysis_steps=("Analyzing results", "Matching services to known CVEs",
                        "Correlating duplicate findings", "Masking sensitive evidence"),
        scan_tool="nmap",
        plan=(("discovery", "Host discovery"),
              ("scanning", "Port & service scan"),
              ("validation", "Validate exposures"),
              ("analysis", "Correlate & dedupe findings"),
              ("report", "Generate report")),
        methodology=("NIST SP 800-115", "PTES"),
    )
    return RunBundle(scope=scope, script=build_rest(profile),
                     approvals=[profile.medium, profile.high], findings=findings,
                     plan=make_plan(profile.plan), methodology=list(profile.methodology))
