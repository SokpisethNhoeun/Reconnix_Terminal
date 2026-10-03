"""Execution progress rows and streamed tool output."""

from dataclasses import dataclass


@dataclass
class ExecTask:
    action: str
    tool: str
    status: str        # "DONE" | "RUNNING"
    detail: str        # what the row shows now
    result: str = ""   # what a RUNNING row shows once it finishes


@dataclass
class LogLine:
    """One line of tool output. Plain data: the screen decides how to color it."""

    kind: str               # "info" | "match"
    message: str = ""       # info lines
    template: str = ""      # match lines: template id
    target: str = ""        # match lines: where it matched
    severity: str = ""      # match lines: info | low | medium | high | critical
