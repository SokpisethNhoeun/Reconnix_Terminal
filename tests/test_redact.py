"""Secrets in free text are masked before anything is saved or imported."""

import json

import pytest

from reconix import store
from reconix.store import persist
from reconix.store.parser import parse_request
from reconix.store.redact import clean, redact

from .support import play_until_gate, run_to


@pytest.mark.parametrize("text, secret", [
    ("Assess https://admin:Hunter2pw@staging.example.com now", "Hunter2pw"),
    ("Cookie: session=abc123def456", "abc123def456"),
    ("Authorization: Bearer eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.c2lnbmF0dXJlX2hlcmU", "eyJzdWIiOiIxMjM0"),
    ("password=correct-horse-battery", "correct-horse-battery"),
    ('api_key: "sk_live_1234567890abcdef"', "sk_live_1234567890abcdef"),
    ("found AKIAIOSFODNN7EXAMPLE in config", "IOSFODNN7EXAMPLE"),
    ("-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----", "MIIEow"),
])
def test_known_secret_shapes_are_masked(text, secret):
    assert secret not in redact(text)
    assert "••••" in redact(text)


@pytest.mark.parametrize("text", [
    "Scope check: passed",
    "Session started · policy engine ready",
    "Login (with a one-time code) required for /api/orders/*",
    "Assess https://staging.example.com for web security issues.",
])
def test_ordinary_text_is_left_alone(text):
    assert redact(text) == text


def test_lone_surrogates_are_dropped():
    assert clean("bad \udc80 char") == "bad ? char"


def test_a_typed_url_never_keeps_its_credentials():
    parsed = parse_request("Assess https://admin:Hunter2pw@staging.example.com:8443/app")
    assert parsed.target_url == "https://staging.example.com:8443"
    assert "Hunter2pw" not in parsed.target_url


def test_credentials_typed_in_a_request_never_reach_the_saved_file():
    store.start_run("Assess https://admin:Hunter2pw@staging.example.com for web issues.")
    play_until_gate()
    store.autosave()
    [path] = persist.DATA_DIR.glob("*.json")
    assert "Hunter2pw" not in path.read_text()


def test_the_prompt_refuses_text_while_a_login_is_asked_for():
    run_to("account")
    before = len(store.list_requests())
    with pytest.raises(store.StoreValidationError):
        store.say_to_assistant("session=abc123def456")
    assert len(store.list_requests()) == before
    assert all("abc123def456" not in c.text for c in store.list_chat())


def test_a_crafted_import_cannot_crash_saving(tmp_path):
    run_to("scope")
    row = {"template-id": "t", "matched-at": "https://staging.example.com/x",
           "info": {"name": "bad \\udc80 name", "severity": "low"},
           "extracted-results": ["token=\\udc80abcdef123456"]}
    path = tmp_path / "n.jsonl"
    path.write_text(json.dumps(row).replace("\\\\udc80", "\\udc80"))
    store.import_findings(str(path))
    assert store.autosave() is True
    saved = next(persist.DATA_DIR.glob("*.json")).read_text()
    assert "abcdef123456" not in saved
