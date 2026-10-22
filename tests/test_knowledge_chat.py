"""The terminal chat uses /add-on knowledge: the block in the context and the Knowledge: line."""

import pytest

from reconix import store
from reconix.llm import client

from .support import run_to

_CORPUS = {
    "runbook.md": "SQL injection was found in the search endpoint and marked high severity.",
    "policy.txt": "Scope approval requires a signed authorization from the system owner.",
    "notes.md": "The login form accepts an email and a password over HTTPS only.",
}


@pytest.fixture
def chat_model(monkeypatch):
    """A configured, reachable, active model that records every completion's messages."""
    monkeypatch.setattr(client, "ping", lambda *a, **k: (True, "reachable"))
    calls = []

    def complete(pid, model, messages, **kw):
        calls.append(messages)
        return "a short reply"

    monkeypatch.setattr(client, "complete", complete)
    store.set_provider("openai", api_key="sk-x-1234", models=["gpt-4o-mini"])
    store.test_provider("openai")
    store.activate("openai", "gpt-4o-mini")
    return calls


def _add_corpus(tmp_path):
    for name, text in _CORPUS.items():
        p = tmp_path / name
        p.write_text(text)
        store.add_source(str(p))


def _reconix_notes():
    return [c.text for c in store.list_chat() if c.speaker == "reconix"]


def test_relevant_line_adds_the_block_and_the_knowledge_note(chat_model, tmp_path):
    _add_corpus(tmp_path)
    run_to("scope")
    store.say_to_assistant("what sql injection severity was in the search endpoint?")

    context = chat_model[-1][1]["content"]              # messages[1] is the scrubbed context
    assert "Internal knowledge (from /add-on files" in context
    assert "[runbook.md #0]" in context
    assert any(n.startswith("Knowledge: ") and "runbook.md" in n for n in _reconix_notes())


def test_irrelevant_line_has_no_block_and_no_note(chat_model, tmp_path):
    _add_corpus(tmp_path)
    run_to("scope")
    store.say_to_assistant("hello, how are you today?")

    context = chat_model[-1][1]["content"]
    assert "Internal knowledge" not in context
    assert not any(n.startswith("Knowledge:") for n in _reconix_notes())


def test_no_knowledge_without_a_model(tmp_path):
    # No active model: the built-in reply path runs and never touches the knowledge folder.
    _add_corpus(tmp_path)
    run_to("scope")
    store.say_to_assistant("what sql injection severity was in the search endpoint?")
    assert not any(n.startswith("Knowledge:") for n in _reconix_notes())
