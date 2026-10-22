"""Generate the shared knowledge ranking vectors from the Python ranker.

    python scripts/make_knowledge_vectors.py          # → web/tests/knowledge-vectors.json
    python scripts/make_knowledge_vectors.py --check   # exit 1 if the file is stale

The file is the contract between `reconix/store/knowledge/rank.py` and the web port
(`web/src/lib/assistant/knowledge`). It holds a `tokens` section (inputs → expected token
lists), a `corpus` (sources with plain-string passages), and `queries` with the expected
ranked passages (score rounded to four decimals, top 4). A passage is relevant when the
number of distinct query tokens it contains is at least `min(2, len(query_tokens))` and its
BM25 score is above zero. `tests/test_knowledge_vectors.py` checks Python against it; the web
adds a vitest.

Flattening (both sides must agree): iterate `corpus` in order; within each source iterate its
`chunks` in order; the passage index is its position in that source's `chunks`.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import reconix.store.knowledge.rank as rank  # noqa: E402  (the module, not the re-exported fn)

OUT = ROOT / "web" / "tests" / "knowledge-vectors.json"

# --- the corpus: 3 sources, 7 passages (plain strings) -------------------------------------
# alert.md is a one-passage source (shows a single-passage file being relevant). runbook.md #1
# and #2 split "sql/injection" from "severity" so a 1-of-3 match is excluded.
CORPUS = [
    {
        "name": "runbook.md",
        "chunks": [
            "The staging environment uses a shared database for all the test accounts.",
            "SQL injection was found in the search endpoint.",
            "The report lists each finding ranked by severity.",
        ],
    },
    {
        "name": "policy.txt",
        "chunks": [
            "Scope approval requires a signed authorization from the system owner.",
            "High risk actions need a double confirmation before the scanner runs.",
            "Never store plaintext passwords in the findings or the exported report.",
        ],
    },
    {
        "name": "alert.md",
        "chunks": [
            "Firewall blocks outbound DNS traffic on the staging host.",
        ],
    },
]

QUERIES = [
    "severity",                                 # single-token query (min matched = 1)
    "firewall dns",                             # two terms, only the one-passage alert.md
    "sql injection severity",                   # runbook #1 matches 2 of 3; #2 only 1 → excluded
    "scope approval authorization owner",       # policy.txt #0
    "test accounts database staging",           # runbook #0 (4); alert #0 matches 1 → excluded
]

TOKEN_INPUTS = [
    "SQL Injection in the Search API!",
    "A an the of to",
    "CVE-2021-44228 log4j RCE",
    "Don't reuse passwords!!!",
    "x y ab 12 999",
]


def _docs():
    docs = []
    for source in CORPUS:
        for index, text in enumerate(source["chunks"]):
            docs.append((source["name"], index, text))
    return docs


def build() -> Dict[str, object]:
    docs = _docs()
    tokens = [{"input": text, "expected": rank.tokenize(text)} for text in TOKEN_INPUTS]
    queries: List[dict] = []
    for query in QUERIES:
        hits = rank.rank(docs, query)
        queries.append({
            "query": query,
            "expected": [
                {"source": p.source, "index": p.index, "score": round(p.score, 4)}
                for p in hits
            ],
        })
    return {"tokens": tokens, "corpus": CORPUS, "queries": queries}


def render(data: Dict[str, object]) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def main(argv=None) -> int:
    args = sys.argv[1:] if argv is None else argv
    expected = render(build())
    if args == ["--check"]:
        on_disk = OUT.read_text(encoding="utf-8") if OUT.exists() else None
        if on_disk == expected:
            print(f"{OUT.relative_to(ROOT)} is up to date")
            return 0
        print(f"{OUT.relative_to(ROOT)} is stale: run python scripts/make_knowledge_vectors.py",
              file=sys.stderr)
        return 1
    if args:
        print("usage: python scripts/make_knowledge_vectors.py [--check]", file=sys.stderr)
        return 2
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(expected, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
