"""The Start prompt: slash suggestions, completion, history, help."""

from reconix import store
from reconix.commands import COMMANDS
from reconix.screens import ChoiceScreen, FindingsListScreen, HelpScreen, ScopeScreen, StartScreen
from reconix.store.seed import USER_REQUEST
from reconix.widgets import PromptBox

from .support import SIZE


def box(app) -> PromptBox:
    return app.screen.query_one(PromptBox)


async def test_slash_opens_every_command(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("slash")
        await pilot.pause()
        assert box(app).menu_open
        assert box(app).menu.option_count == len(COMMANDS)


async def test_suggestions_open_above_the_input_without_moving_it(app):
    async with app.run_test(size=SIZE) as pilot:
        before = box(app).input.region
        await pilot.press("slash")
        await pilot.pause()
        assert box(app).input.region == before
        assert box(app).menu.region.bottom == before.y      # the list sits right on top of the input


async def test_typing_filters_and_arrows_move(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("slash", "f", "i")
        await pilot.pause()
        menu = box(app).menu
        assert menu.option_count == 2
        assert menu.highlighted_id == "findings"
        await pilot.press("down")
        assert menu.highlighted_id == "finding"
        await pilot.press("up")
        assert menu.highlighted_id == "findings"


async def test_enter_runs_the_highlighted_command(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("slash", "f", "i", "enter")
        await pilot.pause()
        assert isinstance(app.screen, FindingsListScreen)
        assert store.list_history()[-1] == "/findings"


async def test_esc_closes_the_menu_then_clears_the_text(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("slash", "p", "l")
        await pilot.pause()
        await pilot.press("escape")
        await pilot.pause()
        assert not box(app).menu_open
        assert box(app).input.value == "/pl"
        await pilot.press("escape")
        await pilot.pause()
        assert box(app).input.value == ""
        assert isinstance(app.screen, StartScreen)


async def test_tab_completes_and_enter_asks_for_the_argument(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("slash", "e", "x", "p", "tab")
        await pilot.pause()
        assert box(app).input.value == "/export "
        assert not box(app).menu_open
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, ChoiceScreen)
        await pilot.press("down", "down", "enter")          # PDF, DOCX, JSON
        await pilot.pause()
        assert isinstance(app.screen, StartScreen)
        assert [(e.kind, e.detail) for e in store.list_events()] == [
            ("report.export_requested", "JSON"),
        ]


async def test_up_recalls_history_without_opening_the_menu(app):
    store.add_history("/plan")
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("up")
        await pilot.pause()
        assert box(app).input.value == "/plan"
        assert not box(app).menu_open
        await pilot.press("up")
        assert box(app).input.value == USER_REQUEST
        await pilot.press("down", "down")
        assert box(app).input.value == ""


async def test_a_request_with_brackets_is_stored_and_shown(app):
    async with app.run_test(size=SIZE) as pilot:
        box(app).input.value = "scan [TARGET] now"
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, ScopeScreen)
        assert store.latest_request().text == "scan [TARGET] now"
        assert store.list_history()[-1] == "scan [TARGET] now"
        assert "scan [TARGET] now" in str(app.screen.query_one(".user-msg").render())


async def test_rejected_request_keeps_the_text(app):
    async with app.run_test(size=SIZE) as pilot:
        box(app).input.value = "x" * 501
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, StartScreen)
        assert box(app).input.value == "x" * 501


async def test_question_mark_opens_help_only_on_an_empty_prompt(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("question_mark")
        await pilot.pause()
        assert isinstance(app.screen, HelpScreen)
        await pilot.press("escape")
        await pilot.pause()
        await pilot.press("a", "question_mark")
        await pilot.pause()
        assert box(app).input.value == "a?"


async def test_unknown_command_keeps_the_text(app):
    async with app.run_test(size=SIZE) as pilot:
        box(app).input.value = "/nope"
        await pilot.pause()
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, StartScreen)
        assert box(app).input.value == "/nope"
