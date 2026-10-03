"""Execution progress and streamed tool output."""

from typing import List

from ..models import ExecTask, LogLine
from . import lists


def list_exec_tasks() -> List[ExecTask]:
    return list(lists.EXEC_TASKS)


def list_scan_output() -> List[LogLine]:
    return list(lists.SCAN_OUTPUT)
