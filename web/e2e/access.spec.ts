/* Access control: sign-in, the viewer role on every page and route, Host checks, headers. */
import { expect, test } from "@playwright/test";

import { PORT } from "../playwright.config";
import { sample, signIn } from "./support";

test("pages and routes need a session", async ({ page, request }) => {
  await page.goto("/findings");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Open your sign-in link")).toBeVisible();

  const api = await request.get(`/api/assessments/${sample()[0].uid}`);
  expect(api.status()).toBe(401);
});

test("a wrong token does not sign in", async ({ page }) => {
  await page.goto("/login#token=not-the-right-token-123");
  await expect(page.getByText("That sign-in link has expired")).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("the token is removed from the address bar after sign-in", async ({ page }) => {
  await signIn(page);
  expect(page.url()).not.toContain("token");
  const cookie = (await page.context().cookies()).find((c) => c.name === "reconix_view");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  expect(cookie?.value.startsWith("viewer.")).toBe(true);
});

test("a forged cookie is refused", async ({ page, context }) => {
  await context.addCookies([{ name: "reconix_view", value: "viewer.forged", domain: "127.0.0.1", path: "/" }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("other Host headers are refused", async ({ playwright }) => {
  const api = await playwright.request.newContext({
    baseURL: `http://127.0.0.1:${PORT}`,
    extraHTTPHeaders: { Host: `evil.example.com:${PORT}` },
  });
  expect((await api.get("/login")).status()).toBe(403);
  await api.dispose();
});

test("sign-in only accepts requests from the dashboard's own origin", async ({ request }) => {
  const res = await request.post("/api/session", {
    data: { token: "x" },
    headers: { Origin: "http://evil.example.com" },
  });
  expect(res.status()).toBe(403);
});

test("pages send a nonce-based CSP and hardening headers", async ({ page }) => {
  await signIn(page);
  const res = await page.goto("/");
  const headers = res!.headers();
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("a signed-in viewer can download an assessment as JSON", async ({ page }) => {
  await signIn(page);
  const uid = sample()[0].uid;
  const res = await page.request.get(`/api/assessments/${uid}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain(`${uid}.json`);
  expect((await res.json()).uid).toBe(uid);
  expect((await page.request.get("/api/assessments/..%2F..%2Fetc%2Fpasswd")).status()).toBe(404);
});
