"""The agent's scope guard: every tool call is checked against the approved scope.

The harness `Agent` is real (its LLM is a scripted stub, no network or Kali VM); the guard,
the decisions and the audit trail are Reconix's. A refusal never reaches a tool.
"""

import json
from datetime import timedelta

import pytest

from reconix import store
from reconix.store import agent_guard, agent_run, lists
from reconix.store.snapshot import uid_for

from .support import run_to

harness = pytest.importorskip("harness")


def _guard(kind="web", tools=("whatweb", "nuclei", "nikto")):
    """A guard over the current assessment's snapshot, with a fake target table."""
    targets = {"web": ("https://staging.example.com", "web"),
               "other": ("https://evil.example.net", "web"),
               "net": ("10.0.0.7", "network")}

    def lookup(ref):
        return targets.get(ref)

    def tools_for(args, _kind):
        return list(args.get("tools") or tools)

    return agent_guard.make_guard(uid_for(store.get_assessment()), lookup, tools_for)


@pytest.fixture
def web_guard():
    run_to("plan")                            # the demo web scope, approved
    agent_run.begin_execution()
    return _guard()


@pytest.fixture
def net_guard():
    run_to("plan", request="10.0.0.7")        # a network scope with an allowed-port list
    agent_run.begin_execution()
    return _guard()


def test_in_scope_get_is_allowed(web_guard):
    assert web_guard("http_poc", {"method": "GET",
                                  "url": "https://staging.example.com/products?id=1"}) == ""
    assert web_guard("run_scan", {"target": "web", "tools": ["nuclei"]}) == ""
    assert web_guard("update_plan", {}) == ""


@pytest.mark.parametrize("name,args,reason", [
    ("http_poc", {"method": "GET", "url": "https://staging.example.com/Admin/users"},
     "Path outside approved scope"),
    ("http_poc", {"method": "DELETE", "url": "https://staging.example.com/products"},
     "Method DELETE not allowed"),
    ("http_poc", {"method": "GET", "url": "https://evil.example.net/x"},
     "Host outside approved scope"),
    ("login", {"url": "https://evil.example.net/login"}, "Host outside approved scope"),
    ("run_scan", {"target": "other", "tools": ["nuclei"]}, "Host outside approved scope"),
    ("run_scan", {"target": "web", "tools": ["metasploit"]},
     "Tool metasploit is not in the approved scope"),
    ("authorize_target", {"target": "other"}, "Host outside approved scope"),
    ("add_target", {"value": "https://evil.example.net", "authorized": True},
     "Host outside approved scope"),
    ("http_poc", {"method": "GET", "url": "/relative"}, "Malformed request target"),
    ("shell", {"cmd": "id"}, "Tool shell is not allowed in agent mode"),
])
def test_guard_refuses(web_guard, name, args, reason):
    assert web_guard(name, args) == reason


def test_everything_is_refused_after_the_time_limit(web_guard):
    snap = agent_guard.snapshot(uid_for(store.get_assessment()))
    snap.started_at -= timedelta(minutes=31)
    for name, args in [("http_poc", {"method": "GET", "url": "https://staging.example.com/"}),
                       ("update_plan", {}), ("run_scan", {"target": "web"})]:
        assert web_guard(name, args) == "Time limit reached"


def test_nothing_runs_before_the_scope_is_approved_or_after_revoke(web_guard):
    agent_run.revoke(uid_for(store.get_assessment()))
    assert web_guard("update_plan", {}) == "Scope not approved"


def test_the_decision_uses_a_copy_of_the_scope(web_guard):
    lists.current().scope.excluded_paths.clear()          # a later live edit changes nothing
    assert web_guard("http_poc", {"method": "GET",
                                  "url": "https://staging.example.com/admin"}) != ""


def test_network_scope_checks_ports_and_hosts(net_guard):
    assert net_guard("run_scan", {"target": "net", "tools": ["nmap"]}) == ""
    assert net_guard("http_poc", {"url": "http://10.0.0.7:8080/"}) == ""
    assert net_guard("http_poc", {"url": "http://10.0.0.7:3306/"}) == \
        "Port 3306 not in the approved list"
    assert net_guard("http_poc", {"url": "http://10.0.0.9:80/"}) == \
        "Host outside approved scope"
    assert net_guard("run_scan", {"target": "web", "tools": ["nmap"]}) == \
        "Host outside approved scope"


# --- through the real Agent loop -----------------------------------------------------------
def _tool_call(cid, name, args):
    return {"id": cid, "type": "function",
            "function": {"name": name, "arguments": json.dumps(args)}}


async def test_refusal_reaches_the_model_and_the_audit_trail(web_guard, tmp_path):
    from harness.agent import Agent
    from harness.config import KaliMCPSettings, LLMSettings, Settings

    agent = Agent(Settings(llm=LLMSettings(), kali=KaliMCPSettings(),
                           db_path=tmp_path / "t.db", yaml={}), guard=web_guard)
    queue = [
        {"role": "assistant", "content": "", "tool_calls": [
            _tool_call("c1", "http_poc", {"method": "GET",
                                          "url": "https://staging.example.com/admin"})]},
        {"role": "assistant", "content": "blocked, moving on"},
    ]

    async def fake_raw_chat(history, tools=None, temperature=0.2):
        return queue.pop(0)

    agent.llm.raw_chat = fake_raw_chat
    events = []

    async def on_event(ev):
        events.append(ev)

    before = store.blocked_count()
    await agent.chat("go", on_event)
    assert any(m.get("role") == "tool" and
               "blocked by Reconix scope: Path outside approved scope" in m["content"]
               for m in agent.history)
    policy = [e for e in events if e["type"] == "policy"]
    assert len(policy) == 1

    for ev in events:                       # the app thread records the events
        agent_run.record_event(ev)
    assert store.blocked_count() == before + 1
    verdict = store.list_verdicts()[-1]
    assert (verdict.method, verdict.allowed) == ("GET", False)
    assert any(a.source == "POLICY" for a in store.list_activity())


def test_run_registers_the_approved_target_as_authorized(web_guard, tmp_path):
    from harness.agent import Agent
    from harness.config import KaliMCPSettings, LLMSettings, Settings

    agent = Agent(Settings(llm=LLMSettings(), kali=KaliMCPSettings(),
                           db_path=tmp_path / "t.db", yaml={}))
    uid = uid_for(store.get_assessment())
    agent_run._authorize_approved_target(agent, uid)
    agent_run._authorize_approved_target(agent, uid)        # idempotent
    targets = agent.db.list_targets()
    assert [(t.value, t.authorized) for t in targets] == [("https://staging.example.com", True)]
