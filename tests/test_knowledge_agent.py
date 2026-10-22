"""The AI agent's knowledge tool: offered only with knowledge, dispatched, and guard-allowed."""

import pytest

from reconix import store
from reconix.store import agent_guard, agent_run
from reconix.store.snapshot import uid_for

from .support import run_to

pytest.importorskip("harness")

from harness.agent import Agent  # noqa: E402
from harness.config import load_settings  # noqa: E402


def _tool_names(agent):
    return [t["function"]["name"] for t in agent.tools]


def test_tool_only_present_with_knowledge():
    settings = load_settings()
    without = Agent(settings)
    assert "search_knowledge" not in _tool_names(without)

    with_knowledge = Agent(settings, knowledge=lambda q: [{"source": "a.md", "index": 0,
                                                           "text": "ref"}])
    assert "search_knowledge" in _tool_names(with_knowledge)
    # The system prompt names the reference material only when the tool is present.
    assert "search_knowledge" in with_knowledge.history[0]["content"]
    assert "search_knowledge" not in without.history[0]["content"]


async def test_dispatch_returns_passages():
    agent = Agent(load_settings(),
                  knowledge=lambda q: [{"source": "a.md", "index": 1, "text": "ref"}])
    result = await agent._dispatch("search_knowledge", {"query": "anything"})
    assert result == {"passages": [{"source": "a.md", "index": 1, "text": "ref"}]}


async def test_dispatch_is_empty_without_knowledge():
    agent = Agent(load_settings())
    assert await agent._dispatch("search_knowledge", {"query": "x"}) == {"passages": []}


def test_guard_allows_search_knowledge():
    run_to("plan")                                     # an approved scope
    agent_run.begin_execution()
    guard = agent_guard.make_guard(uid_for(store.get_assessment()),
                                   lambda ref: None, lambda a, kind: [])
    assert guard("search_knowledge", {"query": "anything"}) == ""


def test_agent_run_wires_store_knowledge(tmp_path, model_active):
    corpus = {
        "runbook.md": "SQL injection was found in the search endpoint and marked high severity.",
        "policy.txt": "Scope approval requires a signed authorization from the system owner.",
        "notes.md": "The login form accepts an email and a password over HTTPS only.",
    }
    for name, text in corpus.items():
        p = tmp_path / name
        p.write_text(text)
        store.add_source(str(p))

    agent = agent_run._agent()
    assert "search_knowledge" in _tool_names(agent)

    rows = agent_run._knowledge_search("sql injection severity endpoint search")
    assert rows and all(set(r) == {"source", "index", "text"} for r in rows)
    assert rows[0]["source"] == "runbook.md"
