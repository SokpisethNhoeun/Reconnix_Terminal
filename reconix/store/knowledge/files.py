"""The knowledge folder on disk: `index.json` plus one `<id>.json` per source.

The format is the contract the web reads (see the plan, §4):

    index.json   {"format":"reconix.knowledge/v1","sources":[{id,name,kind,bytes,chunks,added_at}]}
    <id>.json    {"format":"reconix.knowledge.source/v1","id":…,"name":…,"chunks":[passage, …]}

Writes are atomic and 0600 (a temp file opened `O_EXCL`, never following a symlink, then
`os.replace`), reusing `persist`'s helpers so the private-write rules live in one place. A file
that is missing is "no sources yet"; one that is present but malformed raises a clear error.
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from ..errors import StoreValidationError
from ..persist import _write_private
from . import paths

INDEX_FORMAT = "reconix.knowledge/v1"
SOURCE_FORMAT = "reconix.knowledge.source/v1"
INDEX_NAME = "index.json"

MAX_SOURCES = 50
_ID = re.compile(r"^[0-9a-f]{32}$")
_CORRUPT_INDEX = "The knowledge index is corrupt. Remove it with /add-on, then add files again."


@dataclass(frozen=True)
class Source:
    """One add-on source as the index records it."""
    id: str
    name: str
    kind: str
    bytes: int
    chunks: int
    added_at: str


def index_path() -> Path:
    return paths.knowledge_dir() / INDEX_NAME


def source_path(source_id: str) -> Path:
    if not _ID.match(source_id or ""):
        raise StoreValidationError("Unknown add-on.")
    return paths.knowledge_dir() / f"{source_id}.json"


def valid_id(source_id: str) -> bool:
    return bool(_ID.match(source_id or ""))


# --- reading -------------------------------------------------------------------------------

def read_index() -> List[Source]:
    """Every source in `index.json`, in order; `[]` when the file does not exist yet."""
    path = index_path()
    if not path.exists():
        return []
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
    except (OSError, ValueError):
        raise StoreValidationError(_CORRUPT_INDEX) from None
    if not isinstance(data, dict) or data.get("format") != INDEX_FORMAT:
        raise StoreValidationError(_CORRUPT_INDEX)
    rows = data.get("sources")
    if not isinstance(rows, list):
        raise StoreValidationError(_CORRUPT_INDEX)
    sources: List[Source] = []
    for row in rows:
        try:
            sources.append(Source(
                id=str(row["id"]), name=str(row["name"]), kind=str(row["kind"]),
                bytes=int(row["bytes"]), chunks=int(row["chunks"]), added_at=str(row["added_at"]),
            ))
        except (TypeError, KeyError, ValueError):
            raise StoreValidationError(_CORRUPT_INDEX) from None
    return sources


def read_chunks(source_id: str) -> List[str]:
    """The passages of one source; `[]` if its file is missing (the index is the record)."""
    path = source_path(source_id)
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise StoreValidationError(f"The add-on file {path.name} is corrupt.") from None
    if not isinstance(data, dict) or data.get("format") != SOURCE_FORMAT:
        raise StoreValidationError(f"The add-on file {path.name} is corrupt.")
    chunks = data.get("chunks")
    if not isinstance(chunks, list) or not all(isinstance(c, str) for c in chunks):
        raise StoreValidationError(f"The add-on file {path.name} is corrupt.")
    return chunks


def get(source_id: str) -> Optional[Source]:
    for source in read_index():
        if source.id == source_id:
            return source
    return None


# --- writing -------------------------------------------------------------------------------

def write_index(sources: List[Source]) -> None:
    paths.ensure_dir()
    body = {
        "format": INDEX_FORMAT,
        "sources": [
            {"id": s.id, "name": s.name, "kind": s.kind, "bytes": s.bytes,
             "chunks": s.chunks, "added_at": s.added_at}
            for s in sources
        ],
    }
    _write_private(index_path(), json.dumps(body, indent=2) + "\n")


def write_source(source_id: str, name: str, chunks: List[str]) -> None:
    paths.ensure_dir()
    body = {"format": SOURCE_FORMAT, "id": source_id, "name": name, "chunks": list(chunks)}
    _write_private(source_path(source_id), json.dumps(body, indent=2) + "\n")


def delete_source_file(source_id: str) -> None:
    try:
        source_path(source_id).unlink()
    except (OSError, StoreValidationError):
        pass


def delete_all() -> None:
    """Remove every source file and the index."""
    folder = paths.knowledge_dir()
    if not folder.exists():
        return
    for source in _safe_index():
        delete_source_file(source.id)
    try:
        index_path().unlink()
    except OSError:
        pass


def _safe_index() -> List[Source]:
    try:
        return read_index()
    except StoreValidationError:
        return []
