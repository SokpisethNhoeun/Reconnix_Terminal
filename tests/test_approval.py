"""Approval: ↑/↓ choices, and a second confirmation (default No) for HIGH risk."""

from reconix import store
from reconix.screens import ApprovalScreen, ChoiceScreen, ExecutionScreen, PlanScreen
from reconix.widgets import ChoiceMenu

from .support import SIZE, event_kinds, show


def decisions():
    return [d.decision for d in store.list_approval_decisions()]


async def test_menu_is_focused_on_approve(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "approval")
        assert isinstance(app.focused, ChoiceMenu)
        assert app.focused.highlighted_id == "approve"


async def test_confirmation_defaults_to_no(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "approval")
        depth = len(app.screen_stack)
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, ChoiceScreen)
        assert app.screen.query_one(ChoiceMenu).highlighted_id == "no"
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, ApprovalScreen)
        assert len(app.screen_stack) == depth
        assert decisions() == []
        assert event_kinds() == ["approval.confirmation_requested", "approval.confirmation_declined"]


async def test_repeated_keys_never_approve(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "approval")
        await pilot.press("y", "y", "enter")      # y opens the dialog; y does nothing there; Enter = No
        await pilot.pause()
        await pilot.press("enter", "enter")       # opens the dialog, then No again
        await pilot.pause()
        assert isinstance(app.screen, ApprovalScreen)
        assert decisions() == []


async def test_yes_approves_and_starts_execution(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "approval")
        depth = len(app.screen_stack)
        await pilot.press("enter", "down", "enter")
        await pilot.pause()
        assert isinstance(app.screen, ExecutionScreen)
        assert len(app.screen_stack) == depth
        assert decisions() == ["APPROVED"]


async def test_n_rejects_and_esc_goes_back(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "approval")
        await pilot.press("n")
        await pilot.pause()
        assert isinstance(app.screen, PlanScreen)
        assert decisions() == ["REJECTED"]
        await show(app, pilot, "approval")
        await pilot.press("escape")
        await pilot.pause()
        assert isinstance(app.screen, PlanScreen)
        assert event_kinds()[-1] == "approval.cancelled"


async def test_details_open_and_close(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "approval")
        await pilot.press("d")
        await pilot.pause()
        assert isinstance(app.screen, ChoiceScreen)
        assert "DETAILS" in app.screen.query_one(".dialog").border_title
        await pilot.press("escape")
        await pilot.pause()
        assert isinstance(app.screen, ApprovalScreen)
        assert "approval.details_viewed" in event_kinds()


async def test_right_arrow_waits_for_approval(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "approval")
        await pilot.press("right")
        await pilot.pause()
        assert isinstance(app.screen, ApprovalScreen)
        await pilot.press("enter", "down", "enter")
        await pilot.pause()
        await show(app, pilot, "approval")
        await pilot.press("right")
        await pilot.pause()
        assert isinstance(app.screen, ExecutionScreen)


async def test_details_scroll_with_page_keys_while_the_menu_keeps_focus(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "approval")
        await pilot.press("d")
        await pilot.pause()
        body = app.screen.query_one(".dialog-body")
        await pilot.press("pagedown")
        await pilot.pause()
        assert body.scroll_y > 0
        assert isinstance(app.focused, ChoiceMenu)

