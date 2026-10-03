"""Slash-command registry: matching, lookup, parsing."""

from reconix.commands import COMMANDS, find, match, parse


def names(commands):
    return [command.name for command in commands]


def test_registry_is_immutable_and_unique():
    assert isinstance(COMMANDS, tuple)
    every = [n for c in COMMANDS for n in (c.name,) + c.aliases]
    assert len(every) == len(set(every))
    assert all(c.description for c in COMMANDS)


def test_empty_query_lists_every_command_in_order():
    assert match(COMMANDS, "") == list(COMMANDS)


def test_prefix_matches_come_before_substring_matches():
    assert names(match(COMMANDS, "fi")) == ["findings", "finding"]
    assert names(match(COMMANDS, "port")) == ["report", "export"]
    assert names(match(COMMANDS, "/RE")) == ["report"]


def test_name_matches_rank_above_alias_matches():
    assert names(match(COMMANDS, "e"))[:3] == ["export", "status", "quit"]


def test_aliases_match_and_resolve():
    assert names(match(COMMANDS, "exe")) == ["status"]
    assert find(COMMANDS, "exit").name == "quit"
    assert find(COMMANDS, "/Start").name == "new"
    assert find(COMMANDS, "nope") is None


def test_parse_splits_name_and_argument():
    assert parse("/export pdf") == ("export", "pdf")
    assert parse("/Plan") == ("plan", None)
    assert parse("  /finding   rec-002 ") == ("finding", "rec-002")


def test_commands_with_choices_take_an_argument():
    assert find(COMMANDS, "export").takes_argument
    assert not find(COMMANDS, "plan").takes_argument
