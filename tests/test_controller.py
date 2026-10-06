"""RunController timing (with a fake host) and gates that arrive while a dialog is open."""

from typing import Callable, List

from reconix import store
from reconix.flow import RunController
from reconix.screens.dialogs import FindingsDialog, ScopeManifestDialog, TemplateDialog

from .support import ASK_REQUEST, SIZE, type_request


class FakeHost:
    """Records what the controller asks for; timers fire only when the test says so."""

    def __init__(self) -> None:
        self.gates: List[str] = []
        self.timers: List[Callable[[], None]] = []
        self.finished = 0
        self.failures: List[str] = []

    def refresh_view(self) -> None:
        pass

    def open_gate(self, gate: str) -> None:
        self.gates.append(gate)

    def run_finished(self) -> None:
        self.finished += 1

    def run_failed(self, message: str) -> None:
        self.failures.append(message)

    def set_timer(self, delay, callback):
        self.timers.append(callback)
        return _Timer()

    def fire(self) -> None:
        callback = self.timers.pop(0)
        callback()


class _Timer:
    def stop(self) -> None:
        pass


def test_steps_wait_for_their_timers_and_stop_at_the_gate(monkeypatch):
    monkeypatch.setattr(RunController, "SPEED", 1.0)
    host = FakeHost()
    controller = RunController(host)
    store.start_run(store.DEMO_REQUEST)
    controller.resume()
    assert controller.busy and not host.gates
    while host.timers:
        host.fire()
    assert host.gates == ["scope"]                    # the URL picked the template itself
    assert not controller.busy


def test_a_store_error_stops_playback_without_crashing(monkeypatch):
    def broken():
        raise store.StoreValidationError("backend said no")
    monkeypatch.setattr(store, "advance", broken)
    host = FakeHost()
    store.start_run(store.DEMO_REQUEST)
    RunController(host).resume()
    assert host.failures == ["backend said no"]


async def test_a_gate_that_arrives_under_another_dialog_opens_after_it(app, monkeypatch):
    monkeypatch.setattr(RunController, "SPEED", 0.4)    # ~1.2 s to the template gate
    async with app.run_test(size=SIZE) as pilot:
        await type_request(app, pilot, ASK_REQUEST)    # start (asks for a template) …
        await pilot.press("f2")                        # … then look at findings
        assert store.waiting_gate() == ""              # the gate hasn't arrived yet
        await pilot.pause(2.5)
        assert isinstance(app.screen, FindingsDialog)
        assert store.waiting_gate() == "template"
        await pilot.press("escape")
        await pilot.pause(0.1)
        assert isinstance(app.screen, TemplateDialog)
        await pilot.press("enter")                     # Web URL
        await pilot.pause(2.5)
        # The decided gate never comes back; the next one opens.
        assert isinstance(app.screen, ScopeManifestDialog)
        assert len(app.screen_stack) == 3


async def test_new_closes_dialogs_and_starts_over(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.press("enter")
        await pilot.pause()
        assert isinstance(app.screen, ScopeManifestDialog)
        app.new_assessment()
        await pilot.pause()
        assert len(app.screen_stack) == 2
        assert not store.get_run().started
