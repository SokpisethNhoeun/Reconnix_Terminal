/* The launch token, the signed role cookie, the Host allowlist and the terminal's roles. */
import { afterEach, describe, expect, it } from "vitest";

import { isSameOrigin } from "@/lib/auth/origin";
import {
  allowedHosts,
  hasRole,
  launchToken,
  mayUseTerminal,
  readRole,
  readTerminalKey,
  sessionValue,
  signInRole,
  terminalKeyValue,
  tokenMatches,
} from "@/lib/auth/session";

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

  it("round-trips the operator role, which can't be forged from a viewer cookie", () => {
    expect(readRole(sessionValue("operator", TOKEN), TOKEN)).toBe("operator");
    const [, issued, signature] = sessionValue("viewer", TOKEN).split(".");
    expect(readRole(`operator.${issued}.${signature}`, TOKEN)).toBeNull();
  });

  it("checks roles, weakest first", () => {
    expect(hasRole("viewer", "viewer")).toBe(true);
    expect(hasRole("operator", "viewer")).toBe(true);
    expect(hasRole("viewer", "operator")).toBe(false);
    expect(hasRole(null, "viewer")).toBe(false);
  });
});

describe("terminal roles", () => {
  it("signs in as operator only while the dashboard hosts the terminal", () => {
    process.env.RECONIX_WEB_TERMINAL = "1";
    expect(signInRole()).toBe("operator");
    process.env.RECONIX_WEB_TERMINAL = "0";
    expect(signInRole()).toBe("viewer");
    delete process.env.RECONIX_WEB_TERMINAL;
    expect(signInRole()).toBe("viewer");
  });

  it("opens the terminal to operators, and only while it is on", () => {
    process.env.RECONIX_WEB_TERMINAL = "1";
    expect(mayUseTerminal("operator")).toBe(true);
    expect(mayUseTerminal("viewer")).toBe(false);
    expect(mayUseTerminal(null)).toBe(false);
    process.env.RECONIX_WEB_TERMINAL = "0";
    expect(mayUseTerminal("operator")).toBe(false);
  });
});

describe("terminal key", () => {
  it("round-trips, and stops working with a new token or after 12 hours", () => {
    const issued = Date.parse("2026-10-05T08:00:00Z");
    const key = terminalKeyValue(TOKEN, issued);
    expect(readTerminalKey(key, TOKEN, issued)).toBe(true);
    expect(readTerminalKey(key, "another-token-0123456789", issued)).toBe(false);
    expect(readTerminalKey(key, TOKEN, issued + 13 * 3_600_000)).toBe(false);
  });

  it("can't be made from a session cookie", () => {
    const [, issued, signature] = sessionValue("operator", TOKEN).split(".");
    expect(readTerminalKey(`${issued}.${signature}`, TOKEN)).toBe(false);
    expect(readTerminalKey(sessionValue("operator", TOKEN), TOKEN)).toBe(false);
  });

  it.each([undefined, "", "123", "123.", "abc.def", "1.2.3"])("refuses %s", (value) => {
    expect(readTerminalKey(value, TOKEN)).toBe(false);
  });
});

describe("same-origin requests", () => {
  const request = (headers: Record<string, string>) => new Request("http://127.0.0.1:3100/api/x", { method: "POST", headers });

  it("need an Origin that matches the Host", () => {
    expect(isSameOrigin(request({ origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100" }))).toBe(true);
    expect(isSameOrigin(request({ origin: "http://evil.example.com", host: "127.0.0.1:3100" }))).toBe(false);
    expect(isSameOrigin(request({ origin: "http://127.0.0.1:3101", host: "127.0.0.1:3100" }))).toBe(false);
    expect(isSameOrigin(request({ host: "127.0.0.1:3100" }))).toBe(false);
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
