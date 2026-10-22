"""Pop-up forms with text inputs, built on the reusable `FormScreen`."""

from .approval_edit import ApprovalEditForm
from .base import FormField, FormScreen
from .credential import CredentialForm
from .login import LoginForm
from .openapi_spec import OpenApiForm
from .provider import ProviderForm
from .scope_edit import ScopeEditForm

__all__ = ["ApprovalEditForm", "FormField", "FormScreen", "CredentialForm",
           "LoginForm", "OpenApiForm", "ProviderForm", "ScopeEditForm"]
