/* The data loader's and the Terminal page's own session checks (behind the proxy). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sessionValue } from "@/lib/auth/session";

const TOKEN = "guard-token-0123456789abcdef";
let cookie: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookie === undefined ? undefined : { value: cookie }) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

const { requireSignedIn, requireTerminalAccess, signedIn, terminalAccess } = await import("@/lib/auth/guard");

beforeEach(() => {
  process.env.RECONIX_WEB_TOKEN = TOKEN;
});
afterEach(() => {
  delete process.env.RECONIX_WEB_TOKEN;
  delete process.env.RECONIX_WEB_TERMINAL;
  cookie = undefined;
});

describe("requireSignedIn", () => {
  it("lets a session through", async () => {
    cookie = sessionValue(TOKEN);
    expect(await signedIn()).toBe(true);
    await expect(requireSignedIn()).resolves.toBeUndefined();
  });

  it.each([undefined, "1.forged", "viewer.1.forged"])("sends %s to sign-in", async (value) => {
    cookie = value;
    expect(await signedIn()).toBe(false);
    await expect(requireSignedIn()).rejects.toThrow("redirect:/login");
  });

  it("sends an old role-prefixed cookie to sign-in", async () => {
    cookie = `operator.${sessionValue(TOKEN)}`;
    await expect(requireSignedIn()).rejects.toThrow("redirect:/login");
  });

  it("refuses everyone when the dashboard has no launch token", async () => {
    cookie = sessionValue(TOKEN);
    delete process.env.RECONIX_WEB_TOKEN;
    await expect(requireSignedIn()).rejects.toThrow("redirect:/login");
  });
});

describe("requireTerminalAccess", () => {
  beforeEach(() => {
    process.env.RECONIX_WEB_TERMINAL = "1";
  });

  it("lets a session through while the dashboard hosts the terminal", async () => {
    cookie = sessionValue(TOKEN);
    expect(terminalAccess()).toBe("on");
    await expect(requireTerminalAccess()).resolves.toBeUndefined();
  });

  it("sends a visitor without a session to sign-in", async () => {
    await expect(requireTerminalAccess()).rejects.toThrow("redirect:/login");
  });

  it("stays shut when the dashboard was started without the terminal", async () => {
    process.env.RECONIX_WEB_TERMINAL = "0";
    cookie = sessionValue(TOKEN);
    expect(terminalAccess()).toBe("off");
    await expect(requireTerminalAccess()).rejects.toThrow("redirect:/");
  });
});
