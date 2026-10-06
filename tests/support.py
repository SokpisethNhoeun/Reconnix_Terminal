"""Helpers shared by the tests."""

from typing import List, Optional

from reconix import store

SIZE = (160, 45)   # fixed terminal size, about what the design video shows

TEST_PASSWORD = "s3cret-Pa55-for-tests"   # must never appear anywhere it is shown or saved

# A bare hostname could be a site, an API or a network host, so the run asks for the
# template. The demo request (a URL) and IPv4/repo/path targets pick theirs themselves.
ASK_REQUEST = "Assess staging.example.com"


def event_kinds() -> List[str]:
    return [event.kind for event in store.list_events()]


def play_until_gate() -> Optional[str]:
    """Advance the store's run until it waits at a gate (returns it) or ends (None)."""
    while True:
        step = store.advance()
        if step is None:
            return None
        if step.kind == "gate" and store.waiting_gate() == step.name:
            return step.name


def decide(gate: str) -> None:
    """Make the human decision a gate waits for, straight through the store."""
    if gate == "template":
        store.select_template(store.get_assessment().template_id)
    elif gate == "scope":
        store.approve_scope()
    elif gate == "account":
        store.provide_auth(auth_values(store.current_auth_challenge()))
    elif gate.startswith("approval:"):
        request = store.get_approval(gate.split(":", 1)[1])
        if request.risk == "HIGH":
            token = store.request_confirmation(request.request_id, request.command_hash)
            store.approve(request.request_id, command_hash=request.command_hash,
                          confirmation_token=token,
                          reason="Validate the suspected finding")
        else:
            store.approve(request.request_id, command_hash=request.command_hash)
    else:
        raise ValueError(gate)


def run_to(target: Optional[str], request: str = store.DEMO_REQUEST) -> None:
    """Start a run and decide every gate until `target` is waiting (None: to the end).

    The demo request skips the template gate (its URL picks Web URL); pass
    `ASK_REQUEST` to stop at "template".
    """
    store.start_run(request)
    while True:
        gate = play_until_gate()
        if gate is None or gate == target:
            return
        decide(gate)


# --- driving the UI ----------------------------------------------------------------------
HIGH_REASON = "Validate the suspected finding"


def auth_values(challenge) -> dict:
    """Fill a target-login challenge: a test account, a cookie, and a dummy OTP code."""
    out = {}
    for field in challenge.fields:
        out[field.id] = ("123456" if field.otp
                         else TEST_PASSWORD if field.secret else "demo.tester")
    return out


async def start_run(pilot) -> None:
    """Enter on the empty prompt starts the demo request; the run stops at the scope."""
    await pilot.press("enter")
    await pilot.pause()


async def type_request(app, pilot, text: str) -> None:
    """Type `text` at the dashboard prompt and press Enter."""
    from reconix.widgets import PromptBox

    app.screen.query_one(PromptBox).input.value = text
    await pilot.press("enter")
    await pilot.pause()


async def pass_gate(app, pilot) -> str:
    """Make the decision the open gate dialog asks for, with the keyboard. Returns the gate."""
    from reconix.screens.dialogs import (
        ApprovalDialog, ScopeManifestDialog, SecureInputDialog, TemplateDialog,
    )
    from textual.widgets import Input

    screen = app.screen
    gate = store.waiting_gate()
    if isinstance(screen, TemplateDialog):
        await pilot.press("enter")                       # the AI's suggestion is highlighted
    elif isinstance(screen, ScopeManifestDialog):
        await pilot.press("right", "enter")              # Edit Scope has focus → Approve
    elif isinstance(screen, SecureInputDialog):
        challenge = store.current_auth_challenge()
        for field_id, value in auth_values(challenge).items():
            screen.query_one(f"#{field_id}", Input).value = value
        screen.query_one("#save").press()
    elif isinstance(screen, ApprovalDialog):
        request = store.get_approval(gate.split(":", 1)[1])
        if request.risk == "HIGH":
            screen.query_one("#reason", Input).value = HIGH_REASON
            await pilot.pause()
            screen.query_one("#approve").focus()
            await pilot.press("enter")
        else:
            await pilot.press("left", "enter")           # Reject has focus → Approve
    else:
        raise AssertionError(f"no gate dialog is open (screen: {screen!r})")
    await pilot.pause()
    return gate


async def run_ui_to(app, pilot, target: Optional[str]) -> None:
    """Start the run and pass gates with the keyboard until `target`'s dialog is open."""
    await start_run(pilot)
    while store.waiting_gate() and store.waiting_gate() != target:
        await pass_gate(app, pilot)
    assert store.waiting_gate() == (target or "")
