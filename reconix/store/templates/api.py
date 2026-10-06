"""API template: a REST/GraphQL service."""

from ...models import Finding, ScopeManifest, Template
from ...models.parser import ParsedTarget
from .base import RunBundle, RunProfile, approval, build_rest, make_plan

SPEC = Template("api", "API", "REST and GraphQL endpoints",
                target_hint="the API's base URL", example="https://api.example.com/v1")


def build_scope(parsed: ParsedTarget) -> ScopeManifest:
    return ScopeManifest(
        kind="api", target_url=parsed.target_url, assessment_type="API",
        allowed_actions=["Endpoint discovery", "auth checks", "limited validation"],
        allowed_methods=["GET", "POST"],
        excluded_paths=["/internal", "/admin"],
        time_limit_minutes=30,
        tools=["Nuclei", "Postman", "ZAP API scan"],
    )


def _findings(url: str) -> list:
    return [
        Finding(
            "001", "HIGH", "Broken object-level authorization", "/v1/orders/{id}", "CONFIRMED",
            description="Account A read an order owned by account B through the orders endpoint.",
            affected_url=f"{url}/v1/orders/8842",
            impact="Any authenticated client could read other tenants' records.",
            remediation="Check resource ownership on the server for every object id.",
            tool="ZAP API scan", references=["OWASP API1:2023", "CWE-639"],
            cvss_score=7.1, cvss_vector="CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
            category="API",
            evidence=["GET /v1/orders/8842 as token A → HTTP 200",
                      "owner: tenant_••7 · email: b•••@example.com"],
        ),
        Finding(
            "002", "MEDIUM", "Missing authorization on export endpoint", "/v1/reports/export",
            "UNCONFIRMED",
            description="The export endpoint returned data without checking the caller's role.",
            affected_url=f"{url}/v1/reports/export",
            impact="A low-privilege token may export data meant for admins.",
            remediation="Require and verify an admin scope on the export endpoint.",
            tool="Nuclei", references=["OWASP API5:2023", "CWE-285"],
            cvss_score=6.5, cvss_vector="CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
            category="API",
            evidence=["POST /v1/reports/export with a read-only token → HTTP 202"],
        ),
        Finding(
            "003", "LOW", "No rate limiting on login", "/v1/auth/login", "INCONCLUSIVE",
            description="Repeated login attempts were not throttled.",
            affected_url=f"{url}/v1/auth/login",
            impact="Enables credential-stuffing against the API.",
            remediation="Add per-IP and per-account rate limiting with backoff.",
            tool="Postman", references=["OWASP API4:2023", "CWE-307"],
            cvss_score=3.7, cvss_vector="CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N",
            category="API",
            evidence=["50 POST /v1/auth/login in 5s · all answered 401, none throttled"],
        ),
    ]


def build_run(assessment) -> RunBundle:
    url, host = assessment.target_url, assessment.target
    scope = build_scope(ParsedTarget("api", host, url, "API service", "api", True))
    findings = _findings(url)
    profile = RunProfile(
        target_kind="API service", tools=scope.tools,
        discovery_tool="ZAP API scan",
        discovery_card=("Discovery · API",
                        (("Endpoints", "24"), ("Auth scheme", "Bearer"), ("GraphQL", "no"))),
        discovery_requests=(96, 142),
        blocked=("GET", "/internal/metrics"),
        scan_card=("Scan · Nuclei + ZAP",
                   (("Potential issues", "3"), ("Needs token", "/v1/orders/*"))),
        scan_requests=(133, 120, 48),
        auth="cookie",
        auth_reason="Session cookie required for /v1/orders/*",
        candidate_note="Suspected broken object-level authorization on /v1/orders/{id}. "
                       "Proposing limited validation.",
        candidate_log="Candidate F-001 · authorization",
        medium=approval(
            "approval-001", risk="MEDIUM", action="Baseline request (read-only)",
            target="GET /v1/orders/8842 (token A)", method="GET", path="/v1/orders/8842",
            purpose="Record the normal response for the token's own order",
            impact="Low. One read request, no data changes",
            command=f"GET {url}/v1/orders/8842 as token A"),
        high=approval(
            "approval-002", risk="HIGH", action="limited_validation",
            target="GET /v1/orders/8843 (token B's order)", method="GET", path="/v1/orders/8843",
            purpose="Check if token A can read an order owned by account B",
            impact="May read synthetic test data. 1 request, no changes",
            command=f"GET {url}/v1/orders/8843 as token A"),
        findings=findings,
        analysis_steps=("Analyzing results", "Retrieving relevant OWASP API guidance",
                        "Correlating duplicate findings", "Masking sensitive evidence"),
        scan_tool="Nuclei",
        plan=(("discovery", "Map API surface"),
              ("scanning", "Scan endpoints"),
              ("validation", "Validate authz & inputs"),
              ("analysis", "Correlate & dedupe findings"),
              ("report", "Generate report")),
        methodology=("OWASP API Security Top 10 (2023)", "OWASP WSTG"),
    )
    return RunBundle(scope=scope, script=build_rest(profile),
                     approvals=[profile.medium, profile.high], findings=findings,
                     auth_kind=profile.auth, plan=make_plan(profile.plan),
                     methodology=list(profile.methodology))
