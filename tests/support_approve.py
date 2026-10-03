"""Helper: approve the pending step directly through the store (for tests past the gate)."""

from reconix import store


def approve_pending() -> None:
    request = store.get_pending_approval()
    token = store.request_confirmation(request.request_id, request.command_hash)
    store.approve(request.request_id, command_hash=request.command_hash,
                  confirmation_token=token)
