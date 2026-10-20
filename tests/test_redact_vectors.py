"""The web dashboard masks pasted secrets with a port of `redact()`
(web/src/lib/assistant/redact.ts); both test suites check the same cases
(web/tests/redact-vectors.json), so the two stay in step."""

import json
from pathlib import Path

import pytest

from reconix.store.redact import redact

_FILE = Path(__file__).parents[1] / "web" / "tests" / "redact-vectors.json"
VECTORS = json.loads(_FILE.read_text("utf-8"))


@pytest.mark.parametrize("text, masked", VECTORS)
def test_the_web_port_masks_the_same_way(text, masked):
    assert redact(text) == masked
