"""Normalized findings."""

from dataclasses import dataclass, field
from typing import List, Tuple

# (label, text, color-key) — color-key is one of: text, string, green, dim
EvidenceLine = Tuple[str, str, str]


@dataclass
class Finding:
    fid: str
    severity: str
    title: str
    target: str
    tool: str
    ref: str
    status: str
    cvss: str
    impact: str
    remediation: str
    references: List[str] = field(default_factory=list)
    evidence: List[EvidenceLine] = field(default_factory=list)
