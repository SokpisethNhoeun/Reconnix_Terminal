"""The policy engine: canonical paths, the approved host only, and the time limit."""

from datetime import timedelta

import pytest

from reconix import store
from reconix.store import lists

from .support import decide, play_until_gate, run_to

BLOCKED_ADMIN = [
    "/admin", "/Admin", "/ADMIN", "/admin?x=1", "/admin#a", "/./admin", "/foo/../admin",
    "/%61dmin", "/admin;jsessionid=1", "/admin/", "/admin/users",
    "https://staging.example.com/admin", "https://staging.example.com:443/admin",
]
MALFORMED_OR_FOREIGN = [
    "//admin", "admin", "/admin\t", "/%2561dmin", "/a%2fb", "/a%5cb", "/a\\b",
    "https://evil.example.net/x", "http://169.254.169.254/latest",
    "http://staging.example.com/x", "https://staging.example.com:8443/x",
    "https://u:p@staging.example.com/x", "",
]


@pytest.fixture
def approved_scope():
    run_to("account")


@pytest.mark.parametrize("target", BLOCKED_ADMIN)
def test_every_spelling_of_an_excluded_path_is_blocked(approved_scope, target):
    verdict = store.check_request("GET", target)
    assert (verdict.allowed, verdict.reason) == (False, "Path outside approved scope")


@pytest.mark.parametrize("target", MALFORMED_OR_FOREIGN)
def test_ambiguous_or_foreign_targets_are_blocked(approved_scope, target):
    assert not store.check_request("GET", target).allowed


@pytest.mark.parametrize("target", ["/administrator", "/products?id=1", "/api/orders/10482",
                                    "https://staging.example.com/search"])
def test_in_scope_targets_are_allowed(approved_scope, target):
    assert store.check_request("GET", target).allowed


def test_requests_stop_once_the_time_limit_has_passed(approved_scope):
    lists.current().run.started_at -= timedelta(minutes=31)
    verdict = store.check_request("GET", "/products")
    assert (verdict.allowed, verdict.reason) == (False, "Time limit reached")


def test_the_run_stops_when_the_time_limit_has_passed(approved_scope):
    decide("account")
    lists.current().run.started_at -= timedelta(hours=1)
    assert store.advance() is None
    assert store.display_phase() == "stopped"
    assert "time limit" in store.get_run().stopped


def test_an_approval_outside_the_scope_never_reaches_a_human():
    run_to("account")
    lists.current().approvals[0].path = "/admin/orders"      # the AI proposes an excluded path
    decide("account")
    assert play_until_gate() == "code"
    decide("code")
    assert play_until_gate() is None
    assert store.display_phase() == "stopped"
    assert store.decision_for("approval-001") is None
    assert store.blocked_count() == 2


def test_approve_rechecks_the_policy():
    run_to("approval:approval-001")
    request = store.get_approval("approval-001")
    lists.current().scope.allowed_methods.remove("GET")       # the scope tightened meanwhile
    with pytest.raises(store.StoreValidationError, match="Blocked by policy"):
        store.approve("approval-001", command_hash=request.command_hash)
    assert not store.is_approved("approval-001")
