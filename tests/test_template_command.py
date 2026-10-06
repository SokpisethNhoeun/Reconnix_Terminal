"""The prompt answers small talk, clear targets go to the scope gate, and /template asks
for a target that fits the chosen template."""

from textual.widgets import Input

from reconix import store
from reconix.screens import ChoiceScreen, DashboardScreen
from reconix.screens.dialogs import ScopeManifestDialog, TargetDialog
from reconix.widgets import PromptBox

from .support import SIZE, run_ui_to, type_request


# --- the prompt ------------------------------------------------------------------------------
async def test_small_talk_gets_an_answer_and_the_prompt_clears(app):
    async with app.run_test(size=SIZE) as pilot:
        await type_request(app, pilot, "hi")
        assert not store.get_run().started
        assert isinstance(app.screen, DashboardScreen)
        assert store.list_chat()[-1].text.startswith("Hi! Type a target")
        assert app.screen.query_one(PromptBox).input.value == ""


async def test_a_malformed_ipv4_keeps_the_text_to_fix(app):
    async with app.run_test(size=SIZE) as pilot:
        await type_request(app, pilot, "10.0.0.300")
        assert not store.get_run().started
        assert app.screen.query_one(PromptBox).input.value == "10.0.0.300"


async def test_an_ipv4_goes_straight_to_the_scope_gate(app):
    async with app.run_test(size=SIZE) as pilot:
        await type_request(app, pilot, "192.0.2.10")
        assert isinstance(app.screen, ScopeManifestDialog)   # no template picker
        assert store.selected_template().id == "network"


async def test_a_local_path_at_the_prompt_is_a_target_not_a_command(app):
    async with app.run_test(size=SIZE) as pilot:
        await type_request(app, pilot, "/home/me/project")
        assert store.selected_template().id == "source"
        assert store.get_assessment().target == "/home/me/project"


# --- /template ---------------------------------------------------------------------------------
async def test_template_without_an_argument_asks_which_then_for_the_target(app):
    async with app.run_test(size=SIZE) as pilot:
        assert app.run_command_line("/template")
        await pilot.pause()
        assert isinstance(app.screen, ChoiceScreen)
        await pilot.press("enter")                           # Network (the first)
        await pilot.pause()
        assert isinstance(app.screen, TargetDialog)
        assert app.screen.template_id == "network"
        assert app.focused is app.screen.query_one("#target", Input)


async def test_the_target_dialog_shows_the_store_error_and_stays_open(app):
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/template source")
        await pilot.pause()
        dialog = app.screen
        dialog.query_one("#target", Input).value = "https://shop.example.com"
        await pilot.press("enter")
        await pilot.pause()
        assert app.screen is dialog
        assert "Source Code needs" in str(dialog.query_one("#target-error").render())
        assert not store.get_run().started


async def test_a_valid_target_starts_the_run_at_the_scope_gate(app):
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/template network")
        await pilot.pause()
        app.screen.query_one("#target", Input).value = "10.0.0.0/24"
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, ScopeManifestDialog)
        assert store.selected_template().id == "network"
        assert store.get_assessment().target == "10.0.0.0/24"


async def test_esc_on_the_target_dialog_starts_nothing(app):
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/template api")
        await pilot.pause()
        await pilot.press("escape")
        await pilot.pause()
        assert isinstance(app.screen, DashboardScreen)
        assert not store.get_run().started


async def test_template_after_a_run_starts_a_fresh_assessment(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, None)
        app.run_command_line("/template web_url")
        await pilot.pause()
        app.screen.query_one("#target", Input).value = "https://shop.example.com"
        await pilot.press("enter")
        await pilot.pause()
        await pilot.pause()
        assert len(store.list_assessments()) == 2
        assert store.get_assessment().target == "shop.example.com"
        assert isinstance(app.screen, ScopeManifestDialog)


async def test_new_with_a_target_starts_it_on_a_fresh_dashboard(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, None)
        assert app.run_command_line("/new 192.0.2.10")       # used to crash
        await pilot.pause()
        await pilot.pause()
        assert store.get_assessment().target == "192.0.2.10"
        assert isinstance(app.screen, ScopeManifestDialog)
