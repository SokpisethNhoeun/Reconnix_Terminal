"""Contextual help lists the keys for the screen you are on."""

from textual.widgets import Static

from reconix.screens import HelpScreen

from .support import SIZE, show


def help_text(app) -> str:
    return " ".join(str(w.render()) for w in app.screen.query(Static))


async def test_help_lists_the_approval_keys(app):
    async with app.run_test(size=SIZE) as pilot:
        await show(app, pilot, "approval")
        await pilot.press("question_mark")
        await pilot.pause()
        assert isinstance(app.screen, HelpScreen)
        assert "APPROVAL" in app.screen.query_one("#help-box").border_title
        text = help_text(app)
        for phrase in ("move between choices", "pick a numbered choice", "details", "reject",
                       "back to plan", "jump to a screen"):
            assert phrase in text


async def test_help_on_start_lists_the_prompt_keys(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("question_mark")
        await pilot.pause()
        text = help_text(app)
        assert "complete the highlighted command" in text
        assert "prompt history" in text
