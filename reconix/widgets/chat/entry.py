"""One assistant entry: the speaker column, then a line, banner, card or checklist item.

All text is built as Rich Text, so brackets in user or tool text are never markup.
"""

from rich.text import Text
from textual.app import ComposeResult
from textual.containers import Horizontal
from textual.widget import Widget
from textual.widgets import Static

from ... import theme
from ...models import ActivityEntry, ChatEntry
from .result_card import ResultCard

SPEAKER_WIDTH = 10   # "reconix ›" right-aligned
BANNER_GLYPH = {"block": "✕", "warn": "▲", "ok": "✓"}

# How each activity source reads in the left stream: a glyph before the message.
STREAM_GLYPH = {"TOOL": "→", "AI": "∴", "POLICY": "■", "SYS": "·", "USER": "▸"}


def speaker_label(speaker: str) -> Text:
    if not speaker:
        return Text("")
    color = theme.SPEAKER.get(speaker, theme.MUTED)
    return Text.assemble((speaker, f"bold {color}"), (" ›", theme.DIM), justify="right")


def entry_body(entry: ChatEntry) -> Widget:
    color = theme.TONE.get(entry.tone, theme.TEXT)
    if entry.kind == "card":
        return ResultCard(entry.text, entry.rows)
    if entry.kind == "banner":
        glyph = BANNER_GLYPH.get(entry.tone, "■")
        return Static(Text(f"{glyph} {entry.text}", style=f"bold {color}"),
                      classes=f"chat-banner -{entry.tone}")
    if entry.kind == "check":
        return Static(Text.assemble(("✓ ", theme.GREEN), (entry.text, theme.TEXT)),
                      classes="chat-text")
    return Static(Text(entry.text, style=color), classes="chat-text")


def stream_line(entry: ActivityEntry) -> Static:
    """A compact activity line for the left stream: `→ Executing GET /…` (colored by source)."""
    glyph = "✕" if entry.tone == "block" else STREAM_GLYPH.get(entry.source, "·")
    source_color = theme.SOURCE.get(entry.source, theme.MUTED)
    text_color = theme.MUTED if entry.tone == "default" else theme.TONE.get(entry.tone, theme.MUTED)
    line = Text.assemble((f"{glyph} ", source_color), (entry.message, text_color))
    return Static(line, classes=f"stream-line -{entry.tone}")


class ChatEntryView(Horizontal):
    def __init__(self, entry: ChatEntry) -> None:
        super().__init__(classes="chat-entry")
        self._entry = entry

    def compose(self) -> ComposeResult:
        yield Static(speaker_label(self._entry.speaker), classes="chat-speaker")
        yield entry_body(self._entry)
