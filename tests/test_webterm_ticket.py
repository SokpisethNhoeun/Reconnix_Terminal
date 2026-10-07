"""Terminal tickets, settings and messages: the parts of the browser terminal with no I/O."""

import os

import pytest

from reconix.webterm import Settings, SettingsError, guard, protocol, ticket
from reconix.webterm.session import child_env

TOKEN = "vector-token-0123456789abcdef"
NOW = 1791360000
NONCE = "bm9uY2Utbm9uY2Utbm9uY2U"
# The same vectors are in web/tests/ticket.test.ts: both sides must produce these strings.
VECTOR = "1791360060.bm9uY2Utbm9uY2Utbm9uY2U.767OmcoEmx2ENftC0rHXyqzlEVGSdDVJODGn1iDLw9M"
HELLO = "hvwDvOUa19VuvfFp7P4PlBO6URixHz8Lt-o_vCOGwek"


# --- tickets ---------------------------------------------------------------------------------
def test_tickets_match_the_ones_the_dashboard_mints():
    assert ticket.make(TOKEN, NOW, NONCE) == VECTOR


def test_the_hello_matches_the_proof_the_dashboard_gives_the_page():
    assert ticket.hello_proof(TOKEN, NONCE) == HELLO
    assert ticket.hello_proof("another-token-0123456789", NONCE) != HELLO


def test_a_ticket_works_once():
    book = ticket.TicketBook(TOKEN)
    assert book.redeem(VECTOR, now=NOW) == NONCE
    assert book.redeem(VECTOR, now=NOW + 1) is None


def test_a_ticket_expires_after_a_minute():
    assert ticket.TicketBook(TOKEN).redeem(VECTOR, now=NOW + 60)
    assert not ticket.TicketBook(TOKEN).redeem(VECTOR, now=NOW + 61)


def test_a_ticket_dated_further_ahead_than_it_could_be_is_refused():
    far = ticket.make(TOKEN, NOW + 3600, NONCE)
    assert not ticket.TicketBook(TOKEN).redeem(far, now=NOW)


@pytest.mark.parametrize("value", [
    None, "", "garbage", VECTOR + "x", "x" + VECTOR, VECTOR.replace(".", "-"),
    ticket.make("another-token-0123456789", NOW, NONCE),          # signed with another token
    VECTOR[:-2] + "AA",                                             # signature changed
    VECTOR.replace("1791360060", "1791360059"),                    # re-dated
    VECTOR.replace(NONCE, "bm9uY2Utbm9uY2Utbm9uY2V"),              # nonce changed
])
def test_forged_or_malformed_tickets_are_refused(value):
    assert not ticket.TicketBook(TOKEN).redeem(value, now=NOW)


def test_used_nonces_are_forgotten_once_their_ticket_expired():
    book = ticket.TicketBook(TOKEN)
    book.redeem(VECTOR, now=NOW)
    assert book.remembered == 1
    book.redeem(ticket.make(TOKEN, NOW + 120, "b3RoZXItbm9uY2Utb3RoZXI"), now=NOW + 120)
    assert book.remembered == 1                      # the first one expired and was dropped


# --- who may connect -------------------------------------------------------------------------
@pytest.mark.parametrize("host, origin, why", [
    ("127.0.0.1:3101", "http://127.0.0.1:3100", ""),
    ("localhost:3101", "http://localhost:3100", ""),
    ("evil.example.com:3101", "http://127.0.0.1:3100", "only answers on 127.0.0.1"),
    (None, "http://127.0.0.1:3100", "only answers on 127.0.0.1"),
    ("127.0.0.1:3101", "http://evil.example.com", "Only the Reconix dashboard"),
    ("127.0.0.1:3101", "http://127.0.0.1:3101", "Only the Reconix dashboard"),
    ("127.0.0.1:3101", None, "Only the Reconix dashboard"),
])
def test_only_the_dashboard_on_loopback_may_connect(host, origin, why):
    settings = Settings(token=TOKEN)
    refusal, nonce = guard.check(settings, _book_at_now(), host, origin, f"/?ticket={VECTOR}")
    if why:
        assert why in refusal and nonce is None
    else:
        assert refusal == "" and nonce == NONCE


def test_the_socket_lives_at_the_root_only():
    book = _book_at_now()
    refusal, _ = guard.check(Settings(token=TOKEN), book, "127.0.0.1:3101",
                             "http://127.0.0.1:3100", f"/other?ticket={VECTOR}")
    assert refusal == "Not found." and book.remembered == 0     # the ticket is still unused


def _book_at_now() -> ticket.TicketBook:
    book = ticket.TicketBook(TOKEN)
    redeem = book.redeem
    book.redeem = lambda value, now=None: redeem(value, now=NOW)     # pin the clock
    return book


# --- messages --------------------------------------------------------------------------------
@pytest.mark.parametrize("text, size", [
    ('{"type": "resize", "cols": 120, "rows": 40}', (120, 40)),
    ('{"type": "resize", "cols": 10, "rows": 5}', (10, 5)),
    ('{"type": "resize", "cols": 9, "rows": 40}', None),
    ('{"type": "resize", "cols": 120, "rows": 201}', None),
    ('{"type": "resize", "cols": "120", "rows": 40}', None),
    ('{"type": "resize", "cols": true, "rows": 40}', None),
    ('{"type": "resize", "cols": 120.5, "rows": 40}', None),
    ('{"type": "other", "cols": 120, "rows": 40}', None),
    ('[1, 2]', None),
    ("not json", None),
    ('{"type": "resize", "cols": 120, "rows": 40, "pad": "' + "x" * 300 + '"}', None),
    ("[" * 30000 + "]" * 30000, None),                     # no RecursionError, on any Python
])
def test_only_sensible_resizes_are_accepted(text, size):
    assert protocol.parse_resize(text) == size


# --- settings and the program's environment --------------------------------------------------
def test_settings_need_the_launch_token():
    with pytest.raises(SettingsError, match="launch token"):
        Settings.from_env({})
    with pytest.raises(SettingsError):
        Settings.from_env({"RECONIX_WEB_TOKEN": "short"})


def test_settings_from_the_environment():
    settings = Settings.from_env({
        "RECONIX_WEB_TOKEN": TOKEN, "RECONIX_TERM_PORT": "4101", "RECONIX_WEB_PORT": "4100",
        "RECONIX_TERM_TEST": "1", "RECONIX_TERM_COMMAND": "sh -c 'echo hi'",
        "RECONIX_TERM_WATCH_STDIN": "1"})
    assert settings.port == 4101 and settings.web_port == 4100
    assert settings.command == ("sh", "-c", "echo hi") and settings.stand_in
    assert settings.watch_stdin
    assert settings.hosts == ("127.0.0.1:4101", "localhost:4101")
    assert settings.origins == ("http://127.0.0.1:4100", "http://localhost:4100")
    assert Settings.from_env({"RECONIX_WEB_TOKEN": TOKEN}).command[1:] == ("-m", "reconix")


def test_a_leftover_stand_in_command_never_replaces_the_tui():
    settings = Settings.from_env({"RECONIX_WEB_TOKEN": TOKEN, "RECONIX_TERM_COMMAND": "bash"})
    assert settings.command[1:] == ("-m", "reconix") and not settings.stand_in


@pytest.mark.parametrize("port", ["0", "65536", "abc", "-1"])
def test_bad_ports_are_refused(port):
    with pytest.raises(SettingsError, match="RECONIX_TERM_PORT"):
        Settings.from_env({"RECONIX_WEB_TOKEN": TOKEN, "RECONIX_TERM_PORT": port})


def test_the_program_never_gets_the_launch_token():
    env = child_env({"RECONIX_WEB_TOKEN": TOKEN, "RECONIX_TERM_COMMAND": "x", "COLUMNS": "80",
                     "LINES": "24", "RECONIX_DATA_DIR": "/data", "PYTHONPATH": "/extra"})
    assert "RECONIX_WEB_TOKEN" not in env and "RECONIX_TERM_COMMAND" not in env
    assert "COLUMNS" not in env and "LINES" not in env              # the pty has the size
    assert env["RECONIX_DATA_DIR"] == "/data"                       # saves where the web reads
    assert env["TERM"] == "xterm-256color" and env["COLORTERM"] == "truecolor"
    assert env["RECONIX_IN_WEB"] == "1"
    assert env["PYTHONSAFEPATH"] == "1"                  # nothing imported from the cwd
    root, extra = env["PYTHONPATH"].split(os.pathsep)
    assert os.path.isdir(os.path.join(root, "reconix")) and extra == "/extra"
