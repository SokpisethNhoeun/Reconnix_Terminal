/* Access control: sign-in (no roles: signed in, everything opens), the terminal's own locks,
   Host checks, headers. */
import { expect, test } from "./fixtures";

import { sessionValue } from "../src/lib/auth/session";
import { LIVE_PORT, PORT, TOKEN } from "../playwright.config";
import { sample, signInFresh } from "./support";

// every test here starts with no cookies at all (the others start signed in)
test.use({ storageState: { cookies: [], origins: [] } });

test("pages and routes need a session", async ({ page, request }) => {
  await page.goto("/docs");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Open your sign-in link")).toBeVisible();

  const api = await request.get(`/api/assessments/${sample()[0].uid}`);
  expect(api.status()).toBe(401);
});

test("the combined report needs a session, and a session can read it", async ({ context, request }) => {
  const url = `/api/reports/combined?uids=${sample()[0].uid}&format=preview&evidence=1&low=1&appendix=1`;
  const none = await request.get(url);
  expect(none.status()).toBe(401);
  await context.addCookies([{ name: "reconix_view", value: sessionValue(TOKEN), domain: "127.0.0.1", path: "/" }]);
  const ok = await context.request.get(url);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toContain("text/html");
  expect(await ok.text()).toContain("Combined security assessment report");
  // the query is validated before anything is read: more than five runs, and unknown runs, are refused
  const six = sample().slice(0, 6).map((a) => a.uid).join(",");
  expect((await context.request.get(`/api/reports/combined?uids=${six}&format=preview`)).status()).toBe(400);
  expect((await context.request.get("/api/reports/combined?uids=20200101-000000-dead_NOPE-1&format=preview")).status()).toBe(404);
});

test("the terminal needs a session too", async ({ page, request }) => {
  const res = await request.post("/api/terminal/ticket", { headers: { Origin: `http://127.0.0.1:${PORT}` } });
  expect(res.status()).toBe(401);
  await page.goto("/terminal");
  await expect(page).toHaveURL(/\/login$/);
});

test("an old role-prefixed cookie no longer signs you in", async ({ page, context }) => {
  for (const role of ["viewer", "operator"]) {
    await context.addCookies([{ name: "reconix_view", value: `${role}.${sessionValue(TOKEN)}`, domain: "127.0.0.1", path: "/" }]);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get(`/api/assessments/${sample()[0].uid}`)).status()).toBe(401);
    expect((await page.request.get("/api/assistant/models")).status()).toBe(401);
  }
});

test("signed in, the assistant, Security knowledge and the terminal ticket open", async ({ page }) => {
  await signInFresh(page);
  const origin = { Origin: `http://127.0.0.1:${PORT}` };
  expect((await page.request.get("/api/assistant/models")).status()).toBe(200);
  expect((await page.request.get("/api/assistant/conversations")).status()).toBe(200);
  expect((await page.request.get("/api/knowledge")).status()).toBe(200);
  const ticket = await page.request.post("/api/terminal/ticket", { headers: origin }); // the key cookie rides along
  expect(ticket.status()).toBe(200);
  expect(typeof (await ticket.json()).ticket).toBe("string");
  await page.goto("/?view=knowledge");
  await expect(page.getByRole("heading", { name: "Security knowledge", level: 1 })).toBeVisible();
});

test("a copied session cookie alone can't get a terminal ticket", async ({ page, context }) => {
  await context.addCookies([{ name: "reconix_view", value: sessionValue(TOKEN), domain: "127.0.0.1", path: "/" }]);
  await page.goto("/");
  const res = await page.request.post("/api/terminal/ticket", { headers: { Origin: `http://127.0.0.1:${PORT}` } });
  expect(res.status()).toBe(403);
  expect((await res.json()).detail).toContain("terminal's key");
});

test("with the terminal off, the Terminal view says so and its routes stay shut", async ({ page, context }) => {
  // the live-refresh dashboard runs with --no-terminal and the same launch token
  const off = `http://127.0.0.1:${LIVE_PORT}`;
  await context.addCookies([{ name: "reconix_view", value: sessionValue(TOKEN), domain: "127.0.0.1", path: "/" }]);
  await page.goto(`${off}/?view=terminal`);
  await expect(page.getByRole("heading", { name: "The terminal is off" })).toBeVisible();
  await expect(page.locator(".xterm")).toHaveCount(0);
  const res = await page.request.post(`${off}/api/terminal/ticket`, { headers: { Origin: off } });
  expect(res.status()).toBe(403);
  expect((await res.json()).detail).toContain("--no-terminal");
  await page.goto(`${off}/terminal`);
  await expect(page).toHaveURL(`${off}/`);
  expect((await page.request.get(`${off}/api/knowledge`)).status()).toBe(200); // everything else stays open
});

test("a wrong token does not sign in", async ({ page }) => {
  await page.goto("/login#token=not-the-right-token-123");
  await expect(page.getByText("That sign-in link has expired")).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("the token is removed from the address bar after sign-in", async ({ page }) => {
  await signInFresh(page);
  expect(page.url()).not.toContain("token");
  const cookie = (await page.context().cookies()).find((c) => c.name === "reconix_view");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  expect(cookie?.value).toMatch(/^\d+\.[\w-]+$/); // "<issued>.<signature>": no role
  const key = (await page.context().cookies()).find((c) => c.name === "reconix_term");
  expect(key?.path).toBe("/api/terminal"); // never sent to other paths, servers or the socket
  expect(key?.httpOnly).toBe(true);
  expect(key?.sameSite).toBe("Strict");
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
  await signInFresh(page);
  const res = await page.goto("/");
  const headers = res!.headers();
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("a signed-in user can download an assessment as JSON", async ({ page }) => {
  await signInFresh(page);
  const uid = sample()[0].uid;
  const res = await page.request.get(`/api/assessments/${uid}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain(`${uid}.json`);
  expect((await res.json()).uid).toBe(uid);
  expect((await page.request.get("/api/assessments/..%2F..%2Fetc%2Fpasswd")).status()).toBe(404);
});
