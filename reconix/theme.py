"""Reconix design tokens — single source of truth for colors used in Rich markup.

The TCSS stylesheet (reconix.tcss) carries the same palette for widget styling;
this module is for inline Rich markup inside widgets (badges, syntax, log lines).
"""

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
CYAN_DIM    = "#0E7490"
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

SEVERITY = {
    "CRITICAL": CRITICAL,
    "HIGH": HIGH,
    "MEDIUM": MEDIUM,
    "LOW": LOW,
    "INFO": INFO,
}

RISK = {
    "LOW": GREEN,
    "MEDIUM": MEDIUM,
    "HIGH": CRITICAL,
}

STATUS = {
    "CONFIRMED":    (TEAL,   "✓"),
    "UNCONFIRMED":  (MUTED,  "○"),
    "INCONCLUSIVE": (VIOLET, "◐"),
    "NEEDS REVIEW": (MEDIUM, "!"),
    "RUNNING":      (CYAN,   "◌"),
    "DONE":         (GREEN,  "✓"),
    "QUEUED":       (DIM,    "·"),
    "BLOCKED":      (CRITICAL, "✕"),
}


def badge(label: str, color: str, glyph: str = "■") -> str:
    """Rich markup for a small severity/status badge."""
    return f"[{color}]{glyph} [b]{label}[/b][/{color}]"


def severity_badge(sev: str) -> str:
    sev = sev.upper()
    return badge(sev, SEVERITY.get(sev, INFO))


def status_badge(status: str) -> str:
    status = status.upper()
    color, glyph = STATUS.get(status, (MUTED, "○"))
    return f"[{color}]{glyph} [b]{status}[/b][/{color}]"


def risk_badge(risk: str) -> str:
    risk = risk.upper()
    color = RISK.get(risk, MUTED)
    return f"[{color}]● [b]{risk}[/b][/{color}]"
