"""Multiple assessments in one session: create, list, reopen, and isolation."""

from reconix import store
from reconix.screens import DashboardScreen
from reconix.screens.dialogs import AssessmentsDialog

from .support import SIZE, run_to


def test_a_new_assessment_keeps_the_earlier_ones():
    run_to(None)                                   # a completed web assessment
    first = store.get_assessment().label
    store.new_assessment()
    assert store.get_assessment().label != first
    cards = store.list_assessments()
    assert len(cards) == 2
    assert cards[0].status == "Completed" and cards[0].target == "staging.example.com"
    assert cards[1].status == "New" and cards[1].current


def test_assessments_are_isolated_and_reopenable():
    run_to("account")                              # web, mid-run
    web_findings = len(store.list_findings())
    store.new_assessment()
    store.start_run("scan 10.0.0.0/24 for open ports")
    assert store.get_assessment().template_id == "network"
    assert store.list_findings() == []             # the new one has its own (empty) state
    store.switch_assessment(0)                     # reopen the web assessment
    assert store.get_assessment().template_id == "web_url"
    assert len(store.list_findings()) == web_findings
    assert store.get_scope().kind == "web_url"


def test_switch_rejects_a_bad_index():
    import pytest
    with pytest.raises(store.StoreValidationError):
        store.switch_assessment(5)


async def test_f6_lists_and_reopens(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.pause()
        run_to(None)                               # complete the first (web) assessment
        app.new_assessment()                       # a second, fresh one is now current
        await pilot.pause()
        await pilot.press("f6")
        await pilot.pause()
        assert isinstance(app.screen, AssessmentsDialog)
        from textual.widgets import DataTable
        table = app.screen.query_one(DataTable)
        assert table.row_count == 2
        table.move_cursor(row=0)
        app.screen.query_one("#open").press()      # reopen the completed web assessment
        await pilot.pause()
        assert isinstance(app.screen, DashboardScreen)
        assert store.is_completed()
        assert store.get_assessment().target == "staging.example.com"


async def test_f6_new_assessment_starts_fresh(app):
    async with app.run_test(size=SIZE) as pilot:
        await pilot.pause()
        run_to("scope")
        await pilot.press("escape", "f6")
        await pilot.pause()
        app.screen.query_one("#new").press()
        await pilot.pause()
        assert isinstance(app.screen, DashboardScreen)
        assert not store.get_run().started
        assert len(store.list_assessments()) == 2


async def test_reopening_a_running_assessment_resumes_it(app):
    from reconix.screens.dialogs import ApprovalDialog

    from .support import decide, play_until_gate
    # Drive the current assessment to a between-gates running state (no waiting gate).
    store.start_run(store.DEMO_REQUEST)            # the URL picks Web URL itself
    decide(play_until_gate())                      # scope
    decide(play_until_gate())                      # account
    store.advance()                                # play past the account gate
    assert store.waiting_gate() == "" and not store.is_finished()

    async with app.run_test(size=SIZE) as pilot:   # the dashboard mounts on this assessment
        await pilot.pause()
        # on_mount resumed the controller, which played on to the next (MEDIUM) gate.
        assert isinstance(app.screen, ApprovalDialog)
        assert store.waiting_gate() == "approval:approval-001"
