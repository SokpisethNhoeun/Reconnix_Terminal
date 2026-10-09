"""Natural-language agent that drives the harness via LLM tool-calling.

The user types plain English; the LLM decides which functions to call (add a
target, run a scan, list findings, …), the harness executes them against the Kali
MCP server + DB, and the results are fed back until the model answers. Every
step is streamed out via an ``on_event`` callback so the UI can show what it is
doing, Claude-Code style.

Authorization is enforced in code, not left to the model: active scans refuse
targets not marked authorized (see ScanManager), and the system prompt tells the
model to only mark a target authorized when the user clearly says so.
"""

from __future__ import annotations

import json
from typing import Any, Awaitable, Callable

from .config import LLMSettings, Settings
from .db import Database
from .llm import Analyzer, LLMClient
from .mcp_client import KaliMCP
from .models import Finding, Target, TargetType
from .scanners import SCANNERS
from .scanners.manager import ScanManager

OnEvent = Callable[[dict[str, Any]], Awaitable[None]]
# Two-way channel: agent requests input, the UI collects it (e.g. a modal) and returns it.
AskInput = Callable[[dict[str, Any]], Awaitable[dict[str, Any] | None]]

_TOKEN_KEYS = ("token", "access_token", "accesstoken", "jwt", "id_token", "auth_token")


def _find_token(obj: Any) -> str | None:
    """First JWT/session token found in a JSON login response (nested-aware)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.lower() in _TOKEN_KEYS and isinstance(v, str) and v:
                return v
        for v in obj.values():
            t = _find_token(v)
            if t:
                return t
    return None

SYSTEM_PROMPT = """You are a security-testing assistant for AUTHORIZED, controlled penetration
testing. You talk with the user normally and, when they ask for a security action, you carry it out by
calling the provided tools (nmap, nuclei, nikto, sqlmap, commix, whatweb, gobuster, zap, and target/finding
helpers) which run on a Kali box via an MCP server and store results in a database.

You work as a PLANNER + EXECUTOR with a reflect-before-act (ReflAct) loop: you lay out a plan toward the
user's goal, then execute it one step at a time, reflecting on each tool's output against the goal and
ADAPTING the plan to what you actually find. The point is to be dynamic — not to run a fixed pipeline.

How to respond:
- Default to plain conversation. For a greeting, thanks, or a general question, just reply in a sentence or
  two. Do NOT plan or call tools unless the user is actually asking you to test, scan, or exploit something.
- When the user does ask for a security action, drive it with this loop:
  1. PLAN: call update_plan first with an ordered, goal-oriented checklist of steps. Start with recon
     (whatweb/nmap) before deeper or intrusive tools — you don't yet know what the target runs.
  2. REFLECT + ACT each round: begin your message with ONE short reflection line — what the last tool
     output means relative to the goal and which step you're doing next — then make the next tool call in
     the same turn. One action per round.
  3. ADAPT: after recon or any scan, read the `findings` the tool returns and REVISE the plan with
     update_plan based on what was found, then pick the next scanner from the evidence:
       · tech stack / CMS / language revealed  → targeted nuclei templates, and sqlmap if it's dynamic
       · an extra open web port from nmap       → scan that port too
       · a reflected value or a `?param=` URL    → run nuclei-dast (active param fuzzing / OAST)
       · a login form or injection surface       → sqlmap (SQLi), commix or zap active (command/other inj.)
     Mark steps done/skip as you go. Don't run a tool a finding already rules out; don't skip one the
     evidence calls for.
  4. FINISH: when the goal is met, reply with a short summary — findings worst-severity first, with the
     tool that found each — and a next step or two, and make NO tool call (that ends the loop). You have a
     limited step budget per request, so CONVERGE: once the planned steps are done, stop and summarize
     rather than re-planning or re-scanning indefinitely.
- Stop on sufficient evidence. When a tool gives you enough to CONFIRM a vulnerability class is real —
  e.g. sqlmap extracts data / names the DBMS (SQLi confirmed), a unique injected marker reflects unescaped
  (XSS), a command oracle returns command output (command injection), a different user's object comes back
  (BOLA/IDOR) — treat that class as CONFIRMED: mark its plan step done and do NOT keep running more tools
  against the same confirmed issue. Move to the next untested class; when nothing untested remains, finish.
  Don't chase a negative forever either — if a class comes back clean from its appropriate tool, mark it
  tested and move on.
- Ground every claim about results in the tools. Use list_findings / get_finding to read the database; never
  invent findings, severities, or evidence.

Authorization (hard rule):
- Only scan or exploit targets the user owns or is explicitly authorized to test. Set a target's
  authorized flag true ONLY when the user clearly says they own it or may test it; otherwise ask first.
  The system refuses active scans of unauthorized targets regardless.

Running scans:
- Ensure the target exists (add_target) and is authorized, then run_scan per plan step. Pass an explicit
  tools list (one or a few scanners) so each step is a deliberate, adaptive choice — or a profile name
  (recon, web-deep, dast, full, zap) when it fits. For injection/auth tests, point the target URL at the
  parameterised endpoint.

Credentials (ask when — and only when — you need them):
- Some of the attack surface is behind authentication. When recon or a scan reveals a login form, an
  admin/authenticated-only area, or a 401/403, OR the user's goal requires authenticated functionality,
  obtain a session with the request_credentials tool and keep going — do NOT end the turn to ask in text.
- PREFER the request_credentials tool when you need auth: it pops a secure input box so secrets stay out
  of the chat, logs the user in on the host, and hands you back a session `header` to drop into run_scan
  `options`. Fall back to asking in chat only if that tool reports no secure input is available.
- When you need a DECISION or APPROVAL from the operator (authorization for a risky/intrusive step, or an
  either/or choice), call the ask_operator tool — it pops a dialog in the UI and returns their answer.
  NEVER ask a yes/no or either/or question in plain text and stop: that stalls the run. Keep working once
  they reply; if the tool reports no interactive prompt, choose the safe default and continue.
- Never invent, guess, or brute-force credentials unless the user explicitly asks you to test default/weak
  creds. Handle whatever the user gives you:
    · a token or cookie directly → pass it into the next run_scan via its `options` map, one entry per tool
      with the right flag (sqlmap `--headers='Authorization: Bearer …'` or `--cookie='…'`, nuclei/zap
      `-H '…'`), then continue.
    · only a username + password → call `login` with the login endpoint (find it from recon, or ask the
      user which URL) to obtain the session; it returns a `header` string plus a bare `token`/`cookie`.
      Don't ask the user for a token they already gave you the means to mint.
- Running authenticated checks:
    · For a **Bearer/JWT** session, use the `httpprobe` tool (run_scan tools=["httpprobe"],
      options={"httpprobe": "token=<jwt> path=/rest/basket ids=10,1,2,3"}). Give it the object's endpoint
      `path=` and the `ids=` to enumerate (your own id first as a baseline, then a few you don't own). It
      runs host-side, carries the header intact, and CONFIRMS IDOR/BOLA (flags HIGH when one session reads
      objects it shouldn't). It reports status + body length per id — differing lengths across ids mean real
      per-object data (identical lengths across every id, including a bogus one, mean a catch-all/SPA root:
      point `path=` at the real API endpoint, not the site root). Do NOT pass "Authorization: Bearer <jwt>"
      through another tool's options — the MCP server splits options on whitespace and the space in
      "Bearer <jwt>" corrupts the header (→ 401). A space-free cookie (`--cookie=session=<tok>`) is fine.
    · For injection on an authenticated endpoint, prefer a space-free cookie in options, or httpprobe to
      first confirm the session works.
- If the user can't or won't provide credentials, note the authenticated surface as untested in your
  summary and carry on with the unauthenticated tests.
"""

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "update_plan",
            "description": "Set or revise the step-by-step plan toward the user's goal. Call this first for "
            "any real task, and again whenever findings change what's needed (adaptive re-planning).",
            "parameters": {
                "type": "object",
                "properties": {
                    "steps": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "text": {"type": "string"},
                                "status": {"type": "string", "enum": ["pending", "running", "done", "skip"]},
                            },
                            "required": ["text"],
                        },
                    }
                },
                "required": ["steps"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_capabilities",
            "description": "List available scanner tools and scan profiles.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_target",
            "description": "Create a scan target. Set authorized=true only if the user says they are authorized.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "value": {"type": "string", "description": "URL for web/api, host/CIDR for network, path for source"},
                    "type": {"type": "string", "enum": ["web", "api", "network", "source"]},
                    "authorized": {"type": "boolean"},
                },
                "required": ["name", "value", "type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_targets",
            "description": "List existing targets with their id, type, value and authorized flag.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "authorize_target",
            "description": "Mark an existing target as authorized/in-scope (the user must have confirmed authorization).",
            "parameters": {
                "type": "object",
                "properties": {"target": {"type": "string", "description": "target id, name, or value"}},
                "required": ["target"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_credentials",
            "description": "Pop up a secure input box in the UI for the user to type credentials, instead of "
            "asking them in chat (keeps secrets out of the transcript). PREFER this when you need auth. If "
            "given a login_url + username + password, the host logs in locally and you get back only the "
            "session `header` (the raw password never leaves the host). Returns the header to pass into "
            "run_scan `options`.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "one line shown to the user: why you need this"},
                    "fields": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["login_url", "username", "password", "token", "cookie"]},
                        "description": "which inputs to collect. For form/API login use login_url+username+"
                        "password; or just token / cookie if the user has one.",
                    },
                    "login_url": {"type": "string", "description": "prefill for the login endpoint, if known"},
                },
                "required": ["fields"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ask_operator",
            "description": "Pop up a confirmation / choice dialog in the UI when you need the operator's "
            "decision or approval (e.g. authorization or going ahead with a risky/intrusive action). "
            "Returns their answer. ALWAYS use this instead of asking a yes/no or either/or question in "
            "plain text — plain-text questions stall the run.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string", "description": "the question shown to the operator"},
                    "options": {
                        "type": "array", "items": {"type": "string"},
                        "description": "choices to offer; omit for a Yes/No prompt",
                    },
                },
                "required": ["question"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "login",
            "description": "Authenticate with a username/password at a login endpoint and capture the "
            "session (JWT or cookie), so you can then scan authenticated surface. Use this when the user "
            "gives you credentials instead of a ready token. Runs HTTP from the harness host (target must "
            "be reachable). Returns a `header` string to pass into run_scan `options` for each tool.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "login endpoint, e.g. http://host/rest/user/login"},
                    "username": {"type": "string"},
                    "password": {"type": "string"},
                    "user_field": {"type": "string", "description": "login body field for the username; "
                                   "defaults to 'email' if it looks like an email, else 'username'"},
                    "pass_field": {"type": "string", "description": "body field for the password (default 'password')"},
                    "form": {"type": "boolean", "description": "send as form-encoded instead of JSON (default JSON)"},
                },
                "required": ["url", "username", "password"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_scan",
            "description": "Run a scan against a target. Provide either a profile name or an explicit tools list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "target id, name, or value"},
                    "profile": {"type": "string", "description": "e.g. recon, standard, full, web-deep"},
                    "tools": {"type": "array", "items": {"type": "string"}, "description": "explicit tool list, overrides profile"},
                    "options": {
                        "type": "object",
                        "additionalProperties": {"type": "string"},
                        "description": "Extra CLI flags per tool, appended to the defaults. Use this to pass "
                        "credentials/cookies the user gave you, e.g. {\"sqlmap\": \"--cookie='session=abc'\", "
                        "\"nuclei\": \"-H 'Cookie: session=abc'\"}. Never invent credentials.",
                    },
                },
                "required": ["target"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_findings",
            "description": "List stored findings for a target, optionally filtered by minimum severity.",
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {"type": "string"},
                    "min_severity": {"type": "string", "enum": ["info", "low", "medium", "high", "critical"]},
                },
                "required": ["target"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_finding",
            "description": "Get full detail for one finding (evidence + any AI analysis).",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "integer"}},
                "required": ["id"],
            },
        },
    },
]


class Agent:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.db = Database(settings.db_path)
        self.llm = LLMClient(settings.llm)
        self.analyzer = Analyzer(self.llm)
        self.history: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
        self.plan: list[dict[str, Any]] = []
        self._on_event: OnEvent | None = None
        self._on_ask: AskInput | None = None

    @property
    def ready(self) -> bool:
        return self.llm.available

    def set_llm(self, settings: LLMSettings) -> None:
        """Switch the model/provider mid-conversation, keeping ``self.history``.

        Only the LLM client and analyzer are rebuilt; the conversation and plan stay,
        so the new model sees the full prior context. This is the flexible-switch seam.
        """
        self.llm = LLMClient(settings)
        self.analyzer = Analyzer(self.llm)

    # --- main loop ---------------------------------------------------------
    async def chat(self, user_text: str, on_event: OnEvent, on_ask: AskInput | None = None) -> None:
        self._on_event = on_event
        self._on_ask = on_ask
        self.history.append({"role": "user", "content": user_text})
        self.plan = []  # plan is per-goal; a new user request starts a fresh plan
        seen: set[tuple[str, str]] = set()  # repeat-guard: (tool, args) already run this turn
        for _ in range(20):  # cap tool-call rounds; adaptive multi-scanner plans need room
            # ponytail: fixed cap; make it settings-driven only if real runs hit it.
            msg = await self.llm.raw_chat(self.history, tools=TOOLS)
            tool_calls = msg.get("tool_calls") or []
            # Reasoning (chain-of-thought) is shown but NOT kept in history — resending a
            # prior turn's reasoning wastes tokens and some APIs reject the field.
            reasoning = msg.pop("reasoning_content", None)
            self.history.append(msg)  # record assistant turn (with any tool calls)
            if reasoning:
                await on_event({"type": "reasoning", "text": reasoning})
            if msg.get("content"):
                await on_event({"type": "assistant", "text": msg["content"]})
            if not tool_calls:
                return
            ran_new = False
            for call in tool_calls:
                sig = (call["function"]["name"], call["function"].get("arguments") or "")
                if sig in seen:
                    # Smaller models re-issue the same call; answer it (the API
                    # requires every tool_call to get a tool message) but skip re-running.
                    self.history.append(
                        {"role": "tool", "tool_call_id": call.get("id"),
                         "name": call["function"]["name"],
                         "content": "(already executed this turn — use the earlier result)"}
                    )
                    continue
                seen.add(sig)
                ran_new = True
                await self._run_tool(call)
            if not ran_new:
                # Model only repeated prior calls: it has nothing new to do. Stop.
                return
        # Round budget exhausted: give the model ONE final turn with NO tools, so it must
        # wrap up with a text summary instead of being cut off mid-task.
        try:
            self.history.append({
                "role": "user",
                "content": "You've reached the step limit. Stop testing and give your final summary now "
                           "(findings worst-severity first). Do not call any tools.",
            })
            final = await self.llm.raw_chat(self.history, tools=None)
            reasoning = final.pop("reasoning_content", None)
            self.history.append(final)
            if reasoning:
                await on_event({"type": "reasoning", "text": reasoning})
            await on_event({"type": "assistant",
                            "text": final.get("content") or "(stopped: reached the step limit)"})
        except Exception:  # noqa: BLE001 - never hang on the wrap-up call
            await on_event({"type": "assistant", "text": "(stopped: reached the step limit)"})

    async def _run_tool(self, call: dict[str, Any]) -> None:
        name = call["function"]["name"]
        try:
            args = json.loads(call["function"].get("arguments") or "{}")
        except json.JSONDecodeError:
            args = {}
        await self._emit({"type": "tool_start", "name": name, "args": args})
        try:
            result = await self._dispatch(name, args)
        except Exception as exc:  # noqa: BLE001 - surface to the model + UI
            result = {"error": repr(exc)}
        await self._emit({"type": "tool_end", "name": name, "result": result})
        self.history.append(
            {"role": "tool", "tool_call_id": call.get("id"), "name": name, "content": json.dumps(result)[:6000]}
        )

    async def _emit(self, ev: dict[str, Any]) -> None:
        if self._on_event:
            await self._on_event(ev)

    # --- tool implementations ---------------------------------------------
    async def _dispatch(self, name: str, args: dict[str, Any]) -> Any:
        if name == "update_plan":
            return await self._update_plan(args)
        if name == "list_capabilities":
            return {"tools": sorted(SCANNERS), "profiles": self.settings.profiles()}
        if name == "add_target":
            return self._add_target(args)
        if name == "list_targets":
            return [self._target_dict(t) for t in self.db.list_targets()]
        if name == "authorize_target":
            return self._authorize(args.get("target", ""))
        if name == "request_credentials":
            return await self._request_credentials(args)
        if name == "ask_operator":
            return await self._ask_operator(args)
        if name == "login":
            return await self._login(args)
        if name == "run_scan":
            return await self._run_scan(args)
        if name == "list_findings":
            return self._list_findings(args)
        if name == "get_finding":
            return self._get_finding(int(args.get("id", 0)))
        return {"error": f"unknown tool {name}"}

    async def _update_plan(self, args: dict[str, Any]) -> dict[str, Any]:
        steps = [
            {"text": str(s.get("text", "")), "status": s.get("status", "pending")}
            for s in (args.get("steps") or [])
            if isinstance(s, dict)
        ]
        self.plan = steps
        await self._emit({"type": "plan", "steps": steps})
        return {"ok": True, "steps": steps}

    def _add_target(self, args: dict[str, Any]) -> dict[str, Any]:
        t = Target(
            name=args.get("name", "target"),
            type=TargetType(args.get("type", "web")),
            value=args["value"],
            authorized=bool(args.get("authorized", False)),
        )
        t.id = self.db.add_target(t)
        return self._target_dict(t)

    def _resolve_target(self, ref: str) -> Target | None:
        ref = str(ref).strip()
        targets = self.db.list_targets()
        if ref.isdigit():
            return self.db.get_target(int(ref))
        for t in targets:  # exact name/value first
            if ref in (t.name, t.value):
                return t
        for t in targets:  # fuzzy
            if ref.lower() in t.name.lower() or ref.lower() in t.value.lower():
                return t
        return None

    def _authorize(self, ref: str) -> dict[str, Any]:
        t = self._resolve_target(ref)
        if not t or t.id is None:
            return {"error": f"target {ref!r} not found"}
        with self.db._conn() as conn:  # small direct update
            conn.execute("UPDATE targets SET authorized = 1 WHERE id = ?", (t.id,))
        t.authorized = True
        return self._target_dict(t)

    async def _ask_operator(self, args: dict[str, Any]) -> dict[str, Any]:
        if not self._on_ask:
            return {"answer": "no_prompt",
                    "note": "no interactive prompt here; choose the safe default and continue."}
        question = str(args.get("question") or "Proceed?")
        options = [str(o) for o in (args.get("options") or [])][:6]
        vals = await self._on_ask({"type": "confirm", "question": question, "options": options})
        if not vals or not vals.get("answer"):
            return {"answer": "cancelled",
                    "note": "operator dismissed the prompt; do not proceed with that action."}
        return {"answer": vals["answer"]}

    async def _request_credentials(self, args: dict[str, Any]) -> dict[str, Any]:
        if not self._on_ask:
            return {"error": "no secure input available here; ask the user for the credentials in chat instead."}
        fields = [f for f in (args.get("fields") or []) if f in
                  ("login_url", "username", "password", "token", "cookie")] or ["username", "password"]
        vals = await self._on_ask({
            "reason": str(args.get("reason") or "Credentials needed to test authenticated functionality."),
            "fields": fields,
            "login_url": args.get("login_url", ""),
        })
        if not vals:
            return {"cancelled": True, "note": "user dismissed the prompt; note auth surface as untested."}
        # Resolve to a session header here so the raw password never reaches the model.
        if vals.get("token"):
            return {"ok": True, "auth": "bearer", "token": vals["token"],
                    "header": f"Authorization: Bearer {vals['token']}"}
        if vals.get("cookie"):
            return {"ok": True, "auth": "cookie", "cookie": vals["cookie"],
                    "header": f"Cookie: {vals['cookie']}"}
        if vals.get("username") and vals.get("login_url"):
            return await self._login({"url": vals["login_url"], "username": vals["username"],
                                      "password": vals.get("password", "")})
        return {"error": "need either a token/cookie, or login_url+username+password."}

    async def _login(self, args: dict[str, Any]) -> dict[str, Any]:
        import httpx

        url = str(args.get("url", "")).strip()
        user = str(args.get("username", ""))
        pw = str(args.get("password", ""))
        if not (url and user):
            return {"error": "login needs url + username (+ password)"}
        uf = args.get("user_field") or ("email" if "@" in user else "username")
        pf = args.get("pass_field") or "password"
        body = {uf: user, pf: pw}
        try:
            async with httpx.AsyncClient(timeout=15, verify=False, follow_redirects=True) as c:
                r = await c.post(url, data=body) if args.get("form") else await c.post(url, json=body)
                token = None
                try:
                    token = _find_token(r.json())
                except Exception:  # noqa: BLE001 - non-JSON body is fine, fall back to cookies
                    pass
                cookie = "; ".join(f"{k}={v}" for k, v in r.cookies.items()) or None
        except Exception as exc:  # noqa: BLE001 - surface to the model
            return {"error": f"login request failed: {exc!r}"}

        if not token and not cookie:
            return {"error": f"login returned no token or cookie (HTTP {r.status_code}); "
                    "check the endpoint/field names, or ask the user for a token/cookie directly."}
        header = f"Authorization: Bearer {token}" if token else f"Cookie: {cookie}"
        # For a Bearer session prefer the httpprobe tool (token=<jwt>) — it carries the header
        # intact. Passing "Authorization: Bearer <jwt>" through another tool's run_scan options
        # is corrupted by the MCP server's whitespace split; a space-free cookie survives.
        out = {"ok": True, "status": r.status_code, "auth": "bearer" if token else "cookie", "header": header}
        if token:
            out["token"] = token
        elif cookie:
            out["cookie"] = cookie
        return out

    async def _run_scan(self, args: dict[str, Any]) -> dict[str, Any]:
        t = self._resolve_target(args.get("target", ""))
        if not t:
            return {"error": f"target {args.get('target')!r} not found; add_target first"}
        tools = args.get("tools") or self.settings.profile(args.get("profile", "") or "")
        if not tools:
            tools = ["whatweb", "nuclei", "nikto"] if t.type in (TargetType.WEB, TargetType.API) else ["nmap"]
        if not t.authorized:
            return {
                "error": f"target {t.name!r} (#{t.id}) is NOT authorized; ask the user to confirm "
                "authorization, then call authorize_target before scanning."
            }

        async def progress(line: str) -> None:
            await self._emit({"type": "tool_progress", "text": line})

        # ScanManager's progress callback is sync; bridge it onto the event loop.
        import asyncio

        loop = asyncio.get_running_loop()

        def sync_progress(line: str) -> None:
            loop.create_task(progress(line))

        extra = args.get("options") or {}  # per-tool runtime flags, e.g. a user-supplied cookie
        async with KaliMCP(self.settings.kali) as mcp:
            await self._emit({"type": "tool_progress", "text": f"connected to Kali MCP ({len(mcp.tools)} tools)"})
            opts = {x: f"{self.settings.scanner_options(x)} {extra.get(x, '')}".strip() for x in tools}
            mgr = ScanManager(mcp, self.db, options=opts)
            results = await mgr.run_profile(t, tools, progress=sync_progress)

        # Best-effort AI analysis of high/critical findings.
        analyzed = 0
        for r in results:
            for f in r.findings:
                if f.severity.rank >= 3 and self.analyzer.available and f.id:
                    a = await self.analyzer.analyze(f)
                    if a:
                        self.db.set_finding_analysis(f.id, a)
                        analyzed += 1
        # Surface the actual top findings (worst-severity first) so the planner can
        # adapt the next step to what was found — not just to counts.
        top = sorted(
            (f for r in results for f in r.findings),
            key=lambda f: -f.severity.rank,
        )[:15]
        return {
            "target": self._target_dict(t),
            "tools": [{"tool": r.scanner, "status": r.status, "findings": len(r.findings)} for r in results],
            "total_findings": sum(len(r.findings) for r in results),
            "analyzed": analyzed,
            "findings": [
                {"id": f.id, "severity": f.severity.value, "title": f.title, "location": f.location}
                for f in top
            ],
        }

    def _list_findings(self, args: dict[str, Any]) -> Any:
        t = self._resolve_target(args.get("target", ""))
        if not t or t.id is None:
            return {"error": f"target {args.get('target')!r} not found"}
        floor = args.get("min_severity")
        from .models import Severity

        floor_rank = Severity.coerce(floor).rank if floor else -1
        rows = [f for f in self.db.findings_for_target(t.id) if f.severity.rank >= floor_rank]
        return {
            "count": len(rows),
            "findings": [
                {"id": f.id, "severity": f.severity.value, "title": f.title, "location": f.location}
                for f in rows[:60]
            ],
        }

    def _get_finding(self, finding_id: int) -> Any:
        for t in self.db.list_targets():
            if t.id is None:
                continue
            for f in self.db.findings_for_target(t.id):
                if f.id == finding_id:
                    return self._finding_dict(f)
        return {"error": f"finding #{finding_id} not found"}

    @staticmethod
    def _target_dict(t: Target) -> dict[str, Any]:
        return {"id": t.id, "name": t.name, "type": t.type.value, "value": t.value, "authorized": t.authorized}

    @staticmethod
    def _finding_dict(f: Finding) -> dict[str, Any]:
        return {
            "id": f.id,
            "severity": f.severity.value,
            "title": f.title,
            "location": f.location,
            "evidence": (f.evidence or "")[:1500],
            "ai_analysis": f.ai_analysis,
        }
