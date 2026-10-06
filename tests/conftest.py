"""Shared fixtures: every test starts from fresh demo data, and the UI never waits."""

import pytest

from reconix import store
from reconix.app import ReconixApp
from reconix.flow import RunController
from reconix.screens.dialogs import ReportDialog
from reconix.store import persist, report


@pytest.fixture(autouse=True)
def fresh_store():
    """The store lists are process-wide, so reset them around every test."""
    store.reset()
    yield
    store.reset()


@pytest.fixture(autouse=True)
def instant_ui(monkeypatch, tmp_path):
    """Steps play at once, reports build at once; reports and saved assessments go to temp."""
    monkeypatch.setattr(RunController, "SPEED", 0)
    monkeypatch.setattr(ReportDialog, "STEP_SECONDS", 0)
    monkeypatch.setattr(report, "REPORTS_DIR", tmp_path / "reports")
    monkeypatch.setattr(persist, "DATA_DIR", tmp_path / "assessments")
    monkeypatch.setattr(persist, "_written", {})


@pytest.fixture
def app() -> ReconixApp:
    return ReconixApp()
