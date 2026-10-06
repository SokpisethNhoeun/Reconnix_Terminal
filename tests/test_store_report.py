"""Reports: real JSON and Markdown files, only once the assessment is complete."""

import json

import pytest

from reconix import store
from reconix.store import report

from .support import TEST_PASSWORD, run_to


@pytest.fixture(autouse=True)
def reports_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(report, "REPORTS_DIR", tmp_path / "reports")
    return tmp_path / "reports"


def test_no_report_before_the_assessment_is_complete():
    run_to("approval:approval-001")
    with pytest.raises(store.StoreValidationError):
        store.generate_report("json")


def test_report_formats_and_their_availability():
    run_to(None)
    formats = {f.id: f.available for f in store.list_report_formats()}
    assert formats["html"] and formats["sarif"] and formats["csv"]
    assert formats["json"] and formats["markdown"]
    assert formats["pdf"] == report.HAS_PDF      # PDF only when WeasyPrint is installed
    assert formats["docx"] == report.HAS_DOCX    # DOCX only when python-docx is installed
    for fid, available in formats.items():
        if not available:
            with pytest.raises(store.StoreValidationError):
                store.generate_report(fid)
    with pytest.raises(store.StoreValidationError):
        store.generate_report("nope")


def test_sarif_report_is_valid_and_has_a_result_per_finding(reports_dir):
    run_to(None)
    store.generate_report("sarif")
    data = json.loads((reports_dir / "RCX-DEMO-001.sarif").read_text())
    assert data["version"] == "2.1.0"
    assert data["runs"][0]["tool"]["driver"]["name"] == "Reconix"
    assert len(data["runs"][0]["results"]) == 3


def test_csv_report_has_a_header_and_a_row_per_finding(reports_dir):
    run_to(None)
    store.generate_report("csv")
    lines = (reports_dir / "RCX-DEMO-001.csv").read_text().splitlines()
    assert lines[0].startswith("ID,Severity,CVSS")
    assert len(lines) == 1 + 3


@pytest.mark.skipif(not report.HAS_PDF, reason="no PDF engine (WeasyPrint or Chrome) available")
def test_pdf_report_is_the_styled_report_as_a_pdf(reports_dir):
    run_to(None)
    shown = store.generate_report("pdf")
    path = reports_dir / "RCX-DEMO-001.pdf"
    assert shown == str(path)
    assert path.read_bytes()[:5] == b"%PDF-"


@pytest.mark.skipif(not report.HAS_DOCX, reason="python-docx not installed")
def test_docx_report_is_written_as_a_binary_file(reports_dir):
    run_to(None)
    shown = store.generate_report("docx")
    path = reports_dir / "RCX-DEMO-001.docx"
    assert shown == str(path)
    assert path.read_bytes()[:2] == b"PK"        # a .docx is a zip archive


def test_json_report_is_written_and_recorded(reports_dir):
    run_to(None)
    shown = store.generate_report("json")
    path = reports_dir / "RCX-DEMO-001.json"
    assert shown == str(path)
    data = json.loads(path.read_text())
    assert data["assessment_id"] == "RCX-DEMO-001"
    assert [f["id"] for f in data["findings"]] == ["001", "002", "003"]
    assert data["blocked_requests"] == [
        {"request": "GET /admin", "reason": "Path outside approved scope"}]
    assert [a["risk"] for a in data["approvals"]] == ["MEDIUM", "HIGH"]
    assert store.get_run().report_path == shown
    assert store.phase_progress()["report"] == 100
    assert store.list_events()[-1].kind == "report.generated"


def test_markdown_report_has_every_section(reports_dir):
    run_to(None)
    store.generate_report("markdown")
    text = (reports_dir / "RCX-DEMO-001.md").read_text()
    for heading in ("## Executive summary", "## Methodology", "## Approved scope and limitations",
                    "## Findings and severity", "### 001 · Broken object-level authorization"):
        assert heading in text
    assert "•••" in text                      # evidence stays masked


def test_report_data_carries_cvss_category_and_engagement_metadata():
    run_to(None)
    data = store.report_data()
    assert data["client"] == "Example"                   # derived from staging.example.com
    assert data["mode"] == "Grey-box, Authorized"
    assert data["methodology"] == ["OWASP WSTG", "OWASP Top 10 (2021)"]
    assert data["window"]["started"] and data["window"]["finished"]
    first = next(f for f in data["findings"] if f["id"] == "001")
    assert first["cvss_score"] == 7.1
    assert first["cvss_vector"].startswith("CVSS:3.1/")
    assert first["category"] == "Web App"
    assert first["cwe"] == ["CWE-639"]
    assert first["owasp"] == ["OWASP A01:2021", "OWASP API1:2023"]


def test_html_report_is_a_full_styled_document(reports_dir):
    run_to(None)
    shown = store.generate_report("html")
    path = reports_dir / "RCX-DEMO-001.html"
    assert shown == str(path)
    text = path.read_text()
    assert text.startswith("<!doctype html>")
    assert "Security Assessment Report" in text          # masthead title
    assert "RCX-DEMO-001" in text                         # engagement id
    assert "Broken object-level authorization" in text   # a finding
    assert "Executive summary" in text and "Detailed findings" in text
    assert "CVSS 7.1" in text                             # CVSS on the finding
    assert "OWASP WSTG" in text and "Example" in text     # methodology + client cover
    assert "window.print()" in text                       # the export path
    assert "•••" in text                                  # evidence stays masked
    assert store.phase_progress()["report"] == 100


def test_html_report_escapes_dynamic_text(reports_dir, monkeypatch):
    run_to(None)
    finding = store.list_findings()[0]
    monkeypatch.setattr(finding, "description", '<script>alert("x")</script>')
    store.generate_report("html")
    text = (reports_dir / "RCX-DEMO-001.html").read_text()
    assert "<script>alert" not in text                    # injected markup is escaped
    assert "&lt;script&gt;" in text


def test_reports_never_contain_the_test_account(reports_dir):
    run_to(None)
    store.generate_report("json")
    store.generate_report("markdown")
    store.generate_report("html")
    for path in reports_dir.iterdir():
        text = path.read_text()
        assert TEST_PASSWORD not in text
        assert "demo.tester" not in text


def test_summary_counts_every_human_approval():
    run_to(None)
    summary = store.assessment_summary()
    assert summary.status == "Completed"
    assert summary.approvals == ["scope", "MEDIUM", "HIGH"]
    assert (summary.blocked, summary.confirmed, summary.for_review) == (1, 1, 2)
