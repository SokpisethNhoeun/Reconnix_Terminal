"""The current assessment and the operator's typed requests."""

from typing import List

from ..models import Assessment, UserRequest
from . import lists
from .activity import log_event
from .errors import StoreValidationError

MAX_REQUEST_LENGTH = 500


def get_assessment() -> Assessment:
    return lists.ASSESSMENTS[-1]


def latest_request() -> UserRequest:
    return lists.REQUESTS[-1]


def list_requests() -> List[UserRequest]:
    return list(lists.REQUESTS)


def add_request(text: str) -> UserRequest:
    """Store a new plain-language request typed on the Start screen."""
    text = " ".join(text.split())
    if not text:
        raise StoreValidationError("Type a request first.")
    if len(text) > MAX_REQUEST_LENGTH:
        raise StoreValidationError(f"Keep the request under {MAX_REQUEST_LENGTH} characters.")
    request = UserRequest(text)
    lists.REQUESTS.append(request)
    log_event("request.submitted", text)
    return request
