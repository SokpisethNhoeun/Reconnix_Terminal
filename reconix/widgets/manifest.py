"""The scope manifest, drawn as lightly syntax-highlighted JSON (Template screen)."""

import json
from typing import List, Tuple

from rich.text import Text
from textual.widgets import Static

from .. import theme
from ..models import ScopeManifest


def manifest_fields(scope: ScopeManifest) -> List[Tuple[str, object]]:
    """The keys shown for this kind of scope, in order."""
    fields: List[Tuple[str, object]] = [
        ("target", scope.target_url),
        ("assessment", scope.assessment_type),
        ("allowed_actions", scope.allowed_actions),
        ("allowed_methods", scope.allowed_methods),
    ]
    if scope.kind == "network":
        fields.append(("allowed_ports", scope.allowed_ports))
    if scope.excluded_paths or scope.kind != "network":
        fields.append(("excluded_paths", scope.excluded_paths))
    fields += [
        ("time_limit_minutes", scope.time_limit_minutes),
        ("tools", scope.tools),
    ]
    return fields


def manifest_text(scope: ScopeManifest) -> Text:
    """JSON-looking Text. Built as Text, so a typed target is never parsed as markup."""
    text = Text("{\n", style=theme.MUTED)
    fields = manifest_fields(scope)
    for i, (key, value) in enumerate(fields):
        color = (theme.CRITICAL if key == "excluded_paths"
                 else theme.NUMBER if isinstance(value, int) or key == "allowed_ports"
                 else theme.STRING)
        text.append("  ")
        text.append(key, style=theme.KEY)
        text.append(": ", style=theme.MUTED)
        text.append(json.dumps(value), style=color)
        text.append(",\n" if i < len(fields) - 1 else "\n", style=theme.MUTED)
    text.append("}", style=theme.MUTED)
    return text


class ScopeManifestView(Static):
    """The manifest body; call `show(scope)` to redraw after an edit."""

    def __init__(self, scope: ScopeManifest, **kwargs) -> None:
        super().__init__(manifest_text(scope), **kwargs)

    def show(self, scope: ScopeManifest) -> None:
        self.update(manifest_text(scope))
