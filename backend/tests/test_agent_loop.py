"""Offline tests for the planner-executor + ReflAct agent loop.

No MCP/LLM/network: raw_chat is stubbed with a scripted message sequence and
_run_scan is monkeypatched to return canned findings, so the loop's planning,
adaptivity (findings fed back), termination, and dedup guard are deterministic.

# ponytail: one scripted happy-path + one dedup check, not a suite.
"""

from __future__ import annotations

import json

from harness.agent import Agent, _find_token
from harness.config import KaliMCPSettings, LLMSettings, Settings


def _settings(tmp_path) -> Settings:
    # LLM disabled (empty) so no OpenAI client is built; DB points at a tmp file.
    return Settings(
        llm=LLMSettings(),
        kali=KaliMCPSettings(),
        db_path=tmp_path / "t.db",
        yaml={"profiles": {"recon": ["whatweb"]}},
    )


def _tool_call(cid: str, name: str, args: dict) -> dict:
    return {"id": cid, "type": "function",
            "function": {"name": name, "arguments": json.dumps(args)}}


def _script(agent: Agent, messages: list[dict]) -> None:
    """Make raw_chat replay `messages` in order, one per round."""
    queue = list(messages)

    async def fake_raw_chat(history, tools=None, temperature=0.2):
        return queue.pop(0)

    agent.llm.raw_chat = fake_raw_chat  # type: ignore[assignment]


async def _collect(agent: Agent, text: str) -> list[dict]:
    events: list[dict] = []

    async def on_event(ev: dict) -> None:
        events.append(ev)

    await agent.chat(text, on_event)
    return events


async def test_ask_operator_prompts_and_returns_answer(tmp_path):
    agent = Agent(_settings(tmp_path))
    captured = {}

    async def on_ask(req):
        captured["req"] = req
        return {"answer": "yes"}

    _script(agent, [
        {"role": "assistant", "content": "need a decision",
         "tool_calls": [_tool_call("c1", "ask_operator", {"question": "Run sqlmap?"})]},
        {"role": "assistant", "content": "proceeding"},   # no tool calls -> ends
    ])
    events = []

    async def on_event(ev):
        events.append(ev)

    await agent.chat("go", on_event, on_ask)
    assert captured["req"] == {"type": "confirm", "question": "Run sqlmap?", "options": []}
    assert any(m.get("role") == "tool" and "yes" in str(m.get("content")) for m in agent.history)


async def test_reasoning_is_emitted_and_stripped_from_history(tmp_path):
    agent = Agent(_settings(tmp_path))
    _script(agent, [
        {"role": "assistant", "content": "here is the answer",
         "reasoning_content": "step 1 recon, step 2 decide"},   # no tool_calls -> ends
    ])
    events = await _collect(agent, "hello")
    kinds = [e["type"] for e in events]
    assert kinds == ["reasoning", "assistant"]                   # reasoning shown before text
    assert any(e["type"] == "reasoning" and "step 1" in e["text"] for e in events)
    # Reasoning must not be kept in history (it is not resent to the API).
    assert all("reasoning_content" not in m for m in agent.history)


async def test_plan_adapt_and_terminate(tmp_path):
    agent = Agent(_settings(tmp_path))

    # Canned scan result WITH findings, so adaptivity data reaches the model.
    canned = {"target": {"id": 1}, "tools": [{"tool": "whatweb", "status": "completed", "findings": 1}],
              "total_findings": 1,
              "findings": [{"id": 7, "severity": "high", "title": "PHP app", "location": "/"}]}

    async def fake_run_scan(args):
        return canned

    agent._run_scan = fake_run_scan  # type: ignore[assignment]

    _script(agent, [
        {"role": "assistant", "content": "planning recon first",
         "tool_calls": [_tool_call("c1", "update_plan",
                                    {"steps": [{"text": "recon", "status": "running"}]})]},
        {"role": "assistant", "content": "php found, scanning",
         "tool_calls": [_tool_call("c2", "run_scan", {"target": "t", "tools": ["whatweb"]})]},
        {"role": "assistant", "content": "done — 1 high finding (whatweb)"},  # no tool_calls -> terminate
    ])

    events = await _collect(agent, "pentest the lab")

    plan_events = [e for e in events if e.get("type") == "plan"]
    assert len(plan_events) == 1
    assert plan_events[0]["steps"][0]["text"] == "recon"
    assert agent.plan[0]["status"] == "running"

    # Adaptivity: the scan's findings landed in history as the tool result.
    tool_msgs = [m for m in agent.history if m.get("role") == "tool" and m.get("name") == "run_scan"]
    assert tool_msgs and "PHP app" in tool_msgs[0]["content"]

    # Terminated on the final no-tool-call message.
    assert any(e.get("type") == "assistant" and "1 high finding" in e.get("text", "") for e in events)


async def test_round_cap_forces_final_summary(tmp_path):
    agent = Agent(_settings(tmp_path))
    agent._update_plan = lambda args: _async({"ok": True})  # avoid touching DB/emit internals

    calls = {"n": 0}

    async def fake_raw_chat(history, tools=None, temperature=0.2):
        if tools is None:  # the forced wrap-up turn: no tools offered -> must answer
            return {"role": "assistant", "content": "FINAL SUMMARY"}
        calls["n"] += 1
        # Always a NEW tool call (changing args) so it never dedups or stops on its own.
        return {"role": "assistant", "content": None,
                "tool_calls": [_tool_call(f"c{calls['n']}", "update_plan",
                                          {"steps": [{"text": f"step {calls['n']}"}]})]}

    agent.llm.raw_chat = fake_raw_chat  # type: ignore[assignment]
    events = await _collect(agent, "go forever")

    assert calls["n"] == 20  # hard cap: exactly the budget, never more
    assert any(e.get("type") == "assistant" and e.get("text") == "FINAL SUMMARY" for e in events)


def test_parse_httpprobe_bola():
    from harness.utils.parsers import parse_httpprobe
    # Two not-owned ids return 200 with distinct bodies of DIFFERENT size -> verified HIGH.
    out = "\n".join([
        '{"id":"1","url":"http://x/rest/basket/1","status":200,"len":1310,"body":"another user cart with many items"}',
        '{"id":"2","url":"http://x/rest/basket/2","status":200,"len":155,"body":"small"}',
    ])
    f = parse_httpprobe(out, 1)
    assert len(f) == 1 and f[0].severity.value == "high" and f[0].verified
    # Distinct content but IDENTICAL size across ids: a likely templated catch-all ->
    # MEDIUM, unverified (do not over-claim a confirmed IDOR on an SPA/error page).
    tmpl = "\n".join([
        '{"id":"1","url":"http://x/o/1","status":200,"len":20,"body":"object 1 not found!"}',
        '{"id":"2","url":"http://x/o/2","status":200,"len":20,"body":"object 2 not found!"}',
    ])
    fm = parse_httpprobe(tmpl, 1)
    assert len(fm) == 1 and fm[0].severity.value == "medium" and not fm[0].verified
    # All 401 -> no BOLA, just an info status line.
    out401 = '{"id":"1","url":"http://x/1","status":401,"len":10,"body":"nope"}'
    f2 = parse_httpprobe(out401, 1)
    assert f2[0].severity.value == "info"


def test_find_token():
    # Juice Shop shape: nested, with a non-string "bearer" that must NOT win over "token".
    assert _find_token({"authentication": {"token": "JWT123", "bearer": 6, "umail": "x"}}) == "JWT123"
    assert _find_token({"access_token": "AT"}) == "AT"
    assert _find_token({"data": {"user": {"jwt": "J"}}}) == "J"
    assert _find_token({"nope": 1, "msg": "fail"}) is None  # no token key -> None (triggers cookie fallback)


async def test_request_credentials(tmp_path):
    agent = Agent(_settings(tmp_path))

    # No secure-input channel wired -> tells the model to ask in chat, doesn't crash.
    assert "error" in await agent._request_credentials({"fields": ["username", "password"]})

    # With a channel: a token the user types comes back as a ready header (no raw secret echoed).
    agent._on_ask = lambda req: _async({"token": "JWT"})
    res = await agent._request_credentials({"fields": ["token"]})
    assert res["header"] == "Authorization: Bearer JWT" and res["auth"] == "bearer"

    # Cancelled prompt -> flagged, not an error.
    agent._on_ask = lambda req: _async(None)
    assert (await agent._request_credentials({"fields": ["token"]})).get("cancelled") is True


def _async(value):
    async def _coro():
        return value
    return _coro()


async def test_repeat_guard_stops_loop(tmp_path):
    agent = Agent(_settings(tmp_path))

    same = _tool_call("c1", "update_plan", {"steps": [{"text": "recon"}]})
    _script(agent, [
        {"role": "assistant", "content": "plan", "tool_calls": [same]},
        # Identical call again -> deduped, nothing new ran -> loop returns here.
        {"role": "assistant", "content": "plan again", "tool_calls": [dict(same)]},
        {"role": "assistant", "content": "should-not-reach"},
    ])

    events = await _collect(agent, "go")

    # update_plan ran exactly once despite being issued twice.
    assert len([e for e in events if e.get("type") == "plan"]) == 1
    assert not any("should-not-reach" in e.get("text", "") for e in events)
