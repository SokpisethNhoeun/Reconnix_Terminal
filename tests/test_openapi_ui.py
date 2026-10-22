"""Attach an OpenAPI spec from the Template screen's scope review (Pilot)."""

import json

from textual.widgets import Input, Static

from reconix import store
from reconix.screens import TemplateScreen
from reconix.screens.forms import OpenApiForm
from reconix.widgets import ChoiceMenu, ScopeManifestView

from .support import SIZE, settle, start_demo, type_request

API_REQUEST = "test the API at https://api.example.com/v1"
SPEC = {
    "openapi": "3.0.3", "info": {"title": "Orders API", "version": "1.2.0"},
    "servers": [{"url": "https://api.example.com/v1"}, {"url": "https://evil.example.net"}],
    "paths": {"/orders": {"get": {}, "post": {}}, "/orders/{id}": {"get": {}}},
}


async def to_api_review(app, pilot) -> None:
    await type_request(pilot, API_REQUEST)
    await settle(pilot, 8)
    assert isinstance(app.screen, TemplateScreen) and app.screen.state() == "review"


def choice_labels(app):
    return [c.label for c in app.screen.query_one("#scope-menu", ChoiceMenu)._choices]


async def test_attach_a_spec_from_the_scope_review(app, tmp_path):
    path = tmp_path / "openapi.json"
    path.write_text(json.dumps(SPEC), encoding="utf-8")
    async with app.run_test(size=SIZE) as pilot:
        await to_api_review(app, pilot)
        assert "Attach OpenAPI spec" in choice_labels(app)
        await pilot.press("2")
        await settle(pilot)
        assert isinstance(app.screen, OpenApiForm)
        field = app.screen.query_one("#path", Input)
        assert field.placeholder == "~/specs/openapi.yaml"
        field.value = str(path)
        app.screen.query_one("#submit").press()
        await settle(pilot, 8)
        assert isinstance(app.screen, TemplateScreen)
        assert store.get_api_spec().total == 3
        shown = str(app.screen.query_one(ScopeManifestView).render())
        assert "API spec  Orders API 1.2.0 · 3 endpoints · GET, POST" in shown
        assert "Out of scope  https://evil.example.net" in shown
        assert "Replace OpenAPI spec" in choice_labels(app)
        assert store.get_scope().target_url == "https://api.example.com"


async def test_a_bad_file_shows_the_store_error_and_keeps_the_form(app, tmp_path):
    path = tmp_path / "notes.json"
    path.write_text(json.dumps({"hello": "world"}), encoding="utf-8")
    async with app.run_test(size=SIZE) as pilot:
        await to_api_review(app, pilot)
        await pilot.press("2")
        await settle(pilot)
        app.screen.query_one("#path", Input).value = str(path)
        app.screen.query_one("#submit").press()
        await settle(pilot)
        assert isinstance(app.screen, OpenApiForm)
        assert "OpenAPI" in str(app.screen.query_one("#form-error", Static).render())
        assert store.get_api_spec() is None


async def test_other_templates_do_not_offer_the_choice(app):
    async with app.run_test(size=SIZE) as pilot:
        await start_demo(pilot)                         # the demo URL is a Web URL
        assert isinstance(app.screen, TemplateScreen)
        assert not any("OpenAPI" in label for label in choice_labels(app))
