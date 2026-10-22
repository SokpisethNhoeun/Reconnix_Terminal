"""/add-on in the UI (Pilot): the menu, the form, the error, a direct add, and the removes."""

from textual.widgets import Input

from reconix import store
from reconix.screens import ChoiceScreen
from reconix.screens.forms import AddOnForm

from .support import SIZE, settle, wait_until


def _write(tmp_path, name="runbook.md"):
    p = tmp_path / name
    p.write_text("SQL injection reference material for the staging engagement.")
    return p


async def test_add_on_opens_the_menu_when_empty(app):
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/add-on")
        await settle(pilot)
        assert isinstance(app.screen, ChoiceScreen)
        ids = [c.id for c in app.screen._choices]
        assert ids == ["add"]                          # only "Add a file…" when nothing saved


async def test_menu_lists_sources_and_remove_all(app, tmp_path):
    source = store.add_source(str(_write(tmp_path)))
    async with app.run_test(size=SIZE) as pilot:
        app.open_add_on_menu()
        await settle(pilot)
        ids = [c.id for c in app.screen._choices]
        assert ids[0] == "add" and source.id in ids and "__clear_all__" in ids


async def test_add_via_the_form(app, tmp_path):
    p = _write(tmp_path)
    async with app.run_test(size=SIZE) as pilot:
        app.open_add_on_menu()
        await settle(pilot)
        app.screen.dismiss("add")                      # pick "Add a file…"
        await settle(pilot)
        assert isinstance(app.screen, AddOnForm)
        app.screen.query_one("#path", Input).value = str(p)
        app.screen.query_one("#submit").press()
        await settle(pilot)
        assert [s.name for s in store.list_sources()] == ["runbook.md"]


async def test_form_error_keeps_it_open(app, tmp_path):
    async with app.run_test(size=SIZE) as pilot:
        app.open_dialog(AddOnForm())
        await settle(pilot)
        app.screen.query_one("#path", Input).value = str(tmp_path / "missing.txt")
        app.screen.query_one("#submit").press()
        await settle(pilot)
        assert isinstance(app.screen, AddOnForm)       # the store refused; the form stays
        assert store.list_sources() == []


async def test_add_on_with_a_path_adds_directly(app, tmp_path):
    p = _write(tmp_path)
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line(f"/add-on {p}")
        await wait_until(pilot, lambda: len(store.list_sources()) == 1, what="the add-on added")
        assert store.list_sources()[0].name == "runbook.md"


async def test_remove_confirm_defaults_to_no(app, tmp_path):
    source = store.add_source(str(_write(tmp_path)))
    async with app.run_test(size=SIZE) as pilot:
        app.open_add_on_menu()
        await settle(pilot)
        app.screen.dismiss(source.id)                  # pick the source → remove confirm
        await settle(pilot)
        assert isinstance(app.screen, ChoiceScreen) and app.screen._danger
        assert app.screen._default == 0                # "No, keep it" is the default
        await pilot.press("enter")                     # the safe default
        await settle(pilot)
        assert [s.id for s in store.list_sources()] == [source.id]   # still there


async def test_remove_confirm_removes(app, tmp_path):
    source = store.add_source(str(_write(tmp_path)))
    async with app.run_test(size=SIZE) as pilot:
        app.open_add_on_menu()
        await settle(pilot)
        app.screen.dismiss(source.id)
        await settle(pilot)
        app.screen.dismiss("remove")
        await settle(pilot)
        assert store.list_sources() == []


async def test_remove_all(app, tmp_path):
    for name in ("a.txt", "b.txt"):
        store.add_source(str(_write(tmp_path, name)))
    async with app.run_test(size=SIZE) as pilot:
        app.open_add_on_menu()
        await settle(pilot)
        app.screen.dismiss("__clear_all__")            # pick "Remove all" → confirm
        await settle(pilot)
        assert isinstance(app.screen, ChoiceScreen) and app.screen._danger
        app.screen.dismiss("clear")
        await settle(pilot)
        assert store.list_sources() == []
