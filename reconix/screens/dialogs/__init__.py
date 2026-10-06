"""The dialogs that open over the dashboard, one file each."""

from .activity import ActivityDialog
from .assessments import AssessmentsDialog
from .approval import ApprovalDialog
from .base import DialogScreen, dialog_button
from .findings import FindingsDialog
from .import_findings import ImportDialog
from .report import ReportDialog
from .scope_edit import ScopeEditDialog
from .scope_manifest import ScopeManifestDialog
from .secure_input import SecureInputDialog
from .summary import SummaryDialog
from .target import TargetDialog
from .template import TemplateDialog

__all__ = [
    "DialogScreen", "dialog_button", "TemplateDialog", "ScopeManifestDialog", "ScopeEditDialog",
    "SecureInputDialog", "ApprovalDialog", "FindingsDialog", "ReportDialog", "SummaryDialog",
    "ActivityDialog", "AssessmentsDialog", "ImportDialog", "TargetDialog",
]
