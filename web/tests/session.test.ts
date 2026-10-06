/* The launch token, the signed viewer cookie and the Host allowlist. */
import { afterEach, describe, expect, it } from "vitest";

import { allowedHosts, hasRole, launchToken, readRole, sessionValue, tokenMatches } from "@/lib/auth/session";

const TOKEN = "unit-token-0123456789abcdef";
const env = { ...process.env };

afterEach(() => {
  process.env = { ...env };
});

describe("session cookie", () => {
  it("round-trips the viewer role", () => {
    expect(readRole(sessionValue("viewer", TOKEN), TOKEN)).toBe("viewer");
  });

  it.each([
    undefined,
    "",
    "viewer",
    "viewer.",
    "viewer.forged",
    "viewer.123.forged",
    "admin.whatever",
    `.${sessionValue("viewer", TOKEN).split(".").slice(1).join(".")}`,
    `${sessionValue("viewer", TOKEN)}.extra`,
  ])("refuses %s", (value) => {
    expect(readRole(value, TOKEN)).toBeNull();
  });

  it("expires on the server after 12 hours, whatever the browser keeps", () => {
    const issued = Date.parse("2026-10-05T08:00:00Z");
    const value = sessionValue("viewer", TOKEN, issued);
    expect(readRole(value, TOKEN, issued + 11 * 3_600_000)).toBe("viewer");
    expect(readRole(value, TOKEN, issued + 13 * 3_600_000)).toBeNull();
  });

  it("can't be re-dated without the token", () => {
    const [role, , signature] = sessionValue("viewer", TOKEN, Date.parse("2026-10-01T00:00:00Z")).split(".");
    const later = Math.floor(Date.now() / 1000);
    expect(readRole(`${role}.${later}.${signature}`, TOKEN)).toBeNull();
  });

  it("stops working when the dashboard restarts with a new token", () => {
    expect(readRole(sessionValue("viewer", TOKEN), "another-token-0123456789")).toBeNull();
  });

  it("checks roles", () => {
    expect(hasRole("viewer", "viewer")).toBe(true);
    expect(hasRole(null, "viewer")).toBe(false);
  });
});

describe("launch token", () => {
  it("must be set and long enough", () => {
    delete process.env.RECONIX_WEB_TOKEN;
    expect(launchToken()).toBeNull();
    process.env.RECONIX_WEB_TOKEN = "short";
    expect(launchToken()).toBeNull();
    process.env.RECONIX_WEB_TOKEN = TOKEN;
    expect(launchToken()).toBe(TOKEN);
  });

  it("compares exactly", () => {
    expect(tokenMatches(TOKEN, TOKEN)).toBe(true);
    expect(tokenMatches(`${TOKEN}x`, TOKEN)).toBe(false);
    expect(tokenMatches("", TOKEN)).toBe(false);
  });
});

describe("hosts", () => {
  it("only answers on loopback names with the configured port", () => {
    process.env.RECONIX_WEB_PORT = "4321";
    expect(allowedHosts()).toEqual(["127.0.0.1:4321", "localhost:4321"]);
  });
});
