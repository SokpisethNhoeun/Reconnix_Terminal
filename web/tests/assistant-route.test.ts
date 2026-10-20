/* The assistant route's own locks, called directly (the e2e tests go through the proxy too):
   the page's origin, the operator role, a configured model, and that a request's shape is
   checked before anything is read. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COOKIE, sessionValue } from "@/lib/auth/session";

const TOKEN = "route-test-token-0123456789";
let cookie = "";
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (name === COOKIE && cookie ? { value: cookie } : undefined) }) }));
vi.mock("next/server", async (load) => ({ ...(await load<typeof import("next/server")>()), connection: async () => undefined }));
vi.mock("@/lib/auth/guard", () => ({ requireViewer: async () => undefined }));

const { POST } = await import("@/app/api/assistant/route");

const saved = { ...process.env };
beforeEach(() => {
  process.env.RECONIX_WEB_TOKEN = TOKEN;
  process.env.LLM_BASE_URL = "http://127.0.0.1:9/v1"; // nothing listens: no test reaches a model
  process.env.LLM_MODEL = "test-model";
  cookie = sessionValue("operator", TOKEN);
});
afterEach(() => {
  process.env = { ...saved };
});

const ask = (body: unknown, origin = "http://127.0.0.1:3100") =>
  POST(new Request("http://127.0.0.1:3100/api/assistant", { method: "POST", headers: { host: "127.0.0.1:3100", origin, "content-type": "application/json" }, body: JSON.stringify(body) }));
const question = { uid: null, messages: [{ role: "user", content: "What waits on me?" }] };

describe("POST /api/assistant", () => {
  it("refuses a viewer", async () => {
    cookie = sessionValue("viewer", TOKEN);
    expect((await ask(question)).status).toBe(403);
  });
  it("refuses another origin and a missing session", async () => {
    expect((await ask(question, "http://evil.example")).status).toBe(403);
    cookie = "";
    expect((await ask(question)).status).toBe(403);
  });
  it("says when no model is set up", async () => {
    delete process.env.LLM_BASE_URL;
    const res = await ask(question);
    expect(res.status).toBe(503);
    expect((await res.json()).detail).toContain("LLM_BASE_URL");
  });
  it("checks the request before reading any data", async () => {
    expect((await ask({ ...question, messages: [] })).status).toBe(400);
    expect((await ask({ ...question, uid: "../../etc" })).status).toBe(400);
    const big = { uid: null, messages: [{ role: "user", content: "x".repeat(3_000) }], pad: "y".repeat(300_000) };
    expect((await ask(big)).status).toBe(413);
  });
  it("reports a model it cannot reach without saying where", async () => {
    process.env.RECONIX_DATA_DIR = "sample-data";
    const res = await ask(question);
    expect(res.status).toBe(502);
    const detail = (await res.json()).detail as string;
    expect(detail).toContain("Could not reach the AI model");
    expect(detail).not.toContain("127.0.0.1:9");
  });
});
