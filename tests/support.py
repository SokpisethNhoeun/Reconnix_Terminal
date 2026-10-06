"""Helpers shared by the tests: driving the store's run, and driving the UI."""

from typing import List, Optional

from reconix import store

SIZE = (140, 45)   # fixed terminal size so layout-dependent widgets behave the same

TEST_PASSWORD = "s3cret-Pa55-for-tests"   # must never appear anywhere it is shown or saved

# A bare hostname could be a site, an API or a network host, so the run asks for the
# template. The demo request (a URL) and IPv4/repo/path targets pick theirs themselves.
ASK_REQUEST = "Assess staging.example.com"


def event_kinds() -> List[str]:
    return [event.kind for event in store.list_events()]


# --- the run, straight through the store ---------------------------------------------------
def play_until_gate() -> Optional[str]:
    """Advance the store's run until it waits at a gate (returns it) or ends (None)."""
    while True:
        step = store.advance()
        if step is None:
            return None
        if step.kind == "gate" and store.waiting_gate() == step.name:
            return step.name


def auth_values(challenge) -> dict:
    """Fill a login step: a test account or a cookie, or (the code step) a dummy OTP code."""
    out = {}
    for field in challenge.fields:
        out[field.id] = ("123456" if field.otp
                         else TEST_PASSWORD if field.secret else "demo.tester")
    return out


def decide(gate: str) -> None:
    """Make the human decision a gate waits for, straight through the store."""
    if gate == "template":
        store.select_template(store.get_assessment().template_id)
    elif gate == "scope":
        store.approve_scope()
    elif gate == "plan":
        store.run_plan()
    elif gate in ("account", "code"):
        store.provide_auth(auth_values(store.current_auth_challenge()))
    elif gate.startswith("approval:"):
        request = store.get_approval(gate.split(":", 1)[1])
        if request.risk == "HIGH":
            token = store.request_confirmation(request.request_id, request.command_hash)
            store.approve(request.request_id, command_hash=request.command_hash,
                          confirmation_token=token)
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


# --- driving the UI ------------------------------------------------------------------------
async def settle(pilot, rounds: int = 4) -> None:
    """Let screen switches, dialogs (pushed on the app's next turn) and redraws land."""
    for _ in range(rounds):
        await pilot.pause()


async def show(app, pilot, name: str) -> None:
    """Jump straight to a flow screen and let it mount."""
    app.goto(name)
    await settle(pilot)


async def start_demo(pilot) -> None:
    """Enter on the empty Start prompt runs the demo request; it stops at the scope."""
    await pilot.press("enter")
    await settle(pilot)


async def pass_gate(app, pilot) -> str:
    """Make the decision the run waits for, with the keyboard. Returns the gate."""
    from textual.widgets import Input

    from reconix.screens import ApprovalScreen, ChoiceScreen, PlanScreen, TemplateScreen
    from reconix.screens.forms import LoginForm

    gate = store.waiting_gate()
    screen = app.screen
    if isinstance(screen, TemplateScreen):
        await pilot.press("1" if gate == "scope" else "enter")   # Approve / the suggestion
    elif isinstance(screen, PlanScreen):
        await pilot.press("1")                                   # Run plan
    elif isinstance(screen, LoginForm):
        for field_id, value in auth_values(store.current_auth_challenge()).items():
            screen.query_one(f"#{field_id}", Input).value = value
        screen.query_one("#submit").press()
    elif isinstance(screen, ApprovalScreen):
        request = store.get_approval(gate.split(":", 1)[1])
        if request.risk == "HIGH":
            await pilot.press("1")                               # Approve & run
            await settle(pilot)
            assert isinstance(app.screen, ChoiceScreen)
            await pilot.press("down", "enter")                   # Yes (No is the default)
        else:
            await pilot.press("1")
    else:
        raise AssertionError(f"no gate is open (screen: {screen!r}, gate: {gate!r})")
    await settle(pilot)
    return gate


async def run_ui_to(app, pilot, target: Optional[str]) -> None:
    """Start the demo run and pass gates with the keyboard until `target` is waiting."""
    await start_demo(pilot)
    while store.waiting_gate() and store.waiting_gate() != target and not store.is_finished():
        await pass_gate(app, pilot)
    assert store.waiting_gate() == (target or "") or (target is None and store.is_finished())
