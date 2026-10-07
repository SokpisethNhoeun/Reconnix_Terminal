/* Terminal tickets: the exact format reconix/webterm/ticket.py checks. */
import { describe, expect, it } from "vitest";

import { TICKET_TTL_SECONDS, helloProof, issueTicket, mintTicket, signTicket } from "@/lib/auth/ticket";
import { proofInHello } from "@/lib/terminal/protocol";

const TOKEN = "vector-token-0123456789abcdef";
const NOW_MS = 1791360000 * 1000;
const NONCE = "bm9uY2Utbm9uY2Utbm9uY2U";
// The same vectors are in tests/test_webterm_ticket.py: both sides must produce these strings.
const VECTOR = "1791360060.bm9uY2Utbm9uY2Utbm9uY2U.767OmcoEmx2ENftC0rHXyqzlEVGSdDVJODGn1iDLw9M";
const HELLO = "hvwDvOUa19VuvfFp7P4PlBO6URixHz8Lt-o_vCOGwek";

describe("mintTicket", () => {
  it("matches the ticket the terminal helper expects", () => {
    expect(mintTicket(TOKEN, NOW_MS, NONCE)).toBe(VECTOR);
  });

  it("lasts a minute", () => {
    const [expires] = mintTicket(TOKEN, NOW_MS, NONCE).split(".");
    expect(Number(expires)).toBe(NOW_MS / 1000 + TICKET_TTL_SECONDS);
    expect(TICKET_TTL_SECONDS).toBe(60);
  });

  it("uses a fresh random nonce each time", () => {
    const a = mintTicket(TOKEN, NOW_MS).split(".")[1];
    const b = mintTicket(TOKEN, NOW_MS).split(".")[1];
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(a).not.toBe(b);
  });

  it("is signed with the launch token", () => {
    expect(signTicket("another-token-0123456789", NOW_MS / 1000 + 60, NONCE)).not.toBe(VECTOR.split(".")[2]);
  });
});

describe("the helper's hello", () => {
  it("matches the proof the terminal helper sends", () => {
    expect(helloProof(TOKEN, NONCE)).toBe(HELLO);
  });

  it("comes with each ticket, for that ticket's nonce", () => {
    const { ticket, proof } = issueTicket(TOKEN);
    expect(proof).toBe(helloProof(TOKEN, ticket.split(".")[1]));
  });

  it("is read only from a hello frame", () => {
    expect(proofInHello(JSON.stringify({ type: "hello", proof: HELLO }))).toBe(HELLO);
    for (const frame of ["", "nope", "{}", JSON.stringify({ type: "resize", proof: HELLO }), JSON.stringify({ type: "hello", proof: 1 }), `{"type":"hello","proof":"${"x".repeat(300)}"}`, new ArrayBuffer(4)]) {
      expect(proofInHello(frame)).toBeNull();
    }
  });
});
