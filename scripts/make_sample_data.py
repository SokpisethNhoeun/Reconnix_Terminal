"""Write realistic sample assessments for the web dashboard (development and tests).

Plays the four templates through the real store (every gate decided through the same
store functions the TUI uses) with a fake clock, so the files look like a week of work:
completed runs with reports, an imported tool file, a run stopped by a rejected HIGH
approval, and one still waiting at a HIGH approval. Only example domains and fake,
masked evidence are used. No secret is written (the store's snapshot leaves them out).

    python scripts/make_sample_data.py [OUT_DIR]      # default: web/sample-data
"""

import json
import os
import random
import re
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from reconix import store  # noqa: E402
from reconix.models import base  # noqa: E402
from reconix.store import lists, report, snapshot  # noqa: E402

FILE_NAME = re.compile(r"^\d{8}-\d{6}-[0-9a-f]{4}_[A-Za-z0-9-]{1,64}\.json$")

NUCLEI = "\n".join(json.dumps(row) for row in [
    {"template-id": "server-version", "matched-at": "https://{host}/",
     "info": {"name": "Web server version disclosed", "severity": "low",
              "description": "The Server header names the web server and its version."},
     "extracted-results": ["Server: nginx/1.18.0"]},
    {"template-id": "api-docs-exposed", "matched-at": "https://{host}/docs",
     "info": {"name": "API documentation exposed", "severity": "medium",
              "description": "Interactive API documentation is reachable without a login."}},
    {"template-id": "missing-hsts", "matched-at": "https://{host}/",
     "info": {"name": "HSTS header missing", "severity": "low"}},
])


# --- a clock that moves a few seconds per reading ----------------------------------------------
class FakeClock(datetime):
    current = datetime(2026, 9, 28, 9, 12, tzinfo=timezone.utc)
    rng = random.Random(7)

    @classmethod
    def now(cls, tz=None):
        cls.current += timedelta(seconds=cls.rng.uniform(2.5, 8.0))
        return cls.current if tz else cls.current.replace(tzinfo=None)

    @classmethod
    def start(cls, moment: datetime) -> None:
        cls.current = moment


base.datetime = FakeClock      # every store timestamp comes from base.utc_now()


# --- playing a run -------------------------------------------------------------------------------
def decide(gate: str, *, high: str, reason: str) -> bool:
    """Decide `gate`. Returns False to leave the run waiting there."""
    if gate == "template":
        store.select_template(store.get_assessment().template_id)
    elif gate == "scope":
        store.approve_scope()
    elif gate == "account":
        values = {}
        for field in store.current_auth_challenge().fields:
            values[field.id] = ("482913" if field.otp
                                else "sample-only-password" if field.secret else "tester.a")
        store.provide_auth(values)
    else:
        request = store.get_approval(gate.split(":", 1)[1])
        if request.risk != "HIGH":
            store.approve(request.request_id, command_hash=request.command_hash)
        elif high == "wait":
            return False
        elif high == "reject":
            store.reject(request.request_id)
        else:
            token = store.request_confirmation(request.request_id, request.command_hash)
            store.approve(request.request_id, command_hash=request.command_hash,
                          confirmation_token=token, phrase=request.phrase, reason=reason)
    return True


def play(text: str, *, high: str = "approve", reason: str = "", fmt: str = "",
         imports: str = "") -> None:
    if store.get_run().started:
        store.new_assessment()
    store.start_run(text)
    while True:
        step = store.advance()
        if step is None:
            break
        if step.kind == "gate" and store.waiting_gate() == step.name:
            if not decide(step.name, high=high, reason=reason):
                break
    if fmt and store.is_completed():
        store.generate_report(fmt)
    if imports:
        path = Path(tempfile.gettempdir()) / "reconix-sample-nuclei.jsonl"
        host = store.get_assessment().target
        path.write_text(imports.replace("{host}", host), encoding="utf-8")
        store.import_findings(str(path))
        path.unlink()


def session(moment: datetime, runs, closed: bool = True) -> list:
    """One TUI session starting at `moment`; returns its saved snapshots.

    `closed` marks the copies the way quitting the TUI does (the latest session stays open).
    """
    FakeClock.start(moment)                # before reset: the fresh assessment is stamped now
    store.reset()
    lists.SESSION_ID = f"{moment:%Y%m%d-%H%M%S}-{random.Random(moment.day).getrandbits(16):04x}"
    for kwargs in runs:
        FakeClock.current += timedelta(minutes=kwargs.pop("gap", 0))
        play(**kwargs)
    out = []
    for assessment in lists.ASSESSMENTS:
        if assessment.run.started:
            data = snapshot.snapshot(assessment, session_closed=closed)
            data["saved_at"] = FakeClock.now(timezone.utc).isoformat(timespec="seconds")
            out.append(data)
    return out


def main() -> None:
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "web" / "sample-data"
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.iterdir():
        if FILE_NAME.match(old.name):
            old.unlink()
    work = Path(tempfile.mkdtemp(prefix="reconix-sample-"))
    os.chdir(work)                         # reports land in ./reports of a scratch folder
    report.REPORTS_DIR = Path("reports")

    utc = timezone.utc
    snapshots = []
    snapshots += session(datetime(2026, 9, 28, 9, 12, tzinfo=utc), [
        dict(text="Review the source repository git@git.example.com:shop/storefront.git "
                  "for security issues.",
             reason="Confirm the leaked credential is live on the test endpoint",
             fmt="markdown"),
    ])
    snapshots += session(datetime(2026, 9, 30, 16, 5, tzinfo=utc), [
        dict(text="Test the REST API at https://api.example.com/v1 for security issues.",
             reason="Check if token A can read token B's order", fmt="markdown"),
    ])
    snapshots += session(datetime(2026, 10, 3, 10, 15, tzinfo=utc), [
        dict(text="Scan the network host 192.0.2.10 for exposed services.",
             reason="One probe to confirm the console needs a login", fmt="json"),
        dict(text="Test the REST API at https://api.example.com/v1 for security issues.",
             high="reject", imports=NUCLEI, gap=12),
    ])
    snapshots += session(datetime(2026, 10, 5, 14, 3, tzinfo=utc), [
        dict(text="Assess https://staging.example.com for web security issues.",
             reason="Confirm finding F-001 before the report", fmt="markdown",
             imports=NUCLEI.split("\n")[0]),
        dict(text="Review the source repository git@git.example.com:shop/storefront.git "
                  "for security issues.", high="wait", gap=6),
    ], closed=False)

    for data in snapshots:
        path = out_dir / f"{data['uid']}.json"
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{path.name}: {data['status']}, {len(data['findings'])} findings")
    print(f"{len(snapshots)} assessments written to {out_dir}")


if __name__ == "__main__":
    main()
