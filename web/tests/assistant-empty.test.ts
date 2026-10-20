/* The page's reading of a reply that ended with nothing (components/assistant/empty-reply.ts):
   the server's "empty answer" error becomes its own friendlier state with Retry, while every other
   failure keeps its detail, and a reply with any text or card is never "empty". */
import { describe, expect, it } from "vitest";

import { EMPTY_ANSWER, EMPTY_REPLY, isEmptyReply } from "@/components/assistant/empty-reply";
import type { Card, ChatMessage } from "@/components/assistant/types";

const reply = (over: Partial<ChatMessage>): ChatMessage => ({ id: "r", role: "assistant", content: "", cards: [], state: "error", ...over });
const findings: Card = { kind: "findings", total: 0, counts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 }, items: [], runs: 0 };

describe("isEmptyReply", () => {
  it("is the server's empty answer, or an error with no detail, when nothing came", () => {
    expect(isEmptyReply(reply({ detail: "The model sent an empty answer." }))).toBe(true);
    expect(isEmptyReply(reply({}))).toBe(true);
    expect(EMPTY_ANSWER.test("The model sent an empty answer.")).toBe(true);
  });
  it("is not any other failure", () => {
    expect(isEmptyReply(reply({ detail: "The AI model answered with HTTP 500." }))).toBe(false);
    expect(isEmptyReply(reply({ detail: "The connection to the assistant broke off." }))).toBe(false);
    expect(isEmptyReply(reply({ detail: "The answer broke off before it ended." }))).toBe(false);
  });
  it("is never a reply that holds text or a card, or one that was stopped or finished", () => {
    expect(isEmptyReply(reply({ content: "Some text", detail: "The model sent an empty answer." }))).toBe(false);
    expect(isEmptyReply(reply({ cards: [findings], detail: "The model sent an empty answer." }))).toBe(false);
    expect(isEmptyReply(reply({ state: "stopped" }))).toBe(false);
    expect(isEmptyReply(reply({ state: undefined }))).toBe(false);
    expect(isEmptyReply(reply({ state: "streaming" }))).toBe(false);
    expect(isEmptyReply({ role: "user", content: "", state: "error" })).toBe(false);
  });
  it("says so plainly, with a way on", () => {
    expect(EMPTY_REPLY.title).toBe("The model returned nothing");
    expect(EMPTY_REPLY.body).toMatch(/try asking again/i);
  });
});
