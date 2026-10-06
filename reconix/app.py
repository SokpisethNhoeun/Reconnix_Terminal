"""Reconix TUI — main application.

A keyboard-first demo of the Reconix security-testing flow, built with Textual. One
dashboard shows the assistant, the assessment status and the activity log; each step
that needs a human opens as a dialog over it. Data lives in the in-memory store
(reconix/store). Type `/` for commands and press `?` for the keys.
"""

import shutil
import subprocess
import sys
import webbrowser
from typing import Dict, Optional

from textual.app import App
from textual.binding import Binding

from . import store, theme
from .commands import COMMANDS, Command, find, parse
from .screens import ChoiceScreen, CommandBarScreen, DashboardScreen, HelpScreen
from .screens.dialogs import AssessmentsDialog, TargetDialog


def _open_url(url: str) -> bool:
    """Open a URL in the operator's browser without disturbing the terminal UI.

    The desktop opener is launched detached with its output silenced (a browser that logs
    to the terminal would scribble over the TUI); `webbrowser` is the fallback.
    """
    opener = {"linux": "xdg-open", "darwin": "open"}.get(sys.platform)
    if opener and shutil.which(opener):
        try:
            subprocess.Popen([opener, url], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, start_new_session=True)
            return True
        except OSError:
            pass
    try:
        return webbrowser.open(url)
    except (OSError, webbrowser.Error):
        return False


class ReconixApp(App):
    """Reconix — AI-Powered Security Testing Assistant (demo)."""

    CSS_PATH = ["styles/base.tcss", "styles/dashboard.tcss", "styles/dialogs.tcss"]
    TITLE = "reconix"
    ENABLE_COMMAND_PALETTE = False   # Reconix has its own "/" command system

    BINDINGS = [
        # "/" stays non-priority so a focused Input still receives it as text.
        Binding("slash", "command_bar", "commands", key_display="/"),
        Binding("question_mark", "help", "help", key_display="?"),
        Binding("ctrl+q", "quit", "quit"),
    ]

    def __init__(self) -> None:
        super().__init__()
        self._dashboard: Optional[DashboardScreen] = None

    def get_css_variables(self) -> Dict[str, str]:
        # The stylesheets' $variables come from theme.py, the one place colors are defined.
        return {**super().get_css_variables(), **theme.CSS_TOKENS}

    def on_mount(self) -> None:
        self._dashboard = DashboardScreen()
        self.push_screen(self._dashboard)

    def on_unmount(self) -> None:
        # Quitting ends the session: mark the saved copies so the web dashboard shows
        # an unfinished run as interrupted rather than still waiting.
        store.close_session()

    @property
    def dashboard(self) -> DashboardScreen:
        assert self._dashboard is not None, "the dashboard is pushed on mount"
        return self._dashboard

    # --- global keys -------------------------------------------------------------------------
    def action_help(self) -> None:
        if isinstance(self.screen, HelpScreen):
            self.pop_screen()
        else:
            self.push_screen(HelpScreen.for_screen(self.screen))

    def action_command_bar(self) -> None:
        if self.screen is self.dashboard:      # dialogs keep "/" for typing
            self.push_screen(CommandBarScreen(), self._on_command_bar)

    def _on_command_bar(self, line: Optional[str]) -> None:
        if line:                     # runs after the bar has closed
            self.run_command_line(line)

    # --- slash commands and requests ------------------------------------------------------------
    def run_command_line(self, text: str) -> bool:
        """Run `/name [arg]`. Returns False (and warns) for an unknown command."""
        name, arg = parse(text)
        command = find(COMMANDS, name)
        if command is None and "/" in name:
            return self.submit_request(text)   # a local path (/home/me/app), not a command
        if command is None:
            self.notify(f"Unknown command /{name}. Type / to see the list.",
                        severity="warning", markup=False)
            return False
        self._remember(text)
        self.run_command(command, arg)
        return True

    def run_command(self, command: Command, arg: Optional[str] = None) -> None:
        """Run a command; if it needs a choice that wasn't typed, ask with a menu."""
        if command.choices is None:
            command.run(self, arg)
            return
        choices = command.choices(self)
        if arg and arg.lower() in {c.id for c in choices}:
            command.run(self, arg.lower())
            return
        if not choices:
            self.notify(command.empty or "Nothing to choose from yet.", severity="warning")
            return

        def chosen(choice_id: Optional[str]) -> None:
            if choice_id:
                command.run(self, choice_id)

        question = command.question or command.description
        self.push_screen(
            ChoiceScreen(command.description, question, choices, chip=f"/{command.name}"), chosen,
        )

    def submit_request(self, text: str) -> bool:
        """A plain-language line from the prompt; the dashboard decides what it means."""
        accepted = self.dashboard.submit(text)
        if accepted and text.strip():
            self._remember(text)
        return accepted

    def _remember(self, text: str) -> None:
        try:
            store.add_history(text)
        except store.StoreValidationError:
            pass   # history is best-effort; the action itself already succeeded

    # --- actions shared by commands and keys ------------------------------------------------------
    def new_assessment(self, target: Optional[str] = None) -> None:
        """Start over on a fresh dashboard (the audit trail stays); optionally on `target`.

        The store starts the run before the dashboard is rebuilt: the new dashboard is not
        composed yet, and it plays a started run from its own on_mount.
        """
        store.new_assessment()
        if target and target.strip():
            try:
                store.submit_prompt(target)
            except store.StoreValidationError as exc:
                self.notify(str(exc), severity="warning", markup=False)
        self._rebuild_dashboard()

    def open_template(self, template_id: Optional[str]) -> None:
        """`/template`: type a target for the chosen template, then start on it."""
        if template_id:
            self.push_screen(TargetDialog(template_id),
                             lambda text: self._target_entered(template_id, text))

    def _target_entered(self, template_id: str, text: Optional[str]) -> None:
        if text is None:
            return                           # cancelled: nothing starts
        if not store.get_run().started:
            self.dashboard.start(text, template_id)
            return
        store.new_assessment()               # one already ran: keep it, start a fresh one
        try:
            store.start_run(text, template_id)
        except store.StoreValidationError as exc:
            self.notify(str(exc), severity="warning", markup=False)
        self._rebuild_dashboard()

    def open_findings(self, fid: Optional[str] = None) -> None:
        self.dashboard.action_findings(fid)

    def open_activity(self) -> None:
        self.dashboard.action_activity()

    def open_report(self) -> None:
        self.dashboard.action_report()

    def open_import(self) -> None:
        self.dashboard.action_import()

    def open_assessments(self) -> None:
        self.push_screen(AssessmentsDialog(), self._assessments_closed)

    def _assessments_closed(self, result: Optional[str]) -> None:
        if result == "new":
            self.new_assessment()
        elif result is not None and result.isdigit():
            store.switch_assessment(int(result))
            self._rebuild_dashboard()

    def _rebuild_dashboard(self) -> None:
        while len(self.screen_stack) > 2:
            self.pop_screen()
        self._dashboard = DashboardScreen()
        self.switch_screen(self._dashboard)

    def open_summary(self) -> None:
        if not store.is_finished():
            self.notify("The summary is ready once the assessment has finished.",
                        severity="warning")
            return
        self.dashboard.open_summary()

    def open_web_dashboard(self) -> None:
        """Open the read-only web dashboard in the operator's browser, if it is running."""
        url = store.web_dashboard_url()
        if not url:
            self.notify("Start the web dashboard first:  cd web && npm run dev",
                        title="Web dashboard", severity="warning", markup=False, timeout=7)
            return
        if _open_url(url):
            self.notify(f"Opening the web dashboard in your browser…  {url}",
                        title="Web dashboard", markup=False, timeout=10)
        else:
            self.notify(f"Open it in your browser:  {url}",
                        title="Web dashboard", severity="warning", markup=False, timeout=10)


def main() -> None:
    ReconixApp().run()


if __name__ == "__main__":
    main()
