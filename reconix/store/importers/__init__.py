"""Turn real tool output files into findings.

Parsers for nuclei (JSONL), nmap (XML) and OWASP ZAP (JSON) read a file and return
`Finding`s. `import_file` detects the format, parses it, and hands back the findings for
the store to attach to the current assessment. Nothing is executed; files are only read.
"""

from typing import List, Tuple

from ...models import Finding
from ..errors import StoreValidationError
from . import nmap, nuclei, zap

PARSERS = {"nuclei": nuclei, "nmap": nmap, "zap": zap}


def detect(text: str) -> str:
    """Guess the tool that produced `text`; raises if it matches none."""
    head = text.lstrip()[:4000]
    if head.startswith("<?xml") or "<nmaprun" in head:
        return "nmap"
    if '"template-id"' in head or '"template_id"' in head or '"matched-at"' in head:
        return "nuclei"
    if '"alerts"' in head or '"@programName"' in head or '"riskdesc"' in head:
        return "zap"
    raise StoreValidationError("Unrecognized file — expected nuclei (JSONL), nmap (XML) "
                               "or ZAP (JSON) output.")


def parse(text: str, tool: str) -> List[Finding]:
    module = PARSERS.get(tool)
    if module is None:
        raise StoreValidationError(f"Unknown tool {tool}.")
    return module.parse(text)


def parse_auto(text: str) -> Tuple[str, List[Finding]]:
    tool = detect(text)
    return tool, parse(text, tool)
