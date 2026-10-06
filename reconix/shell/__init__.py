"""App-level behaviour split by concern; `ReconixApp` mixes these in.

navigation  the screen flow (←/→, 1–8, goto)
run_host    hosting the run controller and routing its gates to screens
actions     starting, deciding and leaving assessments
dialogs     pop-ups for commands: assessments, triage, import, exports, audit, web
"""

from .actions import ActionsMixin
from .dialogs import DialogsMixin
from .navigation import FLOW, FLOW_ORDER, NavigationMixin
from .run_host import RunHostMixin

__all__ = ["ActionsMixin", "DialogsMixin", "NavigationMixin", "RunHostMixin", "FLOW",
           "FLOW_ORDER"]
