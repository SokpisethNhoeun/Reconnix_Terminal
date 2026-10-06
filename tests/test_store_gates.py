"""The store is the authority at each gate: template, scope, policy, vault and approvals."""

import pytest

from reconix import store

from .support import ASK_REQUEST, TEST_PASSWORD, event_kinds, run_to

MEDIUM, HIGH = "approval-001", "approval-002"


# --- template and scope ------------------------------------------------------------------
def test_template_only_when_asked_and_unknown_ids_are_refused():
    with pytest.raises(store.StoreValidationError):
        store.select_template("web_url")          # the run hasn't asked yet
    run_to("template", ASK_REQUEST)
    with pytest.raises(store.StoreValidationError):
        store.select_template("nope")
    assert store.select_template("web_url").name == "Web URL"


def test_choosing_a_different_template_than_suggested_rebuilds_the_run():
    run_to("template", ASK_REQUEST)               # a bare hostname suggests Web URL
    assert store.select_template("network").name == "Network"
    assert store.get_scope().kind == "network"
    assert store.get_scope().allowed_ports        # network scope carries ports


def test_scope_approval_assigns_the_assessment_id():
    run_to("template", ASK_REQUEST)
    with pytest.raises(store.StoreValidationError):
        store.approve_scope()                     # not asked for yet
    assert store.assessment_label() == ""
    run_to_gate_after_template()
    store.approve_scope()
    assert store.assessment_label() == "RCX-DEMO-001"
    assert store.is_scope_approved()
    with pytest.raises(store.StoreValidationError):
        store.approve_scope()


def run_to_gate_after_template():
    from .support import play_until_gate
    store.select_template("web_url")
    assert play_until_gate() == "scope"


@pytest.mark.parametrize("method, path, allowed, reason", [
    ("GET", "/products", True, "Within approved scope"),
    ("post", "/search", True, "Within approved scope"),
    ("GET", "/admin", False, "Path outside approved scope"),
    ("GET", "/admin/users", False, "Path outside approved scope"),
    ("GET", "/administrator", True, "Within approved scope"),
    ("DELETE", "/orders/1", False, "Method DELETE not allowed"),
])
def test_policy_check_after_scope_approval(method, path, allowed, reason):
    run_to("account")
    verdict = store.check_request(method, path)
    assert (verdict.allowed, verdict.reason) == (allowed, reason)


def test_policy_blocks_everything_before_the_scope_is_approved():
    verdict = store.check_request("GET", "/products")
    assert not verdict.allowed and verdict.reason == "Scope not approved"


# --- vault -----------------------------------------------------------------------------
def _auth(identity="demo.tester", secret=TEST_PASSWORD, code="123456"):
    return {"identity": identity, "secret": secret, "code": code}


def test_login_only_when_asked_and_validated():
    run_to("scope")
    with pytest.raises(store.StoreValidationError):
        store.provide_auth(_auth())                   # not at the account gate
    run_to_account()
    assert store.current_auth_challenge().kind == "password+otp"   # web_url needs a code
    for bad in [_auth(identity=""), _auth(identity="two words"), _auth(secret=""),
                _auth(identity="u" * 65), _auth(code="12345"), _auth(code="abcdef")]:
        with pytest.raises(store.StoreValidationError):
            store.provide_auth(bad)
    store.provide_auth(_auth(identity="demo.tester"))
    assert store.is_authenticated() and store.has_test_account()
    assert store.vault_scope() == "staging.example.com"


def test_an_otp_only_challenge_stores_nothing():
    from .support import play_until_gate as _p
    store.start_run("test the API at https://api.example.com/v1")   # api → cookie
    assert _p() == "scope"                            # the URL picked the API template
    store.approve_scope()
    assert _p() == "account"
    assert store.current_auth_challenge().kind == "cookie"
    store.provide_auth({"secret": "session=abc123; Path=/"})
    assert store.is_authenticated()
    assert store.vault_scope() == "api.example.com"


def run_to_account():
    from .support import decide, play_until_gate
    decide("scope")
    assert play_until_gate() == "account"


def test_the_password_never_leaves_the_vault():
    run_to(None)
    shown = [c.text for c in store.list_chat()] + [str(c.rows) for c in store.list_chat()]
    shown += [a.message for a in store.list_activity()]
    shown += [f"{e.kind} {e.detail}" for e in store.list_events()]
    shown += [repr(store.report_data())]
    assert not any(TEST_PASSWORD in text for text in shown)
    assert not any("demo.tester" in text for text in shown)
    from reconix.store import lists
    assert TEST_PASSWORD not in repr(lists.current().vault)


# --- approvals -----------------------------------------------------------------------------
def test_approvals_are_refused_before_their_gate():
    run_to("account")
    request = store.get_approval(MEDIUM)
    with pytest.raises(store.StoreValidationError):
        store.approve(MEDIUM, command_hash=request.command_hash)
    with pytest.raises(store.StoreValidationError):
        store.reject(MEDIUM)


def test_medium_needs_the_matching_hash_and_is_decided_once():
    run_to(f"approval:{MEDIUM}")
    request = store.get_approval(MEDIUM)
    assert not store.needs_confirmation(MEDIUM)
    with pytest.raises(store.StoreValidationError):
        store.approve(MEDIUM, command_hash="sha256:other")
    store.approve(MEDIUM, command_hash=request.command_hash)
    assert store.is_approved(MEDIUM)
    with pytest.raises(store.StoreValidationError):
        store.reject(MEDIUM)


@pytest.fixture
def high():
    run_to(f"approval:{HIGH}")
    return store.get_approval(HIGH)


def test_high_needs_token_and_reason(high):
    assert store.needs_confirmation(HIGH)
    with pytest.raises(store.StoreValidationError):     # no token
        store.approve(HIGH, command_hash=high.command_hash, reason="Validate it")
    token = store.request_confirmation(HIGH, high.command_hash)
    with pytest.raises(store.StoreValidationError):     # no reason
        store.approve(HIGH, command_hash=high.command_hash, confirmation_token=token,
                      reason="   ")
    # The failed try did not burn the token.
    decision = store.approve(HIGH, command_hash=high.command_hash, confirmation_token=token,
                             reason=" Validate  the finding ")
    assert decision.reason == "Validate the finding"
    assert store.is_approved(HIGH)


def test_a_high_token_works_once_and_only_for_its_hash(high):
    with pytest.raises(store.StoreValidationError):
        store.request_confirmation(HIGH, "sha256:other")
    token = store.request_confirmation(HIGH, high.command_hash)
    with pytest.raises(store.StoreValidationError):
        store.approve(HIGH, command_hash="sha256:other", confirmation_token=token,
                      reason="Validate it")
    store.approve(HIGH, command_hash=high.command_hash, confirmation_token=token,
                  reason="Validate it")
    with pytest.raises(store.StoreValidationError):
        store.approve(HIGH, command_hash=high.command_hash, confirmation_token=token,
                      reason="Validate it")


def test_declining_voids_the_token_and_is_audited(high):
    token = store.request_confirmation(HIGH, high.command_hash)
    store.decline_confirmation(HIGH)
    with pytest.raises(store.StoreValidationError):
        store.approve(HIGH, command_hash=high.command_hash, confirmation_token=token,
                      reason="Validate it")
    assert event_kinds()[-2:] == ["approval.confirmation_requested",
                                  "approval.confirmation_declined"]


def test_medium_has_no_confirmation_step():
    run_to(f"approval:{MEDIUM}")
    with pytest.raises(store.StoreValidationError):
        store.request_confirmation(MEDIUM, store.get_approval(MEDIUM).command_hash)


# --- editing the scope -----------------------------------------------------------------------
def test_edit_scope_only_while_waiting_and_validates():
    import pytest as _pytest
    from .support import run_to as _run_to
    with _pytest.raises(store.StoreValidationError):
        store.edit_scope(time_limit_minutes=10)       # no scope yet
    _run_to("scope")
    store.edit_scope(allowed_methods=["get", "post"], excluded_paths=["/admin", "/billing"],
                     tools=["Nuclei"], time_limit_minutes=20)
    scope = store.get_scope()
    assert scope.allowed_methods == ["GET", "POST"]        # upper-cased for HTTP
    assert scope.excluded_paths == ["/admin", "/billing"]
    assert scope.time_limit_minutes == 20
    for bad in (dict(time_limit_minutes=0), dict(time_limit_minutes="x"),
                dict(allowed_methods=[]), dict(allowed_methods=["FETCH"]),
                dict(excluded_paths=["admin"]), dict(tools=[])):
        with _pytest.raises(store.StoreValidationError):
            store.edit_scope(**bad)


def test_edit_network_scope_validates_ports():
    from .support import play_until_gate as _p
    store.start_run("scan 10.0.0.0/24 for open ports")
    assert _p() == "scope"                            # the range picked Network
    store.edit_scope(allowed_ports=["80", "443", "8080"])
    assert store.get_scope().allowed_ports == [80, 443, 8080]
    import pytest as _pytest
    with _pytest.raises(store.StoreValidationError):
        store.edit_scope(allowed_ports=["99999"])
