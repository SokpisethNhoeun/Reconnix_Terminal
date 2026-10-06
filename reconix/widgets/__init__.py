"""Reusable widgets: the dashboard panels, dialog parts, menus and the prompt."""

from .activity_log import ActivityRows, activity_line, activity_row
from .chat import AssistantLog, ChatEntryView, ResultCard
from .choice_menu import ChoiceMenu, CompactMenu, SuggestionMenu, menu_hint
from .fkey_bar import FKeyBar
from .format_picker import FormatPicker
from .history import PromptHistory
from .kv_grid import KeyValueGrid, kv_table
from .pane_toggle import PaneToggle
from .panel import Panel, bordered_title, set_bordered_title
from .prompt import PromptBox, PromptInput
from .question import Question
from .secret_input import SecretInput
from .status import CounterTiles, PlanList, PlanPanel, StatusPanel, progress_bar
from .top_bar import TopBar

__all__ = [
    "TopBar", "FKeyBar", "PaneToggle", "Panel", "bordered_title", "set_bordered_title",
    "KeyValueGrid", "kv_table", "AssistantLog", "ChatEntryView", "ResultCard",
    "ActivityRows", "activity_line", "activity_row",
    "StatusPanel", "CounterTiles", "PlanPanel", "PlanList",
    "ChoiceMenu", "CompactMenu", "SuggestionMenu", "FormatPicker", "menu_hint",
    "PromptHistory", "PromptBox", "PromptInput", "Question", "SecretInput", "progress_bar",
]
