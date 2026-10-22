"""The shared ranking vectors: the Python ranker must reproduce web/tests/knowledge-vectors.json.

The web adds a TypeScript test against the same file, so both implementations stay identical.
"""

import importlib.util
import json
import sys
from pathlib import Path

from reconix.store.knowledge import rank

ROOT = Path(__file__).resolve().parents[1]
VECTORS = ROOT / "web" / "tests" / "knowledge-vectors.json"


def _data():
    return json.loads(VECTORS.read_text(encoding="utf-8"))


def _docs(data):
    docs = []
    for source in data["corpus"]:
        for index, text in enumerate(source["chunks"]):
            docs.append((source["name"], index, text))
    return docs


def _generator():
    spec = importlib.util.spec_from_file_location(
        "make_knowledge_vectors", ROOT / "scripts" / "make_knowledge_vectors.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("make_knowledge_vectors", module)
    spec.loader.exec_module(module)
    return module


def test_the_format_has_the_three_sections():
    assert set(_data()) == {"tokens", "corpus", "queries"}


def test_tokens_match():
    for case in _data()["tokens"]:
        assert rank.tokenize(case["input"]) == case["expected"], case["input"]


def test_queries_match_to_four_decimals():
    data = _data()
    docs = _docs(data)
    for case in data["queries"]:
        hits = rank.rank(docs, case["query"])
        got = [{"source": h.source, "index": h.index, "score": round(h.score, 4)} for h in hits]
        assert got == case["expected"], case["query"]


def test_file_is_what_the_generator_writes():
    generator = _generator()
    assert generator.render(generator.build()) == VECTORS.read_text(encoding="utf-8")
