"""Claude-Code-style questions: numbered choices, "Type something.", "Chat about this"."""

from reconix import store
from reconix.screens import ApprovalScreen, ChoiceScreen, ScopeScreen, StartScreen
from reconix.widgets import ChoiceMenu, PromptBox

from .support import SIZE, event_kinds, show


def prompt_text(menu: ChoiceMenu, index: int) -> str:
    return str(menu.get_option_at_index(index).prompt)


async def test_choices_are_numbered_with_descriptions_and_extras(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        menu = app.focused
        assert isinstance(menu, ChoiceMenu)
        first = prompt_text(menu, 0)
        assert first.startswith("❯ 1. Approve scope (Recommended)")
        assert "\n" in first                                     # description on its own line
        labels = [prompt_text(menu, i) for i in range(menu.option_count)]
        assert labels[-2].strip().startswith("4. Type something.")
        assert labels[-1].strip().startswith("5. Chat about this")


async def test_a_digit_picks_that_choice(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        await pilot.press("3")                                   # Reject
        await pilot.pause()
        assert isinstance(app.screen, StartScreen)
        assert event_kinds() == ["scope.rejected"]


async def test_type_something_saves_feedback_and_stays(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        await pilot.press("4", "s", "k", "i", "p", "space", "/", "a", "enter")
        await pilot.pause()
        assert isinstance(app.screen, ScopeScreen)
        [feedback] = store.list_feedback()
        assert (feedback.gate, feedback.text) == ("scope", "skip /a")
        assert event_kinds() == ["scope.feedback"]


async def test_typing_never_triggers_screen_shortcuts(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "approval")
        await pilot.press("5", "n", "d", "y", "1")               # n/d/y/1 are typed, not run
        await pilot.pause()
        assert isinstance(app.screen, ApprovalScreen)
        assert store.list_approval_decisions() == []
        assert "ndy1" in prompt_text(app.focused, 4)
        await pilot.press("escape")                              # clears the draft first
        await pilot.pause()
        assert isinstance(app.screen, ApprovalScreen)
        assert "Type something." in prompt_text(app.focused, 4)


async def test_chat_about_this_opens_the_prompt_with_context(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "approval")
        await pilot.press("6")                                   # Chat about this
        await pilot.pause()
        assert isinstance(app.screen, StartScreen)
        box = app.screen.query_one(PromptBox)
        assert box.input.value == "About web_vuln_scan on staging.example.com: "
        assert not box.menu_open
        assert "approval.chat" in event_kinds()


async def test_high_risk_confirmation_ignores_digits(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "approval")
        await pilot.press("enter")                               # opens the confirmation
        await pilot.pause()
        await pilot.press("2")                                   # would be "Yes" if numbered
        await pilot.pause()
        assert isinstance(app.screen, ChoiceScreen)
        assert store.list_approval_decisions() == []
        assert not prompt_text(app.screen.query_one(ChoiceMenu), 0).strip().startswith("1.")


async def test_sent_message_has_a_background_bar(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "scope")
        message = app.screen.query_one(".user-msg")
        body = app.screen.query_one("#body")
        assert message.styles.background != body.styles.background
