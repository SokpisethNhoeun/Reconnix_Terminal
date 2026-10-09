"""Agent mode: the backend harness agent drives a real assessment through the static frames.

A typed target (or `/assess <target>`) with a model active enters the **Template** frame like
the scripted run; approving the scope hands off to the harness `Agent`, which runs on the
**Execution** screen with live step progress (plan rows + spinner + live log) and writes
findings into the store. The LLM is Reconix's active `/model`, switchable mid-run with
preserved context. The async loop runs in a worker (the `web.py` pattern); the scripted
RunController is not used on this path. Without a model/harness, the scripted demo runs.
"""

import asyncio
import threading
from typing import Any, Dict, Optional

from .. import store
from ..screens.forms import CredentialForm
from ..store import agent_run


class AgentMixin:
    """Mixed into ReconixApp."""

    def _init_agent(self) -> None:
        self.agent_mode = False        # this assessment is driven by the harness agent
        self.agent_request = ""        # the operator's target/request for the agent
        self._agent_busy = False       # a turn is running in the worker

    # --- entry: target -> Template frame ------------------------------------------------------
    def start_agent_assessment(self, target: Optional[str]) -> bool:
        """`/assess <target>` — same entry as typing a target with a model active."""
        return self.enter_agent_mode(target)

    def enter_agent_mode(self, target: Optional[str]) -> bool:
        target = (target or "").strip()
        if not agent_run.harness_installed():
            self.notify("The harness backend isn't installed (pip install -e backend).",
                        severity="warning", markup=False)
            return False
        if store.active_model() is None:
            self.notify("Pick a model first with /model.", severity="warning", markup=False)
            return False
        if not target:
            self.notify("Give a target, e.g. /assess http://host", severity="warning",
                        markup=False)
            return False
        if store.get_run().started:                 # start fresh; the old one stays listed
            self.controller.stop()
            store.new_assessment()
        try:
            result = store.submit_prompt(target)    # build the run + scope like the static flow
        except store.StoreValidationError as exc:
            self._warn(exc)
            return False
        if result != "started":
            self.notify("That doesn't look like a scan target (URL, host or repo).",
                        severity="warning", markup=False)
            return False
        self.agent_mode = True
        self.agent_request = target
        self._remember(target)
        self.refresh_view()
        self.controller.resume()                    # play to the Template/scope gate, then pause
        self.goto("template")
        return True

    # --- scope approved -> run the agent on the Execution screen -------------------------------
    def begin_agent_execution(self) -> None:
        agent_run.begin_execution()                 # mark the run live + enterable
        self.goto("execution")
        # Approving the Reconix scope IS the authorization — tell the agent to proceed
        # autonomously and not ask again, so it starts scanning immediately.
        target = self.agent_request or store.get_assessment().target
        self._send_to_agent(
            f"Assess {target}. The operator has approved the scope and authorized this "
            "engagement — treat the target as authorized and do NOT ask for authorization or "
            "confirmation. Begin immediately: run reconnaissance, then adapt and test based on "
            "what you find, and report findings as you go.")

    def _send_to_agent(self, text: str) -> None:
        """Record the operator line and run one agent turn in a worker.

        While a turn is running (scanning / a PoC test), chat is not accepted — the operator
        can chat again once it finishes.
        """
        if self._agent_busy:
            self.notify("The assessment is running — you can chat once it finishes.",
                        severity="warning", markup=False)
            return
        agent_run.record_user(text)
        self._agent_busy = True
        self.refresh_view()
        self.notify("Thinking…", timeout=2)
        self.run_worker(lambda: self._agent_worker(text), thread=True, group="agent",
                        exit_on_error=False)

    # --- worker -------------------------------------------------------------------------------
    def _agent_worker(self, text: str) -> None:
        try:
            asyncio.run(self._agent_turn(text))
        except store.StoreValidationError as exc:
            self.call_from_thread(self._agent_note, str(exc), "warn")
        except Exception as exc:                        # never crash the UI on a backend error
            self.call_from_thread(self._agent_note, f"Agent error: {exc!r}", "block")
        finally:
            self.call_from_thread(self._agent_finished)

    async def _agent_turn(self, text: str) -> None:
        async def on_event(ev: Dict[str, Any]) -> None:
            self.call_from_thread(self._apply_agent_event, ev)
        await agent_run.run(text, on_event, self._agent_on_ask)

    async def _agent_on_ask(self, request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Pop a dialog on the UI thread and block this turn until the operator answers.

        A confirmation/decision request pops a choice dialog; anything else (credentials)
        pops the secure-input form. Returns the operator's answer, or None if dismissed.
        """
        result: Dict[str, Any] = {}
        done = threading.Event()

        def open_modal() -> None:
            def closed(values: Optional[Dict[str, Any]]) -> None:
                result["values"] = values
                done.set()
            if request.get("type") == "confirm":
                self._open_confirm(request, closed)
            else:
                self.open_dialog(CredentialForm(request), closed)

        self.call_from_thread(open_modal)
        await asyncio.get_event_loop().run_in_executor(None, done.wait)
        return result.get("values")

    def _open_confirm(self, request: Dict[str, Any], closed) -> None:
        """A Yes/No (or multiple-choice) approval dialog the agent asked for."""
        from ..models import Choice
        from ..screens import ChoiceScreen

        question = str(request.get("question") or "Proceed?")
        options = request.get("options") or []
        choices = ([Choice(str(o), str(o)) for o in options]
                   if options else [Choice("yes", "Yes"), Choice("no", "No")])
        self.open_dialog(
            ChoiceScreen("◆ AGENT NEEDS YOUR DECISION", question, choices, chip="Approve"),
            lambda choice: closed({"answer": choice} if choice else None))

    # --- main-thread updates ------------------------------------------------------------------
    def _apply_agent_event(self, ev: Dict[str, Any]) -> None:
        agent_run.record_event(ev)
        self.refresh_view()

    def _agent_note(self, text: str, tone: str = "muted") -> None:
        agent_run.note(text, tone)
        self.refresh_view()

    def _agent_finished(self) -> None:
        self._agent_busy = False
        if self.agent_mode:
            agent_run.finish()
        self.refresh_view()
