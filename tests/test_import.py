"""Importing real tool output (nuclei JSONL, nmap XML, ZAP JSON) into findings."""

import json

import pytest

from reconix import store
from reconix.store import importers

NUCLEI = "\n".join(json.dumps(r) for r in [
    {"template-id": "tomcat-manager", "matched-at": "https://staging.example.com:8443/manager",
     "info": {"name": "Tomcat Manager exposed", "severity": "high",
              "description": "Manager console reachable.", "reference": ["https://ref.example"]},
     "extracted-results": ["realm=Tomcat Manager"]},
    {"template-id": "missing-hsts", "matched-at": "https://staging.example.com/",
     "info": {"name": "HSTS header missing", "severity": "low"}},
])

NMAP = """<?xml version="1.0"?><nmaprun><host>
<address addr="10.0.0.5" addrtype="ipv4"/>
<ports>

 <port protocol="tcp" portid="22"><state state="open"/>
   <service name="ssh" product="OpenSSH" version="8.2"/></port>
 <port protocol="tcp" portid="23"><state state="open"/><service name="telnet"/></port>
 <port protocol="tcp" portid="81"><state state="closed"/></port>
</ports></host></nmaprun>"""

ZAP = json.dumps({"@programName": "ZAP", "site": [{"@name": "https://staging.example.com",
    "alerts": [
        {"name": "SQL Injection", "riskdesc": "High (Medium)", "desc": "<p>Injectable.</p>",
         "solution": "<p>Use parameters.</p>", "cweid": "89",
         "instances": [{"method": "GET", "uri": "https://staging.example.com/product?id=1"}]},
        {"name": "X-Frame-Options missing", "riskdesc": "Low", "desc": "No XFO.",
         "cweid": "-1", "instances": [{"method": "GET", "uri": "https://staging.example.com/"}]},
    ]}]})


@pytest.mark.parametrize("text, tool, n, top", [
    (NUCLEI, "nuclei", 2, "HIGH"),
    (NMAP, "nmap", 2, "MEDIUM"),       # telnet (23) ranks as MEDIUM, above ssh INFO
    (ZAP, "zap", 2, "HIGH"),
])
def test_each_format_parses(text, tool, n, top):
    assert importers.detect(text) == tool
    found = importers.parse(text, tool)
    assert len(found) == n
    assert any(f.severity == top for f in found)
    for f in found:
        assert "(imported)" in f.tool


def test_unknown_format_is_rejected():
    with pytest.raises(store.StoreValidationError):
        importers.detect("just some text")


def test_import_adds_findings_to_the_current_assessment(tmp_path):
    path = tmp_path / "nuclei.jsonl"
    path.write_text(NUCLEI)
    before = len(store.list_findings())
    tool, count = store.import_findings(str(path))
    assert (tool, count) == ("nuclei", 2)
    findings = store.list_findings()
    assert len(findings) == before + 2
    assert any(f.fid.startswith("IMP-") for f in findings)   # shown immediately
    assert "findings.imported" in [e.kind for e in store.list_events()]


def test_import_rejects_a_missing_or_huge_file(tmp_path):
    with pytest.raises(store.StoreValidationError):
        store.import_findings(str(tmp_path / "nope.json"))
    big = tmp_path / "big.xml"
    big.write_text("<nmaprun>" + "x" * 5_000_001)
    with pytest.raises(store.StoreValidationError):
        store.import_findings(str(big))


def test_import_masks_overlong_evidence(tmp_path):
    row = {"template-id": "t", "matched-at": "https://staging.example.com/x",
           "info": {"name": "n", "severity": "info"}, "extracted-results": ["A" * 500]}
    path = tmp_path / "n.jsonl"
    path.write_text(json.dumps(row))
    store.import_findings(str(path))
    imported = [f for f in store.list_findings() if f.fid.startswith("IMP-")][-1]
    assert all(len(line) <= 200 for line in imported.evidence)
