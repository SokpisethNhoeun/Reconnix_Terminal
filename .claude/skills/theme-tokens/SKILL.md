---
name: theme-tokens
description: Rules for adding or changing colors and design tokens in the Reconix TUI. All colors live in reconix/theme.py; the stylesheets get them as $variables. Use whenever touching colors, chips, severity/risk styles, banners or tones.
---

# Theme tokens

Every color is defined **once**, in `reconix/theme.py`.

| Where | Used for | How |
|-------|----------|-----|
| `theme.py` constants | Rich `Text` styles in widgets and dialogs | `Text("…", style=theme.CYAN)` |
| `theme.CSS_TOKENS` | the stylesheets in `reconix/styles/*.tcss` | `$kebab-case` (`$border-strong`) |

`ReconixApp.get_css_variables()` merges `CSS_TOKENS` into Textual's variables, so
`$cyan` in any `.tcss` file is `theme.CYAN`.

## Rules
1. **Never write a hex value** in a screen, widget, dialog or `.tcss` file.
2. A new color: add the `UPPER_SNAKE` constant to `theme.py`; if CSS needs it, add
   it to `CSS_TOKENS` too (`"kebab-name": CONSTANT`).
3. Meaning goes through the maps and helpers, not inline colors:
   - `TONE` (default/ok/warn/block/muted) for chat lines, banners, log rows.
   - `CHIP` + `chip(label, tone, solid=False)` for badges (`DRAFT`, `CONFIRMED`, phases).
   - `severity_chip()` and `risk_chip()` for severity and risk.
   - `SPEAKER` (chat) and `SOURCE` (activity log) for who said it.
4. The severity order is fixed: CRITICAL, HIGH, MEDIUM, LOW, INFO.
5. Keep contrast readable on `BG`: body text `TEXT`, secondary `MUTED`, hints `DIM`.
   Never use `DIM` for something the operator must read.

## Checks

```bash
# No hex outside theme.py:
grep -rnE '#[0-9A-Fa-f]{6}' reconix --include=*.py --include=*.tcss | grep -v 'reconix/theme.py'
# Every $variable used in CSS exists in CSS_TOKENS (or is a Textual built-in):
grep -ohE '\$[a-z0-9-]+' reconix/styles/*.tcss | sort -u
```
Data in `reconix/store/` holds no markup or colors; widgets apply `theme.*`.
