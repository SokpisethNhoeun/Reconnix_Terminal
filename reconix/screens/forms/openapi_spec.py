"""ATTACH OPENAPI SPEC — read an OpenAPI / Swagger file into the API template's drafted scope."""

from typing import Dict, List, Optional

from rich.text import Text
from textual.widgets import Button, Input, Static

from ... import store, theme
from .base import FormField, FormScreen

BUSY = "Reading the file…"


class OpenApiForm(FormScreen):
    """Dismisses with "attached" once the spec is read, or None.

    The file is read in a worker thread (a big spec must not freeze the screen); the form
    shows a busy line meanwhile, and the store's error lands back on the open form.
    """

    TITLE = "⇡ ATTACH OPENAPI SPEC"
    CHIP = "Scope"
    SUBMIT = "Attach spec"

    def __init__(self) -> None:
        super().__init__()
        self._busy = False

    def fields(self) -> List[FormField]:
        return [FormField("path", "Spec file path", placeholder="~/specs/openapi.yaml")]

    def note(self) -> Optional[Text]:
        return Text("A .json or .yaml OpenAPI 3 / Swagger 2 file. It is only read, never run, "
                    "and it never widens the scope: it can't add a method (only those already "
                    "allowed that it uses are kept) and servers on other hosts are listed as "
                    "out of scope.", style=theme.MUTED)

    def footer(self) -> str:
        return "The spec's endpoints fill the plan; methods are never added · Esc to cancel"

    # --- reading in a worker ----------------------------------------------------------------
    def _submit(self) -> None:
        if self._busy:
            return
        self._busy = True
        self.query_one("#submit", Button).disabled = True
        self.query_one("#form-error", Static).update(Text(BUSY, style=theme.MUTED))
        path = self.values()["path"]
        self.run_worker(lambda: self._read(path), thread=True, group="openapi",
                        exit_on_error=False)

    def _read(self, path: str) -> None:
        try:
            spec = store.attach_api_spec(path)
        except store.StoreValidationError as exc:
            self.app.call_from_thread(self._failed, str(exc))
            return
        except Exception:                                    # never crash the app on a file
            self.app.call_from_thread(self._failed, "Couldn't read that spec file.")
            return
        self.app.call_from_thread(self._done, spec)

    def _failed(self, message: str) -> None:
        self._busy = False
        self.query_one("#submit", Button).disabled = False
        self.show_error(message)

    def _done(self, spec) -> None:
        text = f"Attached {spec.label}: {spec.total} endpoints."
        scope = store.get_scope()
        if scope is not None and not any(m in spec.methods for m in scope.allowed_methods):
            text += " It uses none of the allowed methods; they stay as they were."
        self.app.notify(text, title="OpenAPI", markup=False)
        self._close("attached")

    def submit(self, values: Dict[str, str]) -> Optional[str]:  # pragma: no cover
        raise NotImplementedError("OpenApiForm reads in a worker (see _submit)")

    # --- no closing while the file is read --------------------------------------------------
    def on_input_submitted(self, event: Input.Submitted) -> None:
        event.stop()
        self._submit()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        if self._busy:
            return
        if event.button.id == "submit":
            self._submit()
        else:
            self._close(None)

    def action_cancel(self) -> None:
        if not self._busy:
            self._close(None)
