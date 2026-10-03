"""Flow navigation: arrows, number jumps, help overlay, findings table."""

from reconix.screens import (
    FindingDetailScreen, FindingsListScreen, HelpScreen, PlanScreen, ReportScreen,
    ScopeScreen, StartScreen,
)

from .support import SIZE, show


async def test_app_opens_on_start(app):
    async with app.run_test(size=SIZE):
        assert isinstance(app.screen, StartScreen)


async def test_enter_on_empty_prompt_goes_to_scope(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, ScopeScreen)


async def test_arrows_walk_the_flow(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        await pilot.press("right")
        await pilot.pause()
        assert isinstance(app.screen, PlanScreen)
        await pilot.press("left")
        await pilot.pause()
        assert isinstance(app.screen, ScopeScreen)


async def test_number_keys_jump_and_right_stops_at_the_end(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "findings")      # no menu has focus here
        await pilot.press("8")
        await pilot.pause()
        assert isinstance(app.screen, ReportScreen)
        await pilot.press("right")
        await pilot.pause()
        assert isinstance(app.screen, ReportScreen)
        await pilot.press("6")
        await pilot.pause()
        assert isinstance(app.screen, FindingsListScreen)


async def test_help_toggles_and_blocks_jumps(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        depth = len(app.screen_stack)
        await pilot.press("question_mark")
        await pilot.pause()
        assert isinstance(app.screen, HelpScreen)
        await pilot.press("3")              # jump keys are inactive under a modal
        await pilot.pause()
        assert isinstance(app.screen, HelpScreen)
        await pilot.press("question_mark")
        await pilot.pause()
        assert isinstance(app.screen, ScopeScreen)
        assert len(app.screen_stack) == depth


async def test_enter_opens_the_selected_finding(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "findings")
        await pilot.press("down", "enter")
        await pilot.pause()
        assert isinstance(app.screen, FindingDetailScreen)
        assert app.selected_finding == 1


async def test_screen_stack_does_not_grow_while_navigating(app):
    async with app.run_test(size=SIZE) as pilot:
        depth = len(app.screen_stack)
        for name in ("scope", "plan", "findings", "detail", "report", "start"):
            await show(app, pilot, name)
        assert len(app.screen_stack) == depth
