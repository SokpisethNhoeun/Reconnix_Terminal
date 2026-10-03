"""UI/UX polish: dead ends removed, findings filter/sort, flow progress line, thinking pause."""

import pytest
from textual.widgets import Button, DataTable

from reconix import store
from reconix.app import ReconixApp
from reconix.screens import (
    ChoiceScreen, ExecutionScreen, FindingDetailScreen, ScopeScreen, StartScreen,
)
from reconix.widgets import ChoiceMenu, FlowProgress, PromptBox

from .support import SIZE, event_kinds, show
from .support_approve import approve_pending


def progress_text(app) -> str:
    return str(app.screen.query_one(FlowProgress).render())


# --- no dead ends -----------------------------------------------------------------
async def test_arrow_keys_skip_the_disabled_option(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        menu = app.focused
        assert "(not in demo)" in str(menu.get_option_at_index(1).prompt)
        await pilot.press("down")
        assert menu.highlighted_id == "reject"


async def test_a_disabled_option_cannot_be_picked(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        await pilot.press("2")                  # Edit manifest (disabled)
        await pilot.pause()
        assert isinstance(app.screen, ScopeScreen)
        assert app.focused.highlighted_id == "approve"
        app.focused.highlighted = 1             # force it, then use the Enter fallback
        app.screen.action_choose()
        await pilot.pause()
        assert isinstance(app.screen, ScopeScreen)
        assert event_kinds() == []


async def test_removed_edit_keys_and_web_button(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "approval")
        await pilot.press("e")                  # no longer bound: nothing happens
        await pilot.pause()
        assert event_kinds() == []
        await show(app, pilot, "report")
        assert app.screen.query_one("#web", Button).disabled


# --- store: filters, sorts, progress ----------------------------------------------
def test_find_findings_filters_and_sorts():
    ids = lambda rows: [f.fid for _, f in rows]
    assert ids(store.find_findings("high_up")) == ["REC-001", "REC-002"]
    assert ids(store.find_findings("not_confirmed"))[0] == "REC-002"
    status = ids(store.find_findings("all", "status"))
    assert status[:3] == ["REC-001", "REC-002", "REC-005"]
    with pytest.raises(store.StoreValidationError):
        store.find_findings("nope")


def test_step_states_latest_event_wins():
    store.log_event("scope.approved")
    store.log_event("execution.stopped")
    assert store.step_states() == {"scope": "done", "execution": "stopped"}
    store.log_event("scope.rejected")
    assert "scope" not in store.step_states()


# --- flow progress line -----------------------------------------------------------
async def test_progress_line_shows_done_and_current_steps(app):
    store.log_event("scope.approved")
    async with app.run_test(size=(140, 40)) as pilot:
        await show(app, pilot, "plan")
        text = progress_text(app)
        assert "✓ Start" in text and "✓ Scope" in text and "● Plan" in text
        assert "○ Approval" in text


async def test_progress_line_is_compact_on_narrow_terminals():
    app = ReconixApp()
    async with app.run_test(size=(60, 24)) as pilot:
        await show(app, pilot, "plan")
        text = progress_text(app)
        assert "● Plan" in text and "Approval" not in text
        assert len(text) == 60


async def test_progress_line_marks_a_stopped_scan(app):
    async with app.run_test(size=(140, 40)) as pilot:
        approve_pending()
        await show(app, pilot, "execution")
        await pilot.press("ctrl+c")
        await pilot.pause()
        await pilot.press("down", "enter")      # Stop
        await pilot.pause()
        assert isinstance(app.screen, ExecutionScreen)
        assert "✕ Execution" in progress_text(app)


# --- findings filter and sort -----------------------------------------------------
async def test_filter_dialog_narrows_the_table(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "findings")
        await pilot.press("f")
        await pilot.pause()
        assert isinstance(app.screen, ChoiceScreen)
        await pilot.press("down", "enter")      # Critical & High
        await pilot.pause()
        table = app.screen.query_one(DataTable)
        assert table.row_count == 2
        assert "showing 2 of 6" in str(app.screen.query_one("#view-line").render())


async def test_sort_keeps_the_cursor_on_the_same_finding(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "findings")
        await pilot.press("down", "down")       # REC-003
        await pilot.press("s", "s")             # severity -> cvss -> status
        await pilot.pause()
        assert app.findings_sort == "status"
        table = app.screen.query_one(DataTable)
        key = table.coordinate_to_cell_key(table.cursor_coordinate).row_key.value
        assert key == "2"


async def test_enter_opens_the_row_under_the_cursor_not_its_position(app):
    async with app.run_test(size=SIZE) as pilot:
        app.findings_filter = "medium"
        await show(app, pilot, "findings")
        await pilot.press("enter")              # first row is REC-003 (store index 2)
        await pilot.pause()
        assert isinstance(app.screen, FindingDetailScreen)
        assert app.selected_finding == 2


async def test_empty_filter_shows_a_message(app):
    for index in range(len(store.list_findings())):
        store.validate_finding(index)
    async with app.run_test(size=SIZE) as pilot:
        app.findings_filter = "not_confirmed"
        await show(app, pilot, "findings")
        assert not app.screen.query_one(DataTable).display
        assert app.screen.query_one("#findings-empty").display
        await pilot.press("enter")              # nothing to open
        await pilot.pause()
        assert not isinstance(app.screen, FindingDetailScreen)


# --- detail: previous / next ------------------------------------------------------
async def test_brackets_walk_findings_and_stop_at_the_ends(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "detail")        # selected_finding = 0
        await pilot.press("left_square_bracket")
        await pilot.pause()
        assert app.selected_finding == 0        # already first: no wrap
        await pilot.press("right_square_bracket")
        await pilot.pause()
        assert app.selected_finding == 1
        assert "(2 of 6)" in str(app.screen.query_one("#breadcrumb").render())


async def test_detail_outside_the_filter_walks_everything(app):
    async with app.run_test(size=SIZE) as pilot:
        app.findings_filter = "medium"
        await show(app, pilot, "detail")        # REC-001 is not Medium
        assert "outside filter" in str(app.screen.query_one("#breadcrumb").render())
        await pilot.press("right_square_bracket")
        await pilot.pause()
        assert app.selected_finding == 1


# --- thinking spinner -----------------------------------------------------------
async def test_thinking_spinner_ignores_enter_and_esc_skips(app):
    app.THINKING_SECONDS = 30
    async with app.run_test(size=SIZE) as pilot:
        depth = len(app.screen_stack)
        box = app.screen.query_one(PromptBox)
        await pilot.press("enter")              # send the (empty) demo request
        await pilot.pause()
        assert isinstance(app.screen, StartScreen) and box.busy
        assert box.input.disabled
        await pilot.press("enter")              # must not re-send, skip, or approve anything
        await pilot.pause()
        assert isinstance(app.screen, StartScreen) and box.busy
        await pilot.press("escape")
        await pilot.pause()
        assert isinstance(app.screen, ScopeScreen)
        assert len(app.screen_stack) == depth
        assert event_kinds() == []              # Scope's default (Approve) was not chosen


async def test_thinking_spinner_finishes_by_itself(app):
    app.THINKING_SECONDS = 0.05
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("enter")
        await pilot.pause(0.4)
        assert isinstance(app.screen, ScopeScreen)


# --- markup in user text never crashes a notification ------------------------------
async def test_unknown_command_with_brackets_does_not_crash(app):
    async with app.run_test(size=SIZE, notifications=True) as pilot:
        box = app.screen.query_one(PromptBox)
        box.input.value = "/[/]"
        await pilot.press("enter")
        await pilot.pause(0.2)
        assert isinstance(app.screen, StartScreen)
