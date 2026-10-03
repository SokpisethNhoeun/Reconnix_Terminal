"""Items 2, 3, 5: execution guard, demo labelling, stop/validate confirms,
feedback echo, argument suggestions, history search, /audit, command palette off."""

from reconix import store
from reconix.screens import (
    ChoiceScreen, ExecutionScreen, FindingDetailScreen, FindingsListScreen, StartScreen,
)
from reconix.widgets import ChoiceMenu, PromptBox

from .support import SIZE, event_kinds, show
from .support_approve import approve_pending


# --- item 2: the execution gate and honest status ---------------------------------
async def test_jump_to_execution_is_blocked_until_approved(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "findings")      # no focused input eats the digit
        await pilot.press("5")                   # jump('execution')
        await pilot.pause()
        assert isinstance(app.screen, FindingsListScreen)
        approve_pending()
        await pilot.press("5")
        await pilot.pause()
        assert isinstance(app.screen, ExecutionScreen)


async def test_command_palette_is_disabled(app):
    assert app.ENABLE_COMMAND_PALETTE is False


async def test_session_bar_says_demo_not_backend(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.pause()
        bar = str(app.screen.query_one("SessionBar").render())
        assert "demo data" in bar
        assert "backend" not in bar


# --- item 3a: stop the scan -------------------------------------------------------
async def test_ctrl_c_confirms_then_stops_the_scan(app):
    async with app.run_test(size=SIZE) as pilot:
        approve_pending()
        await show(app, pilot, "execution")
        depth = len(app.screen_stack)
        await pilot.press("ctrl+c")
        await pilot.pause()
        assert isinstance(app.screen, ChoiceScreen)
        assert app.screen.query_one(ChoiceMenu).highlighted_id == "keep"   # safe default
        await pilot.press("down", "enter")       # Stop
        await pilot.pause()
        assert isinstance(app.screen, ExecutionScreen)
        assert len(app.screen_stack) == depth
        assert "execution.stopped" in event_kinds()


# --- item 3b: validate a finding --------------------------------------------------
async def test_validate_confirms_the_finding(app):
    async with app.run_test(size=SIZE) as pilot:
        app.selected_finding = 2                 # REC-003, UNCONFIRMED
        await show(app, pilot, "detail")
        await pilot.press("v")
        await pilot.pause()
        assert isinstance(app.screen, ChoiceScreen)
        await pilot.press("down", "enter")       # Run PoC
        await pilot.pause()
        assert isinstance(app.screen, FindingDetailScreen)
        assert store.get_finding(2).status == "CONFIRMED"
        assert "finding.validated" in event_kinds()


async def test_validate_is_a_noop_when_already_confirmed(app):
    async with app.run_test(size=SIZE) as pilot:
        app.selected_finding = 0                 # REC-001 is CONFIRMED in the seed
        await show(app, pilot, "detail")
        await pilot.press("v")
        await pilot.pause()
        assert isinstance(app.screen, FindingDetailScreen)   # no dialog


# --- item 3c: feedback echo -------------------------------------------------------
async def test_typed_feedback_is_echoed_on_screen(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        await pilot.press("4", "s", "k", "i", "p", "enter")   # Type something.
        await pilot.pause()
        echoes = app.screen.query(".feedback-echo")
        assert len(echoes) == 1
        assert "skip" in str(echoes.first().render())


# --- item 5a: argument suggestions ------------------------------------------------
async def test_slash_export_lists_formats_and_runs(app):
    async with app.run_test(size=SIZE) as pilot:
        box = app.screen.query_one(PromptBox)
        await pilot.press("slash", "e", "x", "p", "o", "r", "t", "space")
        await pilot.pause()
        assert box.menu_open
        ids = [box.menu.get_option_at_index(i).id for i in range(box.menu.option_count)]
        assert ids == ["pdf", "docx", "json"]
        await pilot.press("j")                   # filter to json
        await pilot.pause()
        assert box.menu.highlighted_id == "json"
        await pilot.press("enter")
        await pilot.pause()
        assert store.list_events()[-1].detail == "JSON"


async def test_tab_completes_an_argument(app):
    async with app.run_test(size=SIZE) as pilot:
        box = app.screen.query_one(PromptBox)
        await pilot.press("slash", "e", "x", "p", "o", "r", "t", "space", "d", "o", "c")
        await pilot.pause()
        await pilot.press("tab")
        await pilot.pause()
        assert box.input.value == "/export docx"
        assert not box.menu_open


# --- item 5b: Ctrl+R history search -----------------------------------------------
async def test_ctrl_r_searches_history_and_inserts(app):
    store.add_history("/plan")
    store.add_history("scan example.org")
    async with app.run_test(size=SIZE) as pilot:
        box = app.screen.query_one(PromptBox)
        await pilot.press("ctrl+r")
        await pilot.pause()
        assert box.menu_open
        assert box.menu.get_option_at_index(0).id == "0"     # newest first
        await pilot.press("p", "l", "a")                      # filter
        await pilot.pause()
        assert "/plan" in str(box.menu.get_option_at_index(0).prompt)
        await pilot.press("enter")                            # inserts, does not run
        await pilot.pause()
        assert isinstance(app.screen, StartScreen)
        assert box.input.value == "/plan"
        assert not box.menu_open


async def test_ctrl_r_escape_restores_the_draft(app):
    async with app.run_test(size=SIZE) as pilot:
        box = app.screen.query_one(PromptBox)
        box.input.value = "my draft"
        await pilot.press("ctrl+r")
        await pilot.pause()
        assert box.input.value == ""                          # cleared while searching
        await pilot.press("escape")
        await pilot.pause()
        assert box.input.value == "my draft"                  # restored


# --- item 5c: /audit --------------------------------------------------------------
async def test_audit_command_lists_events(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        await pilot.press("1")                   # 1. Approve scope -> logs scope.approved
        await pilot.pause()
        app.run_command_line("/audit")
        await pilot.pause()
        assert isinstance(app.screen, ChoiceScreen)
        assert "AUDIT TRAIL" in app.screen.query_one(".dialog").border_title
        assert any("scope.approved" in e.kind for e in store.list_events())
        await pilot.press("escape")
        await pilot.pause()
        assert not isinstance(app.screen, ChoiceScreen)
