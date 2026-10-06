"""The live output of a run: assistant lines and activity-log rows in one ordered stream."""

from typing import List, Union

from rich.text import Text
from textual.widgets import RichLog

from .. import store, theme
from ..models import ActivityEntry, ChatEntry

Entry = Union[ChatEntry, ActivityEntry]
SPEAKER_MARK = {"reconix": "◆ reconix", "you": "› you", "policy": "■ policy"}


def stream() -> List[Entry]:
    """Chat and activity entries of the current assessment, in the order they happened."""
    entries: List[Entry] = list(store.list_chat()) + list(store.list_activity())
    return sorted(entries, key=lambda entry: entry.seq)


def entry_text(entry: Entry) -> Text:
    """One log line. Built as Text, so tool output and typed text are never markup."""
    if isinstance(entry, ActivityEntry):
        return Text.assemble(
            (f"[{entry.source}]", f"bold {theme.SOURCE.get(entry.source, theme.MUTED)}"), " ",
            (entry.message, theme.TONE.get(entry.tone, theme.TEXT)),
        )
    tone = theme.TONE.get(entry.tone, theme.TEXT)
    if entry.kind == "banner":
        return Text(f"■ {entry.text}", style=f"bold {tone}")
    if entry.kind == "check":
        return Text.assemble(("  ✓ ", theme.GREEN), (entry.text, tone))
    if entry.kind == "card":
        line = Text.assemble(("▤ ", theme.CYAN), (entry.text, f"bold {theme.TEXT}"))
        for label, value in entry.rows:
            line.append("   ")
            line.append(f"{label} ", style=theme.DIM)
            line.append(value, style=theme.TEAL)
        return line
    speaker = SPEAKER_MARK.get(entry.speaker, "")
    color = theme.SPEAKER.get(entry.speaker, theme.MUTED)
    if not speaker:
        return Text.assemble("  ", (entry.text, tone))
    return Text.assemble((speaker, f"bold {color}"), "  ", (entry.text, tone))


class RunLog(RichLog):
    """A RichLog that appends the stream entries it hasn't shown yet (`sync()`)."""

    def __init__(self, **kwargs) -> None:
        super().__init__(markup=False, highlight=False, wrap=True, **kwargs)
        self._last_seq = 0

    def on_mount(self) -> None:
        self.sync()

    def sync(self) -> None:
        for entry in stream():
            if entry.seq > self._last_seq:
                self.write(entry_text(entry))
                self._last_seq = entry.seq
