"""The `/` command bar on screens that have no prompt."""

from reconix import store
from reconix.screens import (
    ChoiceScreen, CommandBarScreen, ExecutionScreen, FindingDetailScreen, PlanScreen,
    ScopeScreen,
)
from reconix.widgets import PromptBox

from .support import SIZE, show


async def open_bar(app, pilot) -> PromptBox:
    await pilot.press("slash")
    await pilot.pause()
    assert isinstance(app.screen, CommandBarScreen)
    return app.screen.query_one(PromptBox)


async def test_slash_opens_the_bar_and_runs_a_command(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        depth = len(app.screen_stack)
        bar = await open_bar(app, pilot)
        assert bar.input.value == "/"
        assert bar.menu_open
        await pilot.press("p", "l", "a", "enter")
        await pilot.pause()
        assert isinstance(app.screen, PlanScreen)
        assert len(app.screen_stack) == depth


async def test_esc_closes_the_bar(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "findings")
        depth = len(app.screen_stack)
        await open_bar(app, pilot)
        await pilot.press("escape")
        await pilot.pause()
        assert len(app.screen_stack) == depth
        assert not isinstance(app.screen, CommandBarScreen)


async def test_export_asks_for_a_format(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        depth = len(app.screen_stack)
        await open_bar(app, pilot)
        await pilot.press("e", "x", "p", "o", "r", "t", "enter")
        await pilot.pause()
        assert isinstance(app.screen, ChoiceScreen)
        await pilot.press("down", "down", "enter")
        await pilot.pause()
        assert isinstance(app.screen, ScopeScreen)
        assert len(app.screen_stack) == depth
        assert store.list_events()[-1].detail == "JSON"


async def test_finding_by_menu_and_by_argument(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        await open_bar(app, pilot)
        await pilot.press("f", "i", "n", "d", "i", "n", "g", "down", "enter")   # /finding
        await pilot.pause()
        assert isinstance(app.screen, ChoiceScreen)
        await pilot.press("down", "enter")
        await pilot.pause()
        assert isinstance(app.screen, FindingDetailScreen)
        assert app.selected_finding == 1
        bar = await open_bar(app, pilot)
        bar.input.value = "/finding REC-003"
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, FindingDetailScreen)
        assert app.selected_finding == 2


async def test_plain_text_is_refused(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        bar = await open_bar(app, pilot)
        bar.input.value = "scan everything"
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, CommandBarScreen)
        assert len(store.list_requests()) == 1


async def test_status_waits_for_approval(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        bar = await open_bar(app, pilot)
        bar.input.value = "/status"
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, ScopeScreen)
        request = store.get_pending_approval()
        token = store.request_confirmation(request.request_id, request.command_hash)
        store.approve(request.request_id, command_hash=request.command_hash,
                      confirmation_token=token)
        bar = await open_bar(app, pilot)
        bar.input.value = "/status"
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, ExecutionScreen)


async def test_bar_input_stays_put_as_the_list_opens_and_closes(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        bar = await open_bar(app, pilot)
        open_region = bar.input.region
        assert bar.menu.region.bottom == open_region.y
        await pilot.press("z", "z")                      # no match: the list closes
        await pilot.pause()
        assert not bar.menu_open
        assert bar.input.region == open_region

