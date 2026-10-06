"""The read-only dialogs (findings, scope, activity) and the report dialog."""

from textual.widgets import DataTable

from reconix import store
from reconix.screens.dialogs import (
    FindingsDialog, ReportDialog, ScopeManifestDialog, SummaryDialog,
)
from reconix.store import report
from reconix.widgets import FormatPicker, KeyValueGrid

from .support import SIZE, event_kinds, run_ui_to


async def test_findings_are_empty_before_the_run(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("f2")
        await pilot.pause()
        assert isinstance(app.screen, FindingsDialog)
        assert not app.screen.query(DataTable)


async def test_findings_table_drives_the_detail(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, None)
        await pilot.press("f2")
        await pilot.pause()
        table = app.screen.query_one(DataTable)
        assert table.row_count == 3
        grid = app.screen.query_one("#finding-grid", KeyValueGrid)
        assert "OBJECT-LEVEL" in str(app.screen.query_one("#finding-detail").border_title)
        await pilot.press("down")
        await pilot.pause()
        assert "REFLECTED INPUT" in str(app.screen.query_one("#finding-detail").border_title)
        assert grid is app.screen.query_one("#finding-grid", KeyValueGrid)


async def test_slash_finding_opens_one_finding(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, None)
        assert app.run_command_line("/finding 003")
        await pilot.pause()
        assert isinstance(app.screen, FindingsDialog)
        assert "SAMESITE" in str(app.screen.query_one("#finding-detail").border_title)


async def test_scope_is_read_only_after_approval(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "account")
        await pilot.press("escape")
        await pilot.pause()
        await pilot.press("f3")
        await pilot.pause()
        assert isinstance(app.screen, ScopeManifestDialog)
        assert not app.screen.query("#approve")
        assert app.focused.id == "close"


async def test_report_formats_skip_the_ones_not_in_the_demo(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, None)
        await pilot.press("f5")
        await pilot.pause()
        assert isinstance(app.screen, ReportDialog)
        picker = app.screen.query_one(FormatPicker)
        available = [f.id for f in store.list_report_formats() if f.available]
        assert picker.selected == available[0] == "html"
        # arrowing right only ever lands on an available format (disabled ones are skipped)
        for _ in range(len(available) + 1):
            await pilot.press("right")
            assert picker.selected in available
        for _ in range(len(available) + 2):            # navigate to markdown and generate it
            if picker.selected == "markdown":
                break
            await pilot.press("right")
        assert picker.selected == "markdown"
        await pilot.press("enter")
        await pilot.pause()
        assert store.get_run().report_path.endswith("RCX-DEMO-001.md")


async def test_web_command_opens_the_dashboard(app, tmp_path, monkeypatch):
    from reconix.store import persist

    link = "http://127.0.0.1:3100/login#token=xyz"
    (tmp_path / "web.url").write_text(f"{link}\n")
    monkeypatch.setattr(persist, "WEB_URL_FILE", tmp_path / "web.url")
    opened: list = []
    monkeypatch.setattr("reconix.app._open_url", lambda url: (opened.append(url), True)[1])
    async with app.run_test(size=SIZE) as pilot:
        assert app.run_command_line("/web") is True
        await pilot.pause()
        assert opened == [link]


async def test_findings_triage_button_sets_status(app):
    from reconix.screens.choice import ChoiceScreen
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, None)
        await pilot.press("f2")
        await pilot.pause()
        assert isinstance(app.screen, FindingsDialog)
        fid = app.screen._highlighted_fid()                 # the most severe finding
        await pilot.click("#triage")
        await pilot.pause()
        assert isinstance(app.screen, ChoiceScreen)
        await pilot.press("down", "enter")                  # open -> Fixed, confirm
        await pilot.pause()
        assert isinstance(app.screen, FindingsDialog)
        assert store.get_finding(fid).status == "fixed"


async def test_summary_open_report_button_launches_the_browser(app, tmp_path, monkeypatch):
    monkeypatch.setattr(report, "REPORTS_DIR", tmp_path / "reports")
    opened = []
    monkeypatch.setattr("reconix.screens.dialogs.summary.webbrowser.open",
                        lambda url: (opened.append(url), True)[1])
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, None)
        await pilot.press("f5", "enter")                # generate the HTML report (default)
        await pilot.pause()
        assert isinstance(app.screen, SummaryDialog)
        await pilot.press("left", "enter")              # focus "Open report" and press it
        await pilot.pause()
        assert len(opened) == 1
        assert opened[0].startswith("file://") and opened[0].endswith("RCX-DEMO-001.html")
        assert isinstance(app.screen, SummaryDialog)    # stays open after opening the report


async def test_activity_dialog_lists_rows_and_audit_events(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "scope")
        await pilot.press("escape", "f4")
        await pilot.pause()
        assert len(app.screen.query(".activity-row")) == len(store.list_activity())
        audit = app.screen.query_one("#audit-table")
        assert [row[1] for row in audit.rows] == event_kinds()


async def test_new_assessment_starts_over_with_a_fresh_dashboard(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, None)
        old = app.screen
        assert app.run_command_line("/new")
        await pilot.pause()
        assert app.screen is not old
        assert not store.get_run().started
        assert len(app.screen_stack) == 2


async def test_finding_text_is_never_markup(app):
    from reconix.store import lists
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, None)
        lists.current().findings[0].title = "[/x] [link=https://evil.example]click[/link]"
        await pilot.press("f2")
        await pilot.pause()
        assert isinstance(app.screen, FindingsDialog)


async def test_the_password_field_cannot_be_copied(app):
    from reconix.widgets import SecretInput
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "account")
        field = app.screen.query_one("#secret", SecretInput)
        field.value = "s3cret"
        field.focus()
        await pilot.press("shift+home", "ctrl+c", "ctrl+x")
        await pilot.pause()
        assert field.value == "s3cret"                # cut did nothing
        assert app.clipboard != "s3cret"


async def test_import_from_the_findings_dialog(app, tmp_path):
    import json

    from reconix.screens.dialogs import ImportDialog
    from textual.widgets import Input
    nuclei = tmp_path / "n.jsonl"
    nuclei.write_text(json.dumps({"template-id": "t", "matched-at": "https://x.example/a",
                                  "info": {"name": "Imported issue", "severity": "medium"}}))
    async with app.run_test(size=SIZE) as pilot:
        await pilot.pause()
        await pilot.press("f2")
        await pilot.pause()
        app.screen.query_one("#import").press()         # Import… button
        await pilot.pause()
        assert isinstance(app.screen, ImportDialog)
        app.screen.query_one("#path", Input).value = str(nuclei)
        app.screen.query_one("#import").press()
        await pilot.pause()
        assert any(f.fid.startswith("IMP-") for f in store.list_findings())
