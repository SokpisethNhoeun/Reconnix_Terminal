"""Target login: the challenge a step raises, and storing what it returns.

Durable credentials (a session cookie, or an email/username and password) are kept in
memory as `Secret`s for this assessment only. A one-time code is validated and used, but
never stored. Nothing here reaches the chat, the activity log, findings or reports.
"""

from typing import Dict, Optional, Union

from ..models import GATE_ACCOUNT, AuthChallenge, Secret, VaultEntry, challenge_for
from . import lists
from .activity import log_event
from .errors import StoreValidationError
from .transcript import add_activity

MAX_IDENTITY_LENGTH = 64
MAX_SECRET_LENGTH = 4096
OTP_LENGTH = 6


def current_auth_challenge() -> Optional[AuthChallenge]:
    """What the current assessment's target login needs, or None when none is set."""
    kind = lists.current().auth_kind
    return challenge_for(kind) if kind else None


def _as_secret(value: Union[Secret, str]) -> Secret:
    return value if isinstance(value, Secret) else Secret(value)


def provide_auth(values: Dict[str, Union[Secret, str]]) -> None:
    """Validate and apply the target login for the open challenge.

    `values` maps each challenge field id to its value (secrets may be `Secret`). The
    one-time code is checked and discarded; the rest is stored for this assessment.
    """
    assessment = lists.current()
    challenge = current_auth_challenge()
    if challenge is None or assessment.run.waiting_gate != GATE_ACCOUNT:
        raise StoreValidationError("A login can only be added when Reconix asks for one.")

    identity = ""
    secret: Optional[Secret] = None
    for field in challenge.fields:
        raw = values.get(field.id, "")
        if field.otp:
            code = (raw.reveal() if isinstance(raw, Secret) else str(raw)).strip()
            if not (len(code) == OTP_LENGTH and code.isdigit()):
                raise StoreValidationError(f"The one-time code is {OTP_LENGTH} digits.")
            continue
        if field.secret:
            secret = _as_secret(raw)
            if not secret:
                raise StoreValidationError(f"Enter the {field.label.lower()}.")
            if len(secret) > MAX_SECRET_LENGTH:
                raise StoreValidationError(f"{field.label} is too long.")
        else:
            identity = (raw.reveal() if isinstance(raw, Secret) else str(raw)).strip()
            if not identity:
                raise StoreValidationError(f"Enter the {field.label.lower()}.")
            if len(identity) > MAX_IDENTITY_LENGTH or any(c.isspace() for c in identity):
                raise StoreValidationError(
                    f"{field.label} is one word, up to {MAX_IDENTITY_LENGTH} characters.")

    _store(challenge.kind, identity, secret)
    assessment.run.authenticated = True
    detail = "one-time code used (not stored)" if challenge.kind == "otp" \
        else f"target login stored ({challenge.kind})"
    add_activity("USER", f"Authenticated · {detail}", tone="ok")
    log_event("vault.auth_provided", challenge.kind)


def _store(kind: str, identity: str, secret: Optional[Secret]) -> None:
    vault = lists.current().vault
    scope = lists.current().target
    if kind == "otp":
        return                                    # nothing durable to keep
    if kind == "cookie":
        entry = VaultEntry(kind="cookie", secret=secret, scope=scope, label="session cookie")
    else:                                         # password or password+otp
        entry = VaultEntry(kind="password", identity=identity, secret=secret, scope=scope,
                           label=f"password · {identity}")
    vault.clear()
    vault.append(entry)


def has_test_account() -> bool:
    return bool(lists.current().vault)


def is_authenticated() -> bool:
    return lists.current().run.authenticated


def vault_scope() -> str:
    """The host the stored credential may be used against ("" when there is none)."""
    vault = lists.current().vault
    return vault[-1].scope if vault else ""
