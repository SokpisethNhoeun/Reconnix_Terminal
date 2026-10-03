"""Assessment and the operator's typed requests."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict

from .base import utc_now


@dataclass
class Assessment:
    assessment_id: str
    target: str
    model: str
    policy: str
    operator: str
    template: str                                   # plan template name
    scope: Dict[str, object] = field(default_factory=dict)   # scope manifest
    intent: Dict[str, str] = field(default_factory=dict)     # parsed request intent
    summary: str = ""                               # executive summary for the report


@dataclass
class UserRequest:
    text: str
    created_at: datetime = field(default_factory=utc_now)
