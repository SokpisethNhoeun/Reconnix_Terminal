"""The dashboard: layout, starting a run, the F-keys, and redraws from the store."""

from reconix import store
from reconix.screens import DashboardScreen
from reconix.screens.dialogs import (
    ActivityDialog, FindingsDialog, ScopeManifestDialog,
)
from reconix.widgets import (
    AssistantLog, ChatEntryView, FKeyBar, PlanPanel, PromptBox, StatusPanel, TopBar,
)

from .support import SIZE, run_ui_to, start_run


async def test_the_dashboard_has_every_region(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.pause()
        screen = app.screen
        assert isinstance(screen, DashboardScreen)
        for widget in (TopBar, AssistantLog, StatusPanel, PlanPanel, PromptBox, FKeyBar):
            assert screen.query_one(widget)
        assert app.focused is screen.query_one(PromptBox).input
        assert not screen.has_class("-narrow")


async def test_narrow_terminals_stack_the_side_column(app):
    async with app.run_test(size=(100, 40)) as pilot:
        await pilot.pause()
        assert app.screen.has_class("-narrow")


async def test_enter_on_an_empty_prompt_starts_the_demo(app):
    async with app.run_test(size=SIZE) as pilot:
        await start_run(pilot)
        assert store.get_run().started
        assert store.list_requests()[-1].text == store.DEMO_REQUEST
        assert isinstance(app.screen, ScopeManifestDialog)    # the URL picked Web URL
        chat = [c.text for c in store.list_chat()]
        assert "Target identified: staging.example.com (web application)." in chat


async def test_a_typed_request_with_brackets_is_shown_as_text(app):
    async with app.run_test(size=SIZE) as pilot:
        box = app.screen.query_one(PromptBox)
        box.input.value = "Assess [TARGET] for issues"
        await pilot.press("enter")
        await pilot.pause()
        you = [c for c in store.list_chat() if c.speaker == "you"]
        assert you[-1].text == "Assess [TARGET] for issues"
        assert box.input.value == ""


async def test_a_rejected_request_keeps_the_text(app):
    async with app.run_test(size=SIZE) as pilot:
        box = app.screen.query_one(PromptBox)
        box.input.value = "x" * 600
        await pilot.press("enter")
        await pilot.pause()
        assert not store.get_run().started
        assert box.input.value == "x" * 600


async def test_f_keys_open_their_dialogs_and_close_cleanly(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.pause()
        depth = len(app.screen_stack)
        # Findings and Activity work from the start; Scope needs a drafted scope.
        for key, dialog in (("f2", FindingsDialog), ("f4", ActivityDialog)):
            await pilot.press(key)
            await pilot.pause()
            assert isinstance(app.screen, dialog)
            await pilot.press("escape")
            await pilot.pause()
            assert len(app.screen_stack) == depth
        await run_ui_to(app, pilot, "account")       # a scope now exists
        await pilot.press("escape", "f3")
        await pilot.pause()
        assert isinstance(app.screen, ScopeManifestDialog)
        await pilot.press("escape")
        await pilot.pause()
        assert len(app.screen_stack) == depth


async def test_f5_waits_for_a_completed_assessment(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.pause()
        depth = len(app.screen_stack)
        await pilot.press("f5")
        await pilot.pause()
        assert len(app.screen_stack) == depth


async def test_the_status_panel_follows_the_run(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "account")
        bar = app.screen_stack[1].query_one(TopBar)
        assert "waiting for login" in str(bar.render())
        assert "RCX-DEMO-001" in str(bar.render())


async def test_typing_during_a_run_gets_an_answer(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, None)
        box = app.screen.query_one(PromptBox)
        box.input.value = "can you also scan prod?"
        await pilot.press("enter")
        await pilot.pause()
        chat = store.list_chat()
        assert (chat[-2].speaker, chat[-2].text) == ("you", "can you also scan prod?")
        assert chat[-1].speaker == "reconix"


async def test_f7_toggles_the_right_pane(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.pause()
        screen = app.screen
        side = screen.query_one("#side")
        assert not screen.has_class("-side-collapsed")
        assert side.display
        assert screen.query_one(AssistantLog).display       # the assistant stays
        await pilot.press("f7")
        await pilot.pause()
        assert screen.has_class("-side-collapsed")
        assert not side.display                              # the status + plan pane is hidden
        assert screen.query_one(AssistantLog).display
        await pilot.press("f7")
        await pilot.pause()
        assert not screen.has_class("-side-collapsed")
        assert side.display


async def test_the_panel_button_also_toggles_the_right_pane(app):
    from reconix.widgets import PaneToggle
    async with app.run_test(size=SIZE) as pilot:
        await pilot.pause()
        screen = app.screen
        await pilot.click(PaneToggle)
        await pilot.pause()
        assert screen.has_class("-side-collapsed")
        await pilot.click(PaneToggle)
        await pilot.pause()
        assert not screen.has_class("-side-collapsed")


async def test_the_assistant_streams_both_chat_and_activity(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, None)
        await pilot.pause()
        log = app.screen.query_one(AssistantLog)
        assert len(log.query(ChatEntryView)) > 0      # chat bubbles
        assert len(log.query(".stream-line")) > 0     # activity streamed in alongside them
