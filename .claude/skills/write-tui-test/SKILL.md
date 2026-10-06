---
name: write-tui-test
description: Patterns for testing the Reconix TUI with pytest, pytest-asyncio and Textual's App.run_test()/Pilot — the store's run and gates, the dashboard, gate dialogs, F-keys, the slash prompt and reports. Use when writing, fixing, or extending tests.
---

# Testing the Reconix TUI

## Harness (already set up)

- `requirements-dev.txt` adds `pytest` and `pytest-asyncio`.
- `pyproject.toml`: `asyncio_mode = "auto"`, `testpaths = ["tests"]`, `pythonpath = ["."]`.
- `tests/conftest.py` (autouse): resets the store around each test; sets
  `RunController.SPEED = 0` and `ReportDialog.STEP_SECONDS = 0` so the run and the
  report build play instantly; points `report.REPORTS_DIR` at `tmp_path`. Fixture `app`.
- `tests/support.py`:
  - `SIZE` (160×45), `TEST_PASSWORD`, `event_kinds()`.
  - Store drivers: `run_to(gate)` (start + decide every gate until `gate` waits;
    `None` = to the end), `decide(gate)`, `play_until_gate()`.
  - Keyboard drivers: `start_run(pilot)`, `pass_gate(app, pilot)`,
    `run_ui_to(app, pilot, gate)`.

Files by area: `test_store_run.py`, `test_store_gates.py`, `test_store_report.py`,
`test_dashboard.py`, `test_gates_ui.py`, `test_dialogs.py`, `test_prompt.py`,
`test_commands.py`, `test_history.py`. Run `.venv/bin/pytest -q` and report the real output.

Gates are `"template"`, `"scope"`, `"account"`, `"approval:approval-001"` (MEDIUM),
`"approval:approval-002"` (HIGH).

## Patterns

**Store rules** (no UI): drive the run to a gate, then check the rule.
```python
from .support import run_to

def test_high_needs_a_reason():
    run_to("approval:approval-002")
    req = store.get_approval("approval-002")
    token = store.request_confirmation(req.request_id, req.command_hash)
    with pytest.raises(store.StoreValidationError):
        store.approve(req.request_id, command_hash=req.command_hash,
                      confirmation_token=token, phrase=req.phrase, reason="")
```

**A gate dialog**: get there with the keyboard, assert on focus and store state.
```python
from .support import SIZE, run_ui_to

async def test_medium_starts_on_reject(app):
    async with app.run_test(size=SIZE) as pilot:
        await run_ui_to(app, pilot, "approval:approval-001")
        assert isinstance(app.screen, ApprovalDialog)
        assert app.focused.id == "reject"
```

**Fields**: set `Input.value` directly, then press Enter (Input.Submitted).
Pressing the same `Button` twice within 0.2 s is ignored by Textual, so prefer
Input submit paths or `await pilot.pause(0.25)` between button presses.

**Slash prompt**: use `"slash"` as the key name; the input must not move.
```python
box = app.screen.query_one(PromptBox)
before = box.input.region
await pilot.press("slash", "a", "c")
await pilot.pause()
assert box.menu.highlighted_id == "activity"
assert box.input.region == before
```

**Commands with an argument menu**: call `app.run_command_line("/finding")`
(typing `/finding` + Enter runs the first match, `/findings`).

## Rules
- Always pass `size=SIZE` (narrow-layout tests pass their own size).
- `await pilot.pause()` after key presses that open or close dialogs. Never `time.sleep`.
- `run_test` turns notifications off: assert on screens, focus, store lists and
  `event_kinds()`, not on toasts.
- After closing a dialog, `len(app.screen_stack)` is back to 2 (default + dashboard).
- Secrets: any test that saves the test account should assert `TEST_PASSWORD` is
  not in chat, activity, audit events, or reports.
- When a backend exists, mock the network with `respx` or by monkeypatching the store module.
