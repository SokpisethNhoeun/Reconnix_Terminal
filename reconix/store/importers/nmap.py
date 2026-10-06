"""Parse nmap XML output (-oX) into findings — one per open port/service."""

import re
from typing import List
from xml.etree import ElementTree

from ...models import Finding
from ..errors import StoreValidationError
from .common import dedupe, finding

_DTD = re.compile(r"<!DOCTYPE|<!ENTITY", re.IGNORECASE)

RISKY_PORTS = {21: "LOW", 23: "MEDIUM", 3389: "LOW", 3306: "LOW", 5432: "LOW", 445: "MEDIUM"}


def parse(text: str) -> List[Finding]:
    if _DTD.search(text):
        # A DTD/entity declaration can expand to gigabytes (billion laughs); refuse it.
        raise StoreValidationError("The XML declares a DTD or entities, which aren't allowed.")
    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError:
        raise StoreValidationError("Could not read the nmap XML output.") from None
    findings, i = [], 0
    for host in root.findall("host"):
        address = _address(host)
        for port in host.findall("./ports/port"):
            state = port.find("state")
            if state is None or state.get("state") != "open":
                continue
            i += 1
            portid = port.get("portid", "?")
            proto = port.get("protocol", "tcp")
            service = port.find("service")
            name = service.get("name", "unknown") if service is not None else "unknown"
            product = (service.get("product", "") + " " + service.get("version", "")).strip() \
                if service is not None else ""
            sev = RISKY_PORTS.get(_int(portid), "INFO")
            findings.append(finding(
                i, sev, f"Open port {portid}/{proto} · {name}",
                f"{address}:{portid}", f"{address}:{portid}",
                f"nmap reported {portid}/{proto} open running {name}"
                + (f" ({product})" if product else "") + ".",
                "nmap",
                impact="An exposed service widens the attack surface; confirm it is intended.",
                remediation="Close the port or restrict it to the networks that need it.",
                evidence=[f"{portid}/{proto} open {name} {product}".strip()],
            ))
    if not findings:
        raise StoreValidationError("No open ports found in the nmap output.")
    return dedupe(findings)


def _address(host) -> str:
    for addr in host.findall("address"):
        if addr.get("addrtype") in ("ipv4", "ipv6"):
            return addr.get("addr", "host")
    addr = host.find("address")
    return addr.get("addr", "host") if addr is not None else "host"


def _int(value: str) -> int:
    try:
        return int(value)
    except ValueError:
        return -1
