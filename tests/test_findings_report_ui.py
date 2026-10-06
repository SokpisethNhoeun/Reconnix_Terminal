"""Findings (filter, sort, triage, import), the detail view, and the report: exports and the
web dashboard button."""

import json

from textual.widgets import Button, DataTable, Input, Static

from reconix import store
from reconix.screens import (
    ChoiceScreen, FindingDetailScreen, FindingsListScreen, ReportScreen,
)
from reconix.screens.forms import ImportForm

from .support import SIZE, run_to, run_ui_to, settle, show

NUCLEI = json.dumps({"template-id": "missing-hsts", "matched-at": "https://staging.example.com/",
                     "info": {"name": "HSTS header missing", "severity": "low"}})


def row_ids(app) -> list:
    table = app.screen.query_one("#findings-table", DataTable)
    return [table.coordinate_to_cell_key((i, 0)).row_key.value for i in range(table.row_count)]


async def test_findings_appear_as_the_run_reveals_them(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "findings")
        assert not app.screen.query_one("#findings-table").display     # none yet
        assert "import" in str(app.screen.query_one("#findings-empty", Static).render())
        run_to(None)
        app.refresh_view()
        await settle(pilot)
        assert row_ids(app) == ["001", "002", "003"]


async def test_filter_and_sort(app):
    run_to(None)
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "findings")
        await pilot.press("f")
        await settle(pilot)
        assert isinstance(app.screen, ChoiceScreen)
        await pilot.press("down", "enter")                             # Critical & High
        await settle(pilot)
        assert row_ids(app) == ["001"]
        app.findings_filter = "all"
        await pilot.press("s")                                         # → CVSS
        await settle(pilot)
        assert app.findings_sort == "cvss"
        assert row_ids(app) == ["001", "002", "003"]


async def test_triage_from_the_list_and_the_detail(app):
    run_to(None)
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "findings")
        await pilot.press("down", "t")                                 # 002
        await settle(pilot)
        assert isinstance(app.screen, ChoiceScreen)
        await pilot.press("4")                                         # False positive
        await settle(pilot)
        assert store.get_finding("002").status == "false-positive"
        assert isinstance(app.screen, FindingsListScreen)
        await pilot.press("enter")                                     # open 002
        await settle(pilot)
        assert isinstance(app.screen, FindingDetailScreen)
        assert app.selected_finding == "002"
        await pilot.press("t")
        await settle(pilot)
        await pilot.press("2")                                         # Fixed
        await settle(pilot)
        assert store.get_finding("002").status == "fixed"
        assert isinstance(app.screen, FindingDetailScreen)


async def test_import_adds_findings(app, tmp_path):
    run_to(None)
    scan = tmp_path / "nuclei.jsonl"
    scan.write_text(NUCLEI)
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "findings")
        await pilot.press("i")
        await settle(pilot)
        assert isinstance(app.screen, ImportForm)
        app.screen.query_one("#path", Input).value = str(scan)
        await pilot.press("enter")
        await settle(pilot)
        assert isinstance(app.screen, FindingsListScreen)
        assert "IMP-001" in row_ids(app)


async def test_detail_steps_through_the_list_order(app):
    run_to(None)
    async with app.run_test(size=SIZE) as pilot:
        app.open_finding("001")
        await settle(pilot)
        await pilot.press("right_square_bracket")
        await settle(pilot)
        assert app.selected_finding == "002"
        await pilot.press("left_square_bracket", "left_square_bracket")
        await settle(pilot)
        assert app.selected_finding == "001"                           # no wrap-around
        await pilot.press("left")
        await settle(pilot)
        assert isinstance(app.screen, FindingsListScreen)


async def test_detail_without_a_finding_says_so(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "detail")
        assert "no finding selected" in str(app.screen.query_one("#breadcrumb").render())


# --- the report ----------------------------------------------------------------------------
async def test_exports_wait_for_a_completed_assessment(app):
    run_to("approval:approval-001")
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "report")
        assert app.screen.query_one("#html", Button).disabled
        assert not app.screen.query_one("#web", Button).disabled
        await pilot.press("h")
        await settle(pilot)
        assert store.get_run().report_path == ""


async def test_export_html_then_open_it(app, opened):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, None)
        await show(app, pilot, "report")
        await pilot.press("h")
        await settle(pilot)
        assert isinstance(app.screen, ChoiceScreen)
        path = store.get_run().report_path
        assert path.endswith("RCX-DEMO-001.html")
        await pilot.press("enter")                                     # Open it
        await settle(pilot)
        assert opened == [path]
        assert isinstance(app.screen, ReportScreen)
        assert "report saved" in " ".join(str(w.render()) for w in app.screen.query(Static))


async def test_export_command_offers_every_format(app):
    run_to(None)
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "report")
        await pilot.press("e")                                         # More… = /export
        await settle(pilot)
        assert isinstance(app.screen, ChoiceScreen)
        ids = [o.id for o in app.screen.query_one("#dialog-menu").options]
        assert ids == ["html", "pdf", "docx", "sarif", "csv", "json", "markdown"]
        app.run_command_line("/export sarif")
        await settle(pilot)
        assert store.get_run().report_path.endswith(".sarif")


async def test_web_button_without_a_running_dashboard_says_how(app, opened):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "report")
        app.screen.query_one("#web", Button).press()
        await settle(pilot)
        assert opened == []
        assert any("npm run dev" in str(n.message) for n in app._notifications)


async def test_web_opens_the_running_dashboard(app, opened):
    from reconix.store import persist

    persist.WEB_URL_FILE.write_text("http://127.0.0.1:3100/login#token=abc\n")
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/web")
        await settle(pilot)
        assert opened == ["http://127.0.0.1:3100/login#token=abc"]
        await show(app, pilot, "report")
        await pilot.press("b")
        await settle(pilot)
        assert len(opened) == 2


async def test_web_refuses_a_link_that_is_not_local(app, opened):
    from reconix.store import persist

    persist.WEB_URL_FILE.write_text("https://evil.example.com/login\n")
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/dashboard")
        await settle(pilot)
        assert opened == []
