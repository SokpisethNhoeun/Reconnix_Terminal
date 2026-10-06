"""/web starts the web dashboard when it isn't running (no `cd web && npm run dev`)."""

import socket

from reconix import web_server
from reconix.shell import web as web_shell
from reconix.store import persist
from reconix.web_server import problem as real_problem     # before conftest stubs it

from .support import SIZE, settle

LINK = "http://127.0.0.1:3100/login#token=abc\n"


def _notes(app) -> str:
    return " ".join(str(n.message) for n in app._notifications)


async def test_the_first_web_starts_it_and_a_second_waits(app, opened, web_launches):
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/web")
        app.run_command_line("/web")                       # again, while it starts
        await settle(pilot)
        assert len(web_launches) == 1 and opened == []
        assert "Starting the web dashboard" in _notes(app)
        assert "still starting" in _notes(app)


async def test_it_says_when_it_is_ready(app, web_launches, monkeypatch):
    monkeypatch.setattr(web_shell, "POLL_EVERY", 0.01)
    monkeypatch.setattr(web_server, "is_listening", lambda url: bool(url))
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/web")
        persist.WEB_URL_FILE.write_text(LINK)              # what serve.mjs writes when ready
        await app.workers.wait_for_complete()
        await settle(pilot)
        assert "ready and opened in your browser" in _notes(app)
        assert not app._web_starting


async def test_the_first_time_it_installs_the_packages_first(app, web_launches, monkeypatch):
    monkeypatch.setattr(web_server, "needs_install", lambda: True)
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/web")
        await settle(pilot)
        assert web_launches[0] == "install" and len(web_launches) == 2
        assert "installing its packages" in _notes(app)


async def test_without_node_it_says_how_to_start_it(app, web_launches, monkeypatch):
    monkeypatch.setattr(web_server, "problem", lambda: "The web dashboard needs Node.js.")
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/web")
        await settle(pilot)
        assert web_launches == []
        assert "Node.js" in _notes(app) and "cd web && npm run dev" in _notes(app)


async def test_a_dashboard_it_started_stops_when_the_tui_quits(app, web_launches):
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/web")
        await settle(pilot)
        [dashboard] = web_launches
        assert not dashboard.stopped
    assert dashboard.stopped


async def test_a_stale_link_is_not_opened(app, opened, web_launches):
    persist.WEB_URL_FILE.write_text(LINK)                  # nothing listens on its port
    async with app.run_test(size=SIZE) as pilot:
        app.run_command_line("/web")
        await settle(pilot)
        assert opened == [] and len(web_launches) == 1


def test_is_listening_needs_something_on_the_port():
    with socket.socket() as server:
        server.bind(("127.0.0.1", 0))
        server.listen()
        port = server.getsockname()[1]
        assert web_server.is_listening(f"http://127.0.0.1:{port}/login#token=x")
    assert not web_server.is_listening(f"http://127.0.0.1:{port}/login")
    assert not web_server.is_listening(None)


def test_it_cant_start_without_the_web_folder(monkeypatch, tmp_path):
    monkeypatch.setattr(web_server, "WEB_DIR", tmp_path)
    assert "web/" in real_problem()
