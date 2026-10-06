"""Shared fixtures: every test starts from fresh demo data, and the UI never waits."""

from typing import List

import pytest

from reconix import browser, store
from reconix.app import ReconixApp
from reconix.flow import RunController
from reconix.store import persist, report


@pytest.fixture(autouse=True)
def fresh_store():
    """The store lists are process-wide, so reset them around every test."""
    store.reset()
    yield
    store.reset()


@pytest.fixture(autouse=True)
def instant_ui(monkeypatch, tmp_path):
    """Steps play at once; reports, saved assessments and the web link live in temp."""
    monkeypatch.setattr(RunController, "SPEED", 0)
    monkeypatch.setattr(report, "REPORTS_DIR", tmp_path / "reports")
    monkeypatch.setattr(persist, "DATA_DIR", tmp_path / "assessments")
    monkeypatch.setattr(persist, "WEB_URL_FILE", tmp_path / "web.url")
    monkeypatch.setattr(persist, "_written", {})


@pytest.fixture(autouse=True)
def opened(monkeypatch) -> List[str]:
    """Nothing a test does may launch a real browser: record what would have opened."""
    calls: List[str] = []
    monkeypatch.setattr(browser, "open_url", lambda url: calls.append(url) or True)
    monkeypatch.setattr(browser, "open_path", lambda path: calls.append(path) or True)
    return calls


@pytest.fixture
def app() -> ReconixApp:
    return ReconixApp()
