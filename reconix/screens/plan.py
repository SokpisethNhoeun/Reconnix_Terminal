"""Frame 03 — Proposed test plan (browsable step list + ↑/↓ action menu)."""

from rich.text import Text
from textual import on
from textual.app import ComposeResult
from textual.binding import Binding
from textual.widgets import OptionList, Static
from textual.widgets.option_list import Option

from .base import ReconixScreen
from .. import store, theme
from ..models import Choice, PlanStep
from ..widgets import ChoiceMenu, Question, UserMessage, menu_hint


class PlanScreen(ReconixScreen):
    flow_name = "plan"
    mode_name = "PLAN"

    BINDINGS = [
        Binding("enter", "choose", "select", show=False),
        Binding("tab", "toggle_focus", "browse steps"),
        Binding("escape", "cancel", "cancel"),
    ]

    def compose_body(self) -> ComposeResult:
        assessment = store.get_assessment()
        steps = store.list_plan_steps()
        gated = sum(1 for step in steps if step.gate == "approve")
        yield UserMessage(store.latest_request().text)
        yield Static(
            f"[{theme.CYAN}]◆ reconix[/] [{theme.DIM}]template: {assessment.template} "
            f"· {len(steps)} actions planned[/]",
            classes="ai-label", markup=True,
        )
        # intent chips
        chips = "   ".join(
            f"[{theme.DIM}]{k}[/] [{theme.TEAL}][b]{v}[/b][/]" for k, v in assessment.intent.items()
        )
        yield Static(chips, markup=True, classes="muted")
        yield Static("")
        yield Static(
            f"[{theme.DIM}]●●  Press [/][{theme.TEXT}][b]Tab[/b][/]"
            f"[{theme.DIM}] to browse steps with ↑/↓ · [/][{theme.TEXT}][b]↵[/b][/]"
            f"[{theme.DIM}] on a step runs the plan[/]",
            markup=True, classes="muted",
        )
        option_list = OptionList(id="plan-list")
        for step in steps:
            option_list.add_option(Option(self._step_line(step), id=f"step-{step.num}"))
        yield option_list
        yield Question(
            "Plan", "Run this plan?",
            [
                Choice("run", "Run plan",
                       f"{len(steps)} steps · {gated} need{'s' if gated == 1 else ''} "
                       "your approval before running.", recommended=True),
                Choice("edit", "Edit steps", disabled=True),
                Choice("cancel", "Cancel", "Go back to the scope.", "danger"),
            ],
            hint=menu_hint("go back", "Tab to browse steps"), menu_id="plan-menu",
        )
        yield Static(
            f"[{theme.CYAN}]↻[/] [{theme.MUTED}]The plan adapts after each finding "
            "— steps may be added based on results.[/]",
            classes="panel-note", markup=True,
        )

    def _step_line(self, step: PlanStep) -> Text:
        risk_color = theme.RISK.get(step.risk, theme.MUTED)
        gate = "runs automatically" if step.gate == "auto" else "needs approval"
        gate_color = theme.DIM if step.gate == "auto" else theme.MEDIUM
        line = Text()
        line.append(f" {step.num}  ", style=f"bold {theme.MUTED}")
        line.append(f"{step.action:<20}", style=f"bold {theme.TEXT}")
        line.append(f"$ {step.command}", style=theme.TEAL)
        line.append("\n    ")
        line.append(f"● {step.risk}", style=f"bold {risk_color}")
        line.append(f"   {gate}", style=gate_color)
        return line

    def on_mount(self) -> None:
        # Without a highlight, Enter on the step list is swallowed and does nothing.
        self.query_one("#plan-list", OptionList).highlighted = 0
        self.query_one("#plan-menu", ChoiceMenu).focus()

    def action_toggle_focus(self) -> None:
        menu = self.query_one("#plan-menu", ChoiceMenu)
        (self.query_one("#plan-list", OptionList) if menu.has_focus else menu).focus()

    def action_run(self) -> None:
        store.log_event("plan.run")
        self.app.go_next()

    def action_cancel(self) -> None:
        if self.query_one("#plan-list", OptionList).has_focus:
            self.query_one("#plan-menu", ChoiceMenu).focus()   # Esc steps back to the menu first
            return
        store.log_event("plan.cancelled")
        self.app.go_prev()

    @on(OptionList.OptionSelected, "#plan-list")
    def _step_selected(self, event: OptionList.OptionSelected) -> None:
        self.action_run()   # Enter on a step runs the plan

    def on_choice_menu_chosen(self, event: ChoiceMenu.Chosen) -> None:
        event.stop()
        {"run": self.action_run, "cancel": self.action_cancel,
         "chat": self.chat_about}[event.choice_id]()

    def chat_topic(self) -> str:
        return "the test plan"
