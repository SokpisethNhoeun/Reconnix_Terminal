"""Store validators on the paths no other test takes: each refuses and changes nothing."""

import json

import pytest

from reconix import store
from reconix.store import importers, lists
from reconix.store.snapshot import snapshot

from .support import auth_values, play_until_gate, run_to


def refused(call, *args, **kwargs) -> str:
    with pytest.raises(store.StoreValidationError) as error:
        call(*args, **kwargs)
    return str(error.value)


# --- importing tool output -------------------------------------------------------------------
NMAP_NO_PORTS = ('<?xml version="1.0"?><nmaprun><host><address addr="192.0.2.10"/>'
                 '<ports></ports></host></nmaprun>')


@pytest.mark.parametrize("name, content", [
    ("unknown.txt", "just some notes, not tool output"),
    ("bad.jsonl", '{"template-id": "x", "matched-at": '),           # nuclei, broken JSON
    ("bad.xml", '<?xml version="1.0"?><nmaprun><host>'),            # nmap, broken XML
    ("no-ports.xml", NMAP_NO_PORTS),                                 # nmap, nothing open
    ("bad-zap.json", '{"alerts": ['),                                # ZAP, broken JSON
    ("no-alerts.json", '{"@programName": "ZAP", "site": []}'),       # ZAP, no alerts
])
def test_a_bad_import_is_refused_and_adds_nothing(tmp_path, name, content):
    path = tmp_path / name
    path.write_text(content)
    before = list(lists.current().findings)
    assert refused(store.import_findings, str(path))
    assert lists.current().findings == before


@pytest.mark.parametrize("path_text", ["", "   ", None])
def test_an_import_needs_a_path(path_text):
    assert "path" in refused(store.import_findings, path_text)


def test_an_import_needs_a_file(tmp_path):
    assert "No file" in refused(store.import_findings, str(tmp_path / "missing.jsonl"))
    assert "No file" in refused(store.import_findings, str(tmp_path))     # a folder


def test_an_unknown_parser_is_refused():
    assert "Unknown tool" in refused(importers.parse, "{}", "burp")


def test_nuclei_output_with_no_rows_is_refused():
    # A file detected as nuclei always holds a row, so only the parser can see none.
    assert "No nuclei results" in refused(importers.parse, "\n\n", "nuclei")


# --- scope edits -----------------------------------------------------------------------------
def test_network_scope_edits_are_checked():
    store.start_run("scan 10.0.0.0/24 for open ports")
    assert play_until_gate() == "scope"
    refused(store.edit_scope, allowed_ports=["abc"])
    refused(store.edit_scope, allowed_ports=["0"])
    refused(store.edit_scope, time_limit_minutes=481)
    store.edit_scope(time_limit_minutes=480)                         # the upper bound is fine
    assert store.get_scope().time_limit_minutes == 480
    assert store.get_scope().allowed_ports == [22, 80, 443, 8080, 8443]   # unchanged


# --- the target login ------------------------------------------------------------------------
def test_an_oversized_secret_is_refused():
    run_to("account")
    values = auth_values(store.current_auth_challenge())
    secret_field = next(f.id for f in store.current_auth_challenge().fields if f.secret)
    values[secret_field] = "x" * 4097
    refused(store.provide_auth, values)
    assert not store.is_authenticated()


def test_an_empty_cookie_is_refused():
    run_to("account", "test the API at https://api.example.com/v1")
    assert store.current_auth_challenge().kind == "cookie"
    values = {field.id: "" for field in store.current_auth_challenge().fields}
    refused(store.provide_auth, values)
    assert not store.is_authenticated()


# --- unknown ids -----------------------------------------------------------------------------
def test_unknown_ids_are_refused():
    run_to(None)
    assert "approval" in refused(store.get_approval, "approval-999").lower()
    refused(store.gate_state, "warp")
    refused(store.get_finding, "999")
    refused(store.triage_finding, "999", status="fixed")
    refused(store.switch_assessment, 99)


def test_chat_before_a_run_is_refused():
    assert "Start an assessment" in refused(store.say_to_assistant, "hello")


# --- feedback and the audit log ---------------------------------------------------------------
@pytest.mark.parametrize("text", ["", "   ", "x" * 501])
def test_bad_feedback_is_refused(text):
    refused(store.add_feedback, "plan", text)
    assert store.list_feedback() == []


def test_feedback_at_the_limit_is_kept():
    store.add_feedback("plan", "x" * 500)
    assert len(store.list_feedback()) == 1


@pytest.mark.parametrize("kind", ["", "   "])
def test_an_audit_event_needs_a_kind(kind):
    before = len(store.list_events())
    refused(store.log_event, kind)
    assert len(store.list_events()) == before


# --- findings view ---------------------------------------------------------------------------
def test_triage_can_reopen_a_finding():
    run_to(None)
    store.triage_finding("002", status="fixed")
    assert [f.fid for f in store.find_findings("triaged")] == ["002"]
    store.triage_finding("002", status="open")
    assert store.find_findings("triaged") == []


# --- a stopped run's saved copy ---------------------------------------------------------------
def test_a_rejected_high_action_is_saved_as_stopped():
    run_to("approval:approval-002")
    store.reject("approval-002")
    assert play_until_gate() is None
    saved = json.loads(json.dumps(snapshot(lists.current())))
    assert saved["status"] == "Stopped"
    assert "limited_validation" in saved["stopped_reason"]
    assert saved["run"]["completed"] is False
