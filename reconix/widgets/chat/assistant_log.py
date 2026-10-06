"""The AI ASSISTANT panel: a live stream of the chat and the tool/policy activity.

Chat entries and activity entries share one monotonic `seq`, so the two logs merge into
one time-ordered stream. Chat shows as bubbles; activity shows as compact stream lines.
"""

from textual.app import ComposeResult
from textual.containers import VerticalScroll

from ... import store
from ..panel import Panel
from .entry import ChatEntryView, stream_line


class AssistantLog(Panel):
    """Merges `store.list_chat()` and `store.list_activity()` by seq, newest at the bottom."""

    def __init__(self, **kwargs) -> None:
        super().__init__("AI ASSISTANT", **kwargs)
        self._last_seq = 0

    def compose(self) -> ComposeResult:
        yield VerticalScroll(id="chat-scroll")

    def on_mount(self) -> None:
        self.sync()

    @property
    def transcript(self) -> VerticalScroll:
        return self.query_one("#chat-scroll", VerticalScroll)

    def sync(self) -> None:
        """Mount every chat/activity entry newer than the last one shown, in seq order."""
        items = sorted(
            [(entry.seq, "chat", entry) for entry in store.list_chat()]
            + [(entry.seq, "act", entry) for entry in store.list_activity()],
            key=lambda item: (item[0], item[1]),   # by seq, then kind — never the entry object
        )
        new = [item for item in items if item[0] > self._last_seq]
        if not new:
            return
        self._last_seq = new[-1][0]
        widgets = [ChatEntryView(entry) if kind == "chat" else stream_line(entry)
                   for _seq, kind, entry in new]
        self.transcript.mount_all(widgets)
        self.transcript.scroll_end(animate=False, immediate=False)
