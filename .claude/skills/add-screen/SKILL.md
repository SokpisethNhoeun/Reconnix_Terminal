---
name: add-screen
description: Checklist for adding a new dialog (or, rarely, a full screen) to the Reconix TUI so it is wired into the dashboard, keys, help, commands and docs correctly. Use whenever creating a file under reconix/screens/.
---

# Add a dialog (or a screen) to Reconix

The app has **one** main screen, `DashboardScreen`. New UI is almost always a
**dialog** over it (`reconix/screens/dialogs/`). Add a full `Screen` only if the
dashboard itself is replaced.

## 1. Plan (write it down before coding)
- What opens it: a gate in the run (`gate(...)` step in `store/scenario.py`), an
  F-key, or a `/command`.
- What it reads and writes in the store, and whether those functions exist.
- Its result word(s) for `dismiss()` and what the dashboard does with each.
- Its safe first focus (the choice that is harmless if Enter is pressed by habit).

## 2. Data first
Add dataclasses to `reconix/models/`, demo rows to `reconix/store/seed.py` (and a
list in `store/lists.py` if needed), and functions to `reconix/store/<resource>.py`,
exported from `store/__init__.py`. Store writes validate and raise
`StoreValidationError`. A gate's decision function must check that the run is
waiting at that gate (`lists.RUNS[-1].waiting_gate`). Dialogs hold no data literals.

## 3. Create `reconix/screens/dialogs/<name>.py`

```python
"""<HEADING> — <one line on what the operator decides here>."""

from typing import Iterable

from rich.text import Text
from textual.app import ComposeResult
from textual.widgets import Button, Static

from ... import store, theme
from ...widgets import KeyValueGrid
from .base import DialogScreen, dialog_button


class ThingDialog(DialogScreen):
    """Dismisses with "done", or None (decide later)."""

    HEADING = "THING · REVIEW"
    TONE = "cyan"            # cyan | amber | violet | green | red (frame color)

    def tag(self) -> Text:   # optional: chip at the right of the top border
        return theme.chip("DRAFT", "amber")

    def compose_content(self) -> ComposeResult:
        yield Static(Text("What this is.", style=theme.MUTED), classes="dialog-note")
        yield KeyValueGrid([("Label", "value")], label_width=16, classes="dialog-grid")

    def buttons(self) -> Iterable[Button]:
        return [dialog_button("Cancel", "cancel"), dialog_button("Do it", "do", primary=True)]

    def status(self) -> Text:  # optional: note at the right of the buttons
        return Text("Nothing runs until you decide", style=theme.MEDIUM)

    def first_focus(self):
        return self.query_one("#cancel", Button)      # the safe choice

    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        if event.button.id != "do":
            self.dismiss(None)
            return
        try:
            store.do_thing()
        except store.StoreValidationError as exc:
            self.show_error(str(exc))                 # stays open; never markup
            return
        self.dismiss("done")
```

Base behavior you get for free: Esc → `on_close()` then `dismiss(None)`; ←/→ move
between buttons; ↑/↓ between fields; the frame title, tag and color.

## 4. Wire it up
- [ ] Export from `reconix/screens/dialogs/__init__.py` (import and `__all__`).
- [ ] Open it from `DashboardScreen` (a gate in `_gate_dialog`, an `action_*` for an
      F-key, or both) and handle its result in a callback. Never push a dialog from
      inside another dialog; dismiss and let the dashboard open the next one.
- [ ] Width and any layout in `reconix/styles/dialogs.tcss` (`ThingDialog .dialog-frame`),
      `$variables` only.
- [ ] Add a `/command` in `reconix/commands/builtin.py` if it should be reachable by
      name, give every binding a description, and update the README keys/commands.
- [ ] If it approves or runs anything risky, route it through `store.approve()`.

## 5. Verify
```bash
.venv/bin/python -m compileall -q reconix
.venv/bin/pytest -q            # add tests: opens, safe focus, store write, Esc restores the stack
```
