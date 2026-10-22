"""ATTACH OPENAPI SPEC — read an OpenAPI / Swagger file into the API template's drafted scope."""

from typing import Dict, List, Optional

from rich.text import Text

from ... import store, theme
from .base import FormField, FormScreen


class OpenApiForm(FormScreen):
    """Dismisses with "attached" once the spec is read, or None."""

    TITLE = "⇡ ATTACH OPENAPI SPEC"
    CHIP = "Scope"
    SUBMIT = "Attach spec"

    def fields(self) -> List[FormField]:
        return [FormField("path", "Spec file path", placeholder="~/specs/openapi.yaml")]

    def note(self) -> Optional[Text]:
        return Text("A .json or .yaml OpenAPI 3 / Swagger 2 file. It is only read, never run, "
                    "and it never widens the scope: servers on other hosts are listed as out "
                    "of scope.", style=theme.MUTED)

    def footer(self) -> str:
        return "The spec's endpoints and methods fill the draft scope · Esc to cancel"

    def submit(self, values: Dict[str, str]) -> Optional[str]:
        spec = store.attach_api_spec(values["path"])
        self.app.notify(f"Attached {spec.label}: {spec.total} endpoints.", title="OpenAPI",
                        markup=False)
        return "attached"
