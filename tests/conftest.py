"""Shared fixtures: every test starts from fresh demo data and a new app."""

import pytest

from reconix import store
from reconix.app import ReconixApp


@pytest.fixture(autouse=True)
def fresh_store():
    """The store lists are process-wide, so reset them around every test."""
    store.reset()
    yield
    store.reset()


@pytest.fixture(autouse=True)
def no_thinking_pause(monkeypatch):
    """Skip the post-request spinner so tests land on the next screen immediately."""
    monkeypatch.setattr(ReconixApp, "THINKING_SECONDS", 0)


@pytest.fixture
def app() -> ReconixApp:
    return ReconixApp()
