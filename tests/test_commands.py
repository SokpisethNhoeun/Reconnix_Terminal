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
    assert names(match(COMMANDS, "/RE")) == ["report"]


def test_name_matches_rank_above_alias_matches():
    # names starting with "s" first, then "new" (alias "start"), then names containing "s"
    ranked = names(match(COMMANDS, "s"))
    assert ranked[:2] == ["summary", "new"]
    assert "findings" in ranked


def test_aliases_match_and_resolve():
    assert names(match(COMMANDS, "exp")) == ["report"]
    assert find(COMMANDS, "audit").name == "activity"
    assert find(COMMANDS, "exit").name == "quit"
    assert find(COMMANDS, "/Start").name == "new"
    assert find(COMMANDS, "nope") is None


def test_parse_splits_name_and_argument():
    assert parse("/finding 001") == ("finding", "001")
    assert parse("/Template") == ("template", None)
    assert parse("  /finding   002 ") == ("finding", "002")


def test_only_finding_and_template_take_an_argument():
    assert [c.name for c in COMMANDS if c.takes_argument] == ["finding", "template"]


def test_scope_is_now_template():
    assert find(COMMANDS, "scope") is None             # F3 still shows the manifest
    assert find(COMMANDS, "templates").name == "template"
