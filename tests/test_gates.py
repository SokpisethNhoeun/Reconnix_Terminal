"""Scope and Plan ask their question with a ↑/↓ menu."""

from textual.widgets import OptionList

from reconix.screens import ApprovalScreen, PlanScreen, ScopeScreen, StartScreen
from reconix.widgets import ChoiceMenu

from .support import SIZE, event_kinds, show


async def test_scope_menu_is_focused_and_enter_approves(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        assert isinstance(app.focused, ChoiceMenu)
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, PlanScreen)
        assert event_kinds() == ["scope.approved"]


async def test_scope_reject_from_the_menu_and_with_esc(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        await pilot.press("down", "enter")        # ↓ skips the disabled "Edit manifest"
        await pilot.pause()
        assert isinstance(app.screen, StartScreen)
        await show(app, pilot, "scope")
        await pilot.press("escape")
        await pilot.pause()
        assert isinstance(app.screen, StartScreen)
        assert event_kinds() == ["scope.rejected", "scope.rejected"]


async def test_enter_still_works_when_focus_leaves_the_menu(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        app.screen.query_one("#body").focus()
        await pilot.pause()
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, PlanScreen)


async def test_plan_enter_runs_the_plan(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "plan")
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, ApprovalScreen)
        assert event_kinds() == ["plan.run"]


async def test_plan_tab_browses_steps_and_esc_returns_to_the_menu(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "plan")
        await pilot.press("tab")
        await pilot.pause()
        steps = app.screen.query_one("#plan-list", OptionList)
        assert steps.has_focus
        await pilot.press("down")
        assert steps.highlighted == 1
        await pilot.press("escape")
        await pilot.pause()
        assert isinstance(app.screen, PlanScreen)
        assert isinstance(app.focused, ChoiceMenu)
        await pilot.press("tab", "enter")                   # Enter on a step runs the plan
        await pilot.pause()
        assert isinstance(app.screen, ApprovalScreen)


async def test_plan_cancel_goes_back_to_scope(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "plan")
        await pilot.press("down", "enter")        # ↓ skips the disabled "Edit steps"
        await pilot.pause()
        assert isinstance(app.screen, ScopeScreen)
        assert event_kinds() == ["plan.cancelled"]
