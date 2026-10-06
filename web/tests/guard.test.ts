/* The data loader's own role check (behind the proxy). */
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

const { requireViewer } = await import("@/lib/auth/guard");

beforeEach(() => {
  process.env.RECONIX_WEB_TOKEN = TOKEN;
});
afterEach(() => {
  delete process.env.RECONIX_WEB_TOKEN;
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
