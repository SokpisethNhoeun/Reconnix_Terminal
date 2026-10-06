"""Each gate's dialog: safe defaults, decide-later, and what the store records."""

from textual.widgets import Button, Input

from reconix import store
from reconix.screens import DashboardScreen
from reconix.screens.dialogs import (
    ApprovalDialog, ScopeEditDialog, ScopeManifestDialog, SecureInputDialog, SummaryDialog,
    TemplateDialog,
)

from .support import (
    ASK_REQUEST, SIZE, TEST_PASSWORD, event_kinds, pass_gate, run_ui_to, type_request,
)


# --- template ------------------------------------------------------------------------------
async def test_the_template_menu_starts_on_the_suggestion(app):
    async with app.run_test(size=SIZE) as pilot:
        await type_request(app, pilot, ASK_REQUEST)     # a bare hostname: Reconix asks
        menu = app.screen.query_one("#template-menu")
        assert menu.highlighted_id == "web_url"        # the suggestion is highlighted
        await pilot.press("up")                        # all four are selectable now
        await pilot.pause()
        assert menu.highlighted_id != "web_url"


async def test_esc_decides_later_and_enter_reopens(app):
    async with app.run_test(size=SIZE) as pilot:
        await type_request(app, pilot, ASK_REQUEST)
        await pilot.press("escape")
        await pilot.pause()
        assert isinstance(app.screen, DashboardScreen)
        assert store.waiting_gate() == "template"
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, TemplateDialog)


# --- scope -----------------------------------------------------------------------------------
async def test_the_scope_dialog_focuses_edit_and_nothing_runs_before_approval(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "scope")
        assert isinstance(app.screen, ScopeManifestDialog)
        assert app.focused.id == "edit"
        await pilot.press("escape")
        await pilot.pause()
        assert not store.is_scope_approved()
        assert store.counters()["requests"] == 0


async def test_edit_scope_changes_the_manifest_and_reopens_it(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "scope")
        await pilot.press("enter")                     # Edit Scope
        await pilot.pause()
        assert isinstance(app.screen, ScopeEditDialog)
        app.screen.query_one("#excluded", Input).value = "/admin, /billing"
        app.screen.query_one("#time-limit", Input).value = "15"
        app.screen.query_one("#save").press()
        await pilot.pause()
        assert isinstance(app.screen, ScopeManifestDialog)
        assert store.get_scope().excluded_paths == ["/admin", "/billing"]
        assert store.get_scope().time_limit_minutes == 15
        assert "scope.edited" in event_kinds()
        # The new exclusion is enforced once approved.
        await pilot.press("right", "enter")            # Approve
        await pilot.pause()
        assert not store.check_request("GET", "/billing").allowed


async def test_edit_scope_rejects_bad_input(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "scope")
        await pilot.press("enter")
        await pilot.pause()
        app.screen.query_one("#time-limit", Input).value = "9999"
        app.screen.query_one("#save").press()
        await pilot.pause()
        assert isinstance(app.screen, ScopeEditDialog)      # stays open on error


async def test_f3_at_the_scope_gate_opens_it_for_approval(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "scope")
        await pilot.press("escape")
        await pilot.pause()
        await pilot.press("f3")
        await pilot.pause()
        assert app.screen.query("#approve")


# --- test account ------------------------------------------------------------------------------
async def test_the_vault_validates_and_never_echoes_the_password(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "account")
        screen = app.screen
        assert isinstance(screen, SecureInputDialog)
        assert screen.query_one("#secret", Input).password        # password masked
        screen.query_one("#save").press()                          # save with empty fields
        await pilot.pause()
        assert isinstance(app.screen, SecureInputDialog)           # refused, stays open
        assert not store.is_authenticated()
        await pass_gate(app, pilot)
        assert store.is_authenticated()
        shown = [c.text for c in store.list_chat()] + [a.message for a in store.list_activity()]
        assert not any(TEST_PASSWORD in text for text in shown)


# --- approvals ------------------------------------------------------------------------------------
async def test_medium_starts_on_reject_and_approve_continues(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "approval:approval-001")
        assert isinstance(app.screen, ApprovalDialog)
        assert app.focused.id == "reject"
        await pass_gate(app, pilot)
        assert store.is_approved("approval-001")
        assert store.waiting_gate() == "approval:approval-002"


async def test_rejecting_stops_the_run(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "approval:approval-001")
        await pilot.press("enter")                      # Reject has focus
        await pilot.pause()
        assert isinstance(app.screen, DashboardScreen)
        assert store.display_phase() == "stopped"
        assert "approval.rejected" in event_kinds()


async def test_high_needs_a_reason_before_approve_works(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "approval:approval-002")
        screen = app.screen
        approve = screen.query_one("#approve", Button)
        assert approve.disabled and app.focused.id == "reason"
        screen.query_one("#reason", Input).value = "Validate it"
        await pilot.pause()
        assert not approve.disabled


async def test_closing_the_high_dialog_voids_its_token(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "approval:approval-002")
        await pilot.press("escape")
        await pilot.pause()
        assert event_kinds()[-2:] == ["approval.confirmation_requested",
                                      "approval.confirmation_declined"]
        assert not store.is_approved("approval-002")
        await pilot.press("enter")                      # reopen: a fresh token
        await pilot.pause()
        await pass_gate(app, pilot)
        assert store.is_approved("approval-002")


async def test_the_whole_run_with_the_keyboard(app):
    async with app.run_test(size=SIZE) as pilot:
        depth = 2                                       # default screen + dashboard
        await run_ui_to(app, pilot, None)
        assert store.is_completed()
        assert len(app.screen_stack) == depth
        await pilot.press("f5", "enter")                # HTML is selected → generate
        await pilot.pause()
        assert isinstance(app.screen, SummaryDialog)
        assert store.get_run().report_path.endswith("RCX-DEMO-001.html")
        await pilot.press("escape")
        await pilot.pause()
        assert len(app.screen_stack) == depth
