"""Secrets, tampering, injection and file safety."""

import dataclasses
import json

import pytest

from reconix import store
from reconix.models import Secret
from reconix.store import lists, report
from reconix.store.report_markdown import md

from .support import ASK_REQUEST, TEST_PASSWORD, run_to

HIGH = "approval-002"


# --- secrets -------------------------------------------------------------------------------
def test_a_secret_never_prints_itself():
    secret = Secret(TEST_PASSWORD)
    assert TEST_PASSWORD not in repr(secret) + str(secret) + f"{secret}"
    assert secret.reveal() == TEST_PASSWORD


def test_the_stored_account_never_shows_the_password():
    run_to(None)
    account = lists.current().vault[-1]
    assert TEST_PASSWORD not in repr(account)
    assert TEST_PASSWORD not in repr(dataclasses.asdict(account))


# --- approvals ------------------------------------------------------------------------------
def test_a_request_changed_after_it_was_shown_is_refused():
    run_to("approval:approval-001")
    request = store.get_approval("approval-001")
    shown_hash = request.command_hash
    request.command = request.command.replace("10482", "99999")
    with pytest.raises(store.StoreValidationError, match="changed"):
        store.approve("approval-001", command_hash=shown_hash)


def test_only_the_newest_confirmation_token_works():
    run_to(f"approval:{HIGH}")
    request = store.get_approval(HIGH)
    first = store.request_confirmation(HIGH, request.command_hash)
    second = store.request_confirmation(HIGH, request.command_hash)
    with pytest.raises(store.StoreValidationError):
        store.approve(HIGH, command_hash=request.command_hash, confirmation_token=first)
    store.approve(HIGH, command_hash=request.command_hash, confirmation_token=second)


def test_a_high_token_is_not_given_for_a_medium_action():
    run_to("approval:approval-001")
    request = store.get_approval("approval-001")
    with pytest.raises(store.StoreValidationError):
        store.request_confirmation("approval-001", request.command_hash)


def test_the_password_cant_be_given_at_the_code_step():
    run_to("code")
    before = list(lists.current().vault)
    with pytest.raises(store.StoreValidationError, match="digits"):
        store.provide_auth({"identity": "intruder", "secret": "other-password"})
    assert lists.current().vault == before and not store.is_code_verified()


def test_a_template_is_chosen_once():
    run_to("template", ASK_REQUEST)
    store.select_template("web_url")
    with pytest.raises(store.StoreValidationError):
        store.select_template("web_url")


# --- reports --------------------------------------------------------------------------------------
@pytest.fixture
def reports_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(report, "REPORTS_DIR", tmp_path / "reports")
    return tmp_path / "reports"


@pytest.mark.parametrize("bad_id", ["../../escape", "a/b", ".hidden", "", "x" * 80])
def test_reports_never_leave_the_reports_folder(reports_dir, bad_id):
    run_to(None)
    lists.current().assessment_id = bad_id
    with pytest.raises(store.StoreValidationError):
        store.generate_report("json")
    assert not any(reports_dir.parent.parent.glob("escape*"))


def test_markdown_escapes_run_text(reports_dir):
    run_to(None)
    lists.current().findings[0].title = "x | ![img](http://evil.example/p.png) [link](http://e.example)"
    lists.current().findings[0].evidence.append("``` break out")
    store.generate_report("markdown")
    text = (reports_dir / "RCX-DEMO-001.md").read_text()
    assert "![img](" not in text and "[link](" not in text
    assert "\\|" in text
    assert "````" in text                     # the fence is longer than the evidence's run
    assert md("a|b") == "a\\|b"


def test_json_report_is_valid_and_has_no_secret(reports_dir):
    run_to(None)
    store.generate_report("json")
    data = json.loads((reports_dir / "RCX-DEMO-001.json").read_text())
    assert TEST_PASSWORD not in json.dumps(data)


# --- review round 2 ---------------------------------------------------------------------------
import pytest as _pytest

from .support import play_until_gate as _p


@_pytest.mark.parametrize("target", ["/admin%00", "/admin%00x", "/admin%09", "/admin%0a",
                                     "/public/..;/admin"])
def test_encoded_control_chars_and_matrix_params_cannot_reach_an_excluded_path(target):
    run_to("account")                                  # web_url scope, excluded /admin
    assert not store.check_request("GET", target).allowed


def test_nmap_import_refuses_a_dtd_bomb(tmp_path):
    bomb = ('<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY a "AAAAAAAAAA">'
            '<!ENTITY b "&a;&a;&a;&a;&a;">]><nmaprun><host><address addr="10.0.0.1" '
            'addrtype="ipv4"/><ports><port protocol="tcp" portid="80"><state state="open"/>'
            '<service name="http"/></port></ports></host></nmaprun>')
    path = tmp_path / "bomb.xml"
    path.write_text(bomb)
    with _pytest.raises(store.StoreValidationError):
        store.import_findings(str(path))


def test_edit_scope_refuses_after_approval():
    from .support import run_to as _run_to
    _run_to("account")                                 # scope already approved by now
    with _pytest.raises(store.StoreValidationError):
        store.edit_scope(excluded_paths=[])


def test_edit_scope_network_refuses_empty_ports():
    store.start_run("scan 10.0.0.0/24 for open ports")
    assert _p() == "scope"                             # the range picked Network
    with _pytest.raises(store.StoreValidationError):
        store.edit_scope(allowed_ports=[])


def test_reimporting_the_same_file_does_not_duplicate(tmp_path):
    import json
    path = tmp_path / "n.jsonl"
    path.write_text(json.dumps({"template-id": "t", "matched-at": "https://x.example/a",
                                "info": {"name": "Dup issue", "severity": "low"}}))
    _tool, first = store.import_findings(str(path))
    _tool, second = store.import_findings(str(path))
    assert (first, second) == (1, 0)
