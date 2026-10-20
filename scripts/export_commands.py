"""Write the docs' command reference from the TUI's slash commands (the single source).

    python scripts/export_commands.py        # → web/src/content/docs/commands.json

The web docs build one page per command from this file, so the reference can never name a
command the TUI doesn't have (or miss one it does): `tests/test_export_commands.py` fails
when the file on disk differs from what `build()` returns, and the web's vitest fails when a
command has no hand-written page or a page names no command.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from reconix.commands.builtin import COMMANDS  # noqa: E402

OUT = ROOT / "web" / "src" / "content" / "docs" / "commands.json"

# The reference's areas, in reading order, and the commands each one lists. Every command in
# COMMANDS must appear exactly once; a new command fails `build()` until it is placed here.
GROUPS = (
    ("start", "Start & navigate", ("help", "new", "template")),
    ("flow", "Flow", ("plan", "approval", "status")),
    ("findings", "Findings & reports", ("findings", "finding", "report", "export", "summary")),
    ("data", "Assessments & data", ("assessments", "import", "audit")),
    ("ai", "AI models & agent", ("assess", "provider", "model")),
    ("dashboard", "Dashboard", ("web",)),
    ("session", "Session", ("quit",)),
)


def _entry(command) -> Dict[str, object]:
    return {
        "name": command.name,
        "aliases": list(command.aliases),
        "description": command.description,
        # True when the argument is picked from a list (`choices`); `ask` says whether a
        # missing argument opens that list as a menu (False: the list only suggests).
        "takes_argument": command.takes_argument,
        "ask": bool(command.ask) if command.takes_argument else False,
        "question": command.question,
        "empty": command.empty,
    }


def build() -> Dict[str, object]:
    """The reference as plain data: the areas, each with its commands in COMMANDS order."""
    by_name = {command.name: command for command in COMMANDS}
    placed: List[str] = [name for _, _, names in GROUPS for name in names]
    missing = sorted(set(by_name) - set(placed))
    unknown = sorted(set(placed) - set(by_name))
    duplicates = sorted({name for name in placed if placed.count(name) > 1})
    if missing or unknown or duplicates:
        raise SystemExit(
            f"export_commands: GROUPS must list every command once "
            f"(missing {missing}, unknown {unknown}, duplicated {duplicates})"
        )
    groups = [
        {"id": gid, "title": title, "commands": [_entry(by_name[name]) for name in names]}
        for gid, title, names in GROUPS
    ]
    return {"source": "reconix/commands/builtin.py", "count": len(COMMANDS), "groups": groups}


def render(data: Dict[str, object]) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(render(build()), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
