"""/add-on: manage the AI's knowledge files (reference documents it may quote).

The command opens a menu (add a file, remove one, remove all) or, with a path, adds that file
directly. Adding reads and redacts the file through `store.knowledge`; a long PDF is extracted
in a worker thread so the UI never blocks. Nothing here decides a gate or runs anything — a
knowledge file is only ever read, redacted and stored for the model to quote.
"""

from typing import Optional

from .. import store
from ..models import Choice
from ..screens import ChoiceScreen
from ..screens.forms import AddOnForm

_ADD = "add"
_CLEAR = "__clear_all__"


class KnowledgeMixin:
    """Mixed into ReconixApp."""

    # --- /add-on ------------------------------------------------------------------------------
    def add_on_command(self, arg: Optional[str]) -> None:
        path = (arg or "").strip()
        if path:
            self.add_knowledge_file(path)
        else:
            self.open_add_on_menu()

    def open_add_on_menu(self) -> None:
        try:
            sources = store.list_sources()
        except store.StoreValidationError as exc:
            self._warn(exc)
            return
        choices = [Choice(_ADD, "Add a file…", "A document the AI can quote from (never run)")]
        for i, source in enumerate(sources):
            choices.append(Choice(
                source.id, f"{source.name} · {source.kind} · {source.chunks} passages",
                "Remove this add-on", separated=(i == 0)))
        if sources:
            choices.append(Choice(_CLEAR, "Remove all", "Delete every knowledge file",
                                  tone="danger", separated=True))
            question = "Files the AI may use as reference (redacted, read-only):"
        else:
            question = ("No knowledge files yet. Add one and the AI quotes the relevant passages "
                        "as reference — kept on this computer, redacted, never run.")
        self.open_dialog(
            ChoiceScreen("◆ KNOWLEDGE ADD-ONS", question, choices, chip="Add-on"),
            self._add_on_picked)

    def _add_on_picked(self, choice: Optional[str]) -> None:
        if not choice:
            return
        if choice == _ADD:
            self.open_dialog(AddOnForm(), lambda result: self.refresh_view())
        elif choice == _CLEAR:
            self._confirm_clear_knowledge()
        else:
            self._confirm_remove_knowledge(choice)

    # --- add (worker: a long PDF must not block the UI) ---------------------------------------
    def add_knowledge_file(self, path: str) -> None:
        self.run_worker(lambda: self._add_knowledge(path), thread=True, group="knowledge",
                        exit_on_error=False)

    def _add_knowledge(self, path: str) -> None:
        try:
            source = store.add_source(path)
        except store.StoreValidationError as exc:
            self.call_from_thread(self._warn, exc)
            return
        self.call_from_thread(self._added_knowledge, source.name, source.chunks)

    def _added_knowledge(self, name: str, chunks: int) -> None:
        self.refresh_view()
        self.notify(f"Added {name} — {chunks} passage(s).", title="Add-on", markup=False)

    # --- remove one ---------------------------------------------------------------------------
    def _confirm_remove_knowledge(self, source_id: str) -> None:
        try:
            name = next((s.name for s in store.list_sources() if s.id == source_id), None)
        except store.StoreValidationError as exc:
            self._warn(exc)
            return
        if name is None:
            return
        self.open_dialog(
            ChoiceScreen("REMOVE ADD-ON?", f"Remove {name}? This deletes its saved passages.",
                         [Choice("keep", "No, keep it"),
                          Choice("remove", "Yes, remove it", tone="danger")],
                         chip="Add-on", danger=True, default=0),
            lambda choice: self._do_remove_knowledge(source_id) if choice == "remove" else None)

    def _do_remove_knowledge(self, source_id: str) -> None:
        try:
            removed = store.remove_source(source_id)
        except store.StoreValidationError as exc:
            self._warn(exc)
            return
        self.refresh_view()
        self.notify(f"Removed {removed.name}.", title="Add-on", markup=False)

    # --- remove all ---------------------------------------------------------------------------
    def _confirm_clear_knowledge(self) -> None:
        try:
            count = len(store.list_sources())
        except store.StoreValidationError:
            count = 0
        self.open_dialog(
            ChoiceScreen("REMOVE ALL ADD-ONS?",
                         f"This deletes every saved knowledge file ({count}).",
                         [Choice("keep", "No, keep them"),
                          Choice("clear", "Yes, remove all", tone="danger")],
                         chip="Add-on", danger=True, default=0),
            lambda choice: self._do_clear_knowledge() if choice == "clear" else None)

    def _do_clear_knowledge(self) -> None:
        try:
            count = len(store.list_sources())
            store.clear_knowledge()
        except store.StoreValidationError as exc:
            self._warn(exc)
            return
        self.refresh_view()
        self.notify(f"Removed all {count} add-on(s).", title="Add-on", markup=False)
