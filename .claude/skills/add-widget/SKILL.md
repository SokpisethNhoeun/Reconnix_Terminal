---
name: add-widget
description: How to create or extract a reusable widget in reconix/widgets/ for the Reconix TUI. Use when the same markup or layout appears in two or more places (dashboard, dialogs), or when building a new UI component (panel, chip row, key-value grid, log view).
---

# Add a reusable widget

## When
- The same markup, layout, or behavior appears in two or more places (the dashboard, dialogs).
- A dialog's `compose_content()` grows past about 60 lines because of one repeated block.
- Check what exists first: `Panel`, `KeyValueGrid`/`kv_table`, `theme.chip`, `ResultCard`,
  `ActivityRows`, `FormatPicker`, `CompactMenu`.

## Steps
1. **Pick a file by concern** (`panel.py`, `kv_grid.py`, `top_bar.py`, …) or a
   sub-package for a group (`widgets/chat/`, `widgets/status/`). Do not grow one
   catch-all module.
2. **Write the widget**, matching `reconix/widgets/panel.py` and `top_bar.py`:
   - Module and class docstrings.
   - Take data through `__init__` arguments; never import `data` for content the caller should pass.
   - Colors from `theme.*`; layout and spacing in `reconix/styles/*.tcss` using the
     class name as selector, `$variables` only.
   - Recompute width-dependent rendering in `on_resize` (see `TopBar`, `Panel`).
   - Build untrusted text (backend or tool output) as `rich.text.Text`, never markup.
   - A widget that shows store data can read it in a `sync()`/`refresh_view()` method
     (see `AssistantLog`, `StatusPanel`); otherwise take data through `__init__`.
3. **Export** it from `reconix/widgets/__init__.py` (import and `__all__`).
4. **Replace every duplicate** with the widget in the same change.
5. **Verify** with `python -m compileall -q reconix` and run the app or tests.

## Skeleton

```python
"""<What this widget is for>."""

from textual.widgets import Static

from .. import theme


from rich.text import Text


class StatLine(Static):
    """A dim label followed by a value, aligned in a fixed column."""

    def __init__(self, label: str, value: str, color: str = theme.TEXT, width: int = 12) -> None:
        super().__init__(Text.assemble((f"{label:<{width}}", theme.DIM), (value, color)))
```
