/* Single-use tickets: an operator's permission to open one terminal session.

     <expires>.<nonce>.<base64url(HMAC-SHA256(launch token, "reconix-term:<expires>:<nonce>"))>

   `expires` is in Unix seconds, TICKET_TTL_SECONDS from now. The terminal helper
   (reconix/webterm/ticket.py) checks the signature with the same launch token, the expiry,
   and that the nonce is used once. It then proves it is the real helper (not something
   else on its port) by sending helloProof(nonce) first; the page gets the same value with
   the ticket and sends nothing until it matches. Change both files together; their tests
   share vectors. */
import "server-only";

import { createHmac, randomBytes } from "node:crypto";

export const TICKET_TTL_SECONDS = 60;

const mac = (token: string, text: string) => createHmac("sha256", token).update(text).digest("base64url");

export function signTicket(token: string, expires: number, nonce: string): string {
  return mac(token, `reconix-term:${expires}:${nonce}`);
}

/** What the helper sends first on the session opened with the ticket that has `nonce`. */
export function helloProof(token: string, nonce: string): string {
  return mac(token, `reconix-term-hello:${nonce}`);
}

/** A new ticket, valid for TICKET_TTL_SECONDS from `now` (ms). */
export function mintTicket(token: string, now: number = Date.now(), nonce: string = randomBytes(16).toString("base64url")): string {
  const expires = Math.floor(now / 1000) + TICKET_TTL_SECONDS;
  return `${expires}.${nonce}.${signTicket(token, expires, nonce)}`;
}

/** A ticket and the hello that proves the helper is real, for the Terminal page. */
export function issueTicket(token: string, now: number = Date.now()): { ticket: string; proof: string } {
  const ticket = mintTicket(token, now);
  return { ticket, proof: helloProof(token, ticket.split(".")[1]) };
}
