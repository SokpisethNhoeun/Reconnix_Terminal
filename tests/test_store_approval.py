"""The store is the authority for the two-step HIGH-risk approval."""

import pytest

from reconix import store

from .support import event_kinds


@pytest.fixture
def request_():
    return store.get_pending_approval()


def test_the_seeded_request_is_high_risk(request_):
    assert store.needs_confirmation(request_.request_id)


def test_high_risk_approval_without_a_token_is_refused(request_):
    with pytest.raises(store.StoreValidationError):
        store.approve(request_.request_id, command_hash=request_.command_hash)
    assert not store.is_approved(request_.request_id)


def test_wrong_command_hash_is_refused(request_):
    token = store.request_confirmation(request_.request_id, request_.command_hash)
    with pytest.raises(store.StoreValidationError):
        store.approve(request_.request_id, command_hash="sha256:other", confirmation_token=token)
    with pytest.raises(store.StoreValidationError):
        store.request_confirmation(request_.request_id, "sha256:other")


def test_a_token_approves_once(request_):
    token = store.request_confirmation(request_.request_id, request_.command_hash)
    decision = store.approve(
        request_.request_id, command_hash=request_.command_hash, confirmation_token=token,
    )
    assert decision.decision == "APPROVED"
    assert store.is_approved(request_.request_id)
    with pytest.raises(store.StoreValidationError):
        store.approve(request_.request_id, command_hash=request_.command_hash,
                      confirmation_token=token)


def test_declining_voids_the_token_and_is_audited(request_):
    token = store.request_confirmation(request_.request_id, request_.command_hash)
    store.decline_confirmation(request_.request_id)
    with pytest.raises(store.StoreValidationError):
        store.approve(request_.request_id, command_hash=request_.command_hash,
                      confirmation_token=token)
    assert event_kinds() == ["approval.confirmation_requested", "approval.confirmation_declined"]


def test_is_approved_follows_the_latest_decision(request_):
    token = store.request_confirmation(request_.request_id, request_.command_hash)
    store.approve(request_.request_id, command_hash=request_.command_hash,
                  confirmation_token=token)
    store.reject(request_.request_id)
    assert not store.is_approved(request_.request_id)


def test_reset_clears_tokens_and_decisions(request_):
    store.request_confirmation(request_.request_id, request_.command_hash)
    store.reject(request_.request_id)
    store.reset()
    assert store.list_approval_decisions() == []
    assert store.list_events() == []
