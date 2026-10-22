"""Knowledge add-ons: reference files the AI may read, kept redacted on this computer.

`/add-on` points Reconix at a document (`.txt .md .json .yaml .yml .docx .pdf`); its text is
extracted, **cleaned and redacted at ingest** (secrets never reach disk), split into passages
and saved under `~/.reconix/knowledge`. The terminal chat, the `/assess` agent and the web AI
Assistant then search those passages (BM25) and quote the relevant ones as untrusted reference
material — nothing is ever run from a knowledge file.

This package is the only place that reads or writes the folder. The on-disk format and the
ranker are the contract the web is built to (`rank.py`, `files.py`).
"""

from typing import List

from ..activity import log_event
from ..errors import StoreValidationError
from ..redact import redact
from . import files
from .chunk import chunk
from .extract import extract
from .files import MAX_SOURCES, Source
# Importing from .rank registers the submodule, so `knowledge.rank` stays the module (the web
# port's counterpart). The ranking function is aliased `_bm25` so it never shadows that name.
from .rank import BUDGET_CHARS, Passage, fit_budget, tokenize  # noqa: F401 (re-exported)
from .rank import rank as _bm25

__all__ = [
    "Source", "Passage", "add_source", "list_sources", "remove_source", "clear", "search",
    "MAX_SOURCES",
]


def add_source(path_text: str) -> Source:
    """Read a file, redact it, chunk it and save it as a new source. Returns the `Source`.

    Raises `StoreValidationError` on any refusal (bad path, unsupported type, too large, a
    corrupt index, the 50-source limit) and changes nothing on disk in that case.
    """
    existing = files.read_index()               # also validates the index before we add
    if len(existing) >= MAX_SOURCES:
        raise StoreValidationError(f"The knowledge limit is {MAX_SOURCES} files. Remove one first.")

    extracted = extract(path_text)
    passages = chunk(redact(extracted.text))    # redact the whole text BEFORE chunking/storing
    if not passages:
        raise StoreValidationError("That file has no readable text to add.")

    source_id = _new_id(existing)
    source = Source(id=source_id, name=extracted.name, kind=extracted.kind,
                    bytes=extracted.bytes, chunks=len(passages),
                    added_at=_now())
    files.write_source(source_id, source.name, passages)
    files.write_index(existing + [source])
    log_event("knowledge.added", f"{source.name} ({source.kind}, {source.chunks} passages)")
    return source


def list_sources() -> List[Source]:
    """Every saved source, in the order it was added."""
    return files.read_index()


def remove_source(source_id: str) -> Source:
    """Remove one source (its index entry and its file). Raises if it isn't there."""
    remaining = []
    removed = None
    for source in files.read_index():
        if source.id == source_id:
            removed = source
        else:
            remaining.append(source)
    if removed is None:
        raise StoreValidationError("Unknown add-on.")
    files.write_index(remaining)
    files.delete_source_file(source_id)
    log_event("knowledge.removed", removed.name)
    return removed


def clear() -> None:
    """Remove every source and the index."""
    count = len(files._safe_index())
    files.delete_all()
    log_event("knowledge.cleared", f"{count} file(s)")


def search(query: str, k: int = 4) -> List[Passage]:
    """The relevant passages for `query` across every source (BM25, top `k`, score >= 1.5)."""
    corpus: List[tuple] = []
    for source in files._safe_index():
        for index, text in enumerate(files.read_chunks(source.id)):
            corpus.append((source.name, index, text))
    return _bm25(corpus, query, top=k)


# --- helpers -------------------------------------------------------------------------------

def _new_id(existing: List[Source]) -> str:
    import secrets

    taken = {s.id for s in existing}
    while True:
        candidate = secrets.token_hex(16)
        if candidate not in taken:
            return candidate


def _now() -> str:
    from ...models.base import utc_now
    return utc_now().isoformat(timespec="seconds")
