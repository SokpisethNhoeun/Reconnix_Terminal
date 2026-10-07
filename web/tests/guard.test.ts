/* The data loader's and the Terminal page's own role checks (behind the proxy). */
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

const { requireTerminalAccess, requireViewer } = await import("@/lib/auth/guard");

beforeEach(() => {
  process.env.RECONIX_WEB_TOKEN = TOKEN;
});
afterEach(() => {
  delete process.env.RECONIX_WEB_TOKEN;
  delete process.env.RECONIX_WEB_TERMINAL;
  cookie = undefined;
});

describe("requireViewer", () => {
  it("lets a signed-in viewer through", async () => {
    cookie = sessionValue("viewer", TOKEN);
    await expect(requireViewer()).resolves.toBeUndefined();
  });

  it.each([undefined, "viewer.1.forged"])("sends %s to sign-in", async (value) => {
    cookie = value;
    await expect(requireViewer()).rejects.toThrow("redirect:/login");
  });

  it("refuses everyone when the dashboard has no launch token", async () => {
    cookie = sessionValue("viewer", TOKEN);
    delete process.env.RECONIX_WEB_TOKEN;
    await expect(requireViewer()).rejects.toThrow("redirect:/login");
  });
});

describe("requireTerminalAccess", () => {
  beforeEach(() => {
    process.env.RECONIX_WEB_TERMINAL = "1";
  });

  it("lets an operator through", async () => {
    cookie = sessionValue("operator", TOKEN);
    await expect(requireTerminalAccess()).resolves.toBeUndefined();
  });

  it("sends a viewer back to the overview", async () => {
    cookie = sessionValue("viewer", TOKEN);
    await expect(requireTerminalAccess()).rejects.toThrow("redirect:/");
  });

  it("sends a visitor without a session to sign-in", async () => {
    await expect(requireTerminalAccess()).rejects.toThrow("redirect:/login");
  });

  it("stays shut when the dashboard was started without the terminal", async () => {
    process.env.RECONIX_WEB_TERMINAL = "0";
    cookie = sessionValue("operator", TOKEN);
    await expect(requireTerminalAccess()).rejects.toThrow("redirect:/");
  });
});
