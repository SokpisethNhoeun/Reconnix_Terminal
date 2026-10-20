"""Agent mode: a credential request pops the secure-input modal and returns values.

`agent_run.run` is mocked to call `on_ask` like the harness would; no backend/LLM/VM.
"""

import pytest
from textual.widgets import Input

from reconix import store
from reconix.screens.forms import CredentialForm
from reconix.store import agent_run

from .support import SIZE, settle


@pytest.fixture
def model_active(monkeypatch):
    monkeypatch.setattr("reconix.llm.client.ping", lambda *a, **k: (True, "reachable"))
    store.set_provider("openai", api_key="sk-x-1234", models=["gpt-4o-mini"])
    store.test_provider("openai")
    store.activate("openai", "gpt-4o-mini")


@pytest.fixture
def asking_agent(monkeypatch):
    """Fake agent run that asks for credentials and records what it got back."""
    got = {}

    async def fake_run(text, on_event, on_ask=None):
        got["vals"] = await on_ask({
            "reason": "Login needed to test authenticated endpoints.",
            "fields": ["login_url", "username", "password"],
            "login_url": "http://t/login",
        })

    monkeypatch.setattr(agent_run, "run", fake_run)
    return got


async def test_credential_modal_returns_values(app, model_active, asking_agent):
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/assess http://target.example")
        await settle(pilot, rounds=8)
        app.approve_scope()                            # hand off to the agent
        await settle(pilot, rounds=10)
        assert isinstance(app.screen, CredentialForm)
        assert app.screen.query_one("#login_url", Input).value == "http://t/login"  # prefilled
        app.screen.query_one("#username", Input).value = "alice"
        app.screen.query_one("#password", Input).value = "s3cret"
        app.screen.query_one("#submit").press()
        await settle(pilot, rounds=10)
        assert asking_agent["vals"] == {
            "login_url": "http://t/login", "username": "alice", "password": "s3cret"}


@pytest.fixture
def confirming_agent(monkeypatch):
    """Fake agent run that asks the operator a yes/no confirmation."""
    got = {}

    async def fake_run(text, on_event, on_ask=None):
        got["answer"] = await on_ask(
            {"type": "confirm", "question": "Proceed with an intrusive sqlmap scan?", "options": []})

    monkeypatch.setattr(agent_run, "run", fake_run)
    return got


async def test_confirmation_pops_a_dialog_not_chat(app, model_active, confirming_agent):
    from reconix.screens import ChoiceScreen

    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/assess http://target.example")
        await settle(pilot, rounds=8)
        app.approve_scope()
        await settle(pilot, rounds=10)
        assert isinstance(app.screen, ChoiceScreen)        # popped a dialog, not a chat line
        await pilot.press("1")                              # pick "Yes"
        await settle(pilot, rounds=10)
        assert confirming_agent["answer"] == {"answer": "yes"}


async def test_credential_modal_cancel_returns_none(app, model_active, asking_agent):
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/assess http://target.example")
        await settle(pilot, rounds=8)
        app.approve_scope()
        await settle(pilot, rounds=10)
        assert isinstance(app.screen, CredentialForm)
        await pilot.press("escape")
        await settle(pilot, rounds=10)
        assert asking_agent["vals"] is None
