"""Reconix design tokens — the single source of truth for colors.

Rich markup in widgets uses the constants below. The stylesheets in `styles/` use
the same values as `$variables`: `ReconixApp.get_css_variables()` feeds them
`CSS_TOKENS`, so a color is defined here and nowhere else.
"""

from typing import Dict

from rich.text import Text

# Core palette (matches reconix_tokens.json from the Figma pack)
BG          = "#0B0F12"
SURFACE     = "#131A1F"
SURFACE2    = "#0F1519"
RAISED      = "#18222A"
BORDER      = "#1F2A30"
BORDER_STR  = "#2B3A42"
TEXT        = "#E6EDF0"
MUTED       = "#7D8B91"
DIM         = "#4A575D"

CYAN        = "#22D3EE"
CYAN_DIM    = "#0C6D88"  # 4.9:1 on the light web background (AA)
TEAL        = "#2DD4BF"

# Severity scale
CRITICAL    = "#F2495C"
HIGH        = "#F97316"
MEDIUM      = "#FBBF24"
LOW         = "#38BDF8"
INFO        = "#94A3B8"

# Syntax / accents
VIOLET      = "#A78BFA"
GREEN       = "#4ADE80"
STRING      = "#86EFAC"
KEY         = "#7DD3FC"
NUMBER      = "#FDBA74"

# Tinted backgrounds for chips, banners and highlighted rows
CYAN_BG     = "#0E2A33"
AMBER_BG    = "#2B2410"
GREEN_BG    = "#0D2A20"
RED_BG      = "#2D1418"
VIOLET_BG   = "#1E1A33"

# $name -> value for the stylesheets (see ReconixApp.get_css_variables)
CSS_TOKENS: Dict[str, str] = {
    "bg": BG, "surface": SURFACE, "surface2": SURFACE2, "raised": RAISED,
    "border": BORDER, "border-strong": BORDER_STR,
    "text": TEXT, "muted": MUTED, "dim": DIM,
    "cyan": CYAN, "cyan-dim": CYAN_DIM, "teal": TEAL,
    "critical": CRITICAL, "high": HIGH, "medium": MEDIUM, "low": LOW, "info": INFO,
    "violet": VIOLET, "green": GREEN,
    "cyan-bg": CYAN_BG, "amber-bg": AMBER_BG, "green-bg": GREEN_BG, "red-bg": RED_BG,
    "violet-bg": VIOLET_BG,
}

# Web dashboard (web/, neumorphism) — light and dark palettes. scripts/export_tokens.py
# writes them to web/src/styles/tokens.css; the web code uses only those variables.
# Surfaces match the background (soft UI): `sd`/`sl` are the dark/light shadow colors.
# Light-theme accent and severity steps are darker so marks and text clear contrast.
WEB_TOKENS: Dict[str, Dict[str, str]] = {
    "light": {
        "bg": "#E4EAF0", "sd": "#BAC5D0", "sl": "#FFFFFF",
        "text": "#1E2A33", "muted": "#4F616D", "faint": "#8696A1", "line": "#CBD4DD",
        "accent": CYAN_DIM, "accent-ink": "#FFFFFF", "accent-wash": "#D2E3EA",
        "critical": "#D42F45", "high": "#C2550A", "medium": "#A86B00", "low": "#0277B6",
        "info": "#5E6E80", "ok": "#15803D", "warn": "#A86B00", "bad": "#D42F45",
    },
    "dark": {
        "bg": "#1C232A", "sd": "#11161A", "sl": "#27313A",
        "text": TEXT, "muted": "#9AA8B0", "faint": "#62717A", "line": "#2B353E",
        "accent": CYAN, "accent-ink": BG, "accent-wash": "#17343E",
        # the web's dark red is a step lighter than the TUI's: 4.9:1 on #1C232A (AA)
        "critical": "#F4596B", "high": HIGH, "medium": MEDIUM, "low": LOW,
        "info": INFO, "ok": GREEN, "warn": MEDIUM, "bad": "#F4596B",
    },
}

SEVERITY = {
    "CRITICAL": CRITICAL,
    "HIGH": HIGH,
    "MEDIUM": MEDIUM,
    "LOW": LOW,
    "INFO": INFO,
}

# Risk of a gated action (plan rows, approval panel)
RISK = {
    "LOW": GREEN,
    "MEDIUM": MEDIUM,
    "HIGH": CRITICAL,
}

# (color, glyph) for a finding's validation and a plan task's state
STATUS = {
    "CONFIRMED":    (TEAL,   "✓"),
    "UNCONFIRMED":  (MUTED,  "○"),
    "INCONCLUSIVE": (VIOLET, "◐"),
    "done":         (GREEN,  "✓"),
    "active":       (CYAN,   "◌"),
    "pending":      (DIM,    "·"),
}

# (color, label) for an analyst's triage status
TRIAGE = {
    "open":           (MUTED,    "Open"),
    "fixed":          (GREEN,    "Fixed"),
    "accepted":       (MEDIUM,   "Accepted"),
    "false-positive": (VIOLET,   "False +"),
}

# Text color for a tone ("ok", "warn", "block", ...) used by chat, log and dialogs
TONE = {
    "default": TEXT,
    "ok": GREEN,
    "warn": MEDIUM,
    "block": CRITICAL,
    "muted": MUTED,
}

# Chip colors: tone -> (text, background)
CHIP = {
    "cyan":   (CYAN, CYAN_BG),
    "amber":  (MEDIUM, AMBER_BG),
    "green":  (GREEN, GREEN_BG),
    "red":    (CRITICAL, RED_BG),
    "violet": (VIOLET, VIOLET_BG),
    "muted":  (MUTED, RAISED),
}

# Who said it: chat speakers and activity-log sources
SPEAKER = {"reconix": CYAN, "you": VIOLET, "policy": MEDIUM}
SOURCE = {"SYS": TEXT, "AI": CYAN, "USER": VIOLET, "TOOL": TEAL, "POLICY": MEDIUM}

SEVERITY_CHIP = {
    "CRITICAL": "red", "HIGH": "red", "MEDIUM": "amber", "LOW": "cyan", "INFO": "muted",
}
RISK_CHIP = {"LOW": "green", "MEDIUM": "amber", "HIGH": "red"}


def chip(label: str, tone: str = "cyan", solid: bool = False) -> Text:
    """A small label on a tinted background, e.g. ` DRAFT `. `solid` inverts it."""
    fg, bg = CHIP.get(tone, CHIP["muted"])
    style = f"bold {BG} on {fg}" if solid else f"bold {fg} on {bg}"
    return Text(f" {label} ", style=style)


def severity_chip(severity: str) -> Text:
    severity = severity.upper()
    return chip(severity, SEVERITY_CHIP.get(severity, "muted"))


def risk_chip(risk: str) -> Text:
    risk = risk.upper()
    return chip(f"RISK: {risk}", RISK_CHIP.get(risk, "muted"), solid=True)
