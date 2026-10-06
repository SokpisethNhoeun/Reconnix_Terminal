"""The prompt: slash suggestions, history, help, and the command bar."""

from reconix.screens import ChoiceScreen, CommandBarScreen, DashboardScreen, HelpScreen
from reconix.screens.dialogs import ActivityDialog, FindingsDialog
from reconix.widgets import PromptBox

from .support import SIZE, run_ui_to


async def test_slash_lists_every_command_above_the_input(app):
    async with app.run_test(size=SIZE) as pilot:
        box = app.screen.query_one(PromptBox)
        before = box.input.region
        await pilot.press("slash")
        await pilot.pause()
        assert box.menu_open
        assert box.input.region == before            # suggestions float; the input stays put


async def test_typing_filters_and_enter_runs_the_highlight(app):
    async with app.run_test(size=SIZE) as pilot:
        box = app.screen.query_one(PromptBox)
        await pilot.press("slash", "a", "c")
        await pilot.pause()
        assert box.menu.highlighted_id == "activity"
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, ActivityDialog)


async def test_tab_completes_the_highlighted_command(app):
    async with app.run_test(size=SIZE) as pilot:
        box = app.screen.query_one(PromptBox)
        await pilot.press("slash", "s", "u", "tab")
        await pilot.pause()
        assert box.input.value == "/summary"
        assert not box.menu_open


async def test_a_command_with_choices_asks_when_no_argument_is_given(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, None)
        assert app.run_command_line("/finding")
        await pilot.pause()
        assert isinstance(app.screen, ChoiceScreen)
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, FindingsDialog)


async def test_unknown_command_keeps_the_text(app):
    async with app.run_test(size=SIZE) as pilot:
        box = app.screen.query_one(PromptBox)
        box.input.value = "/nope"
        await pilot.press("enter")
        await pilot.pause()
        assert box.input.value == "/nope"
        assert isinstance(app.screen, DashboardScreen)


async def test_up_recalls_the_demo_request(app):
    async with app.run_test(size=SIZE) as pilot:
        box = app.screen.query_one(PromptBox)
        await pilot.press("up")
        await pilot.pause()
        assert "staging.example.com" in box.input.value
        assert not box.menu_open


async def test_question_mark_opens_help_only_on_an_empty_prompt(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("question_mark")
        await pilot.pause()
        assert isinstance(app.screen, HelpScreen)
        await pilot.press("escape")
        box = app.screen.query_one(PromptBox)
        box.input.value = "why"
        await pilot.press("question_mark")
        await pilot.pause()
        assert box.input.value == "why?"


async def test_the_command_bar_opens_from_a_panel(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("tab")                     # focus leaves the prompt
        await pilot.pause()
        await pilot.press("slash")
        await pilot.pause()
        assert isinstance(app.screen, CommandBarScreen)
        await pilot.press("f", "i", "n", "d", "i", "n", "g", "s", "enter")
        await pilot.pause()
        assert isinstance(app.screen, FindingsDialog)
