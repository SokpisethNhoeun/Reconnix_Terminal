/* Shared e2e helpers: sign in, and the expected numbers read straight from the sample files. */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Page } from "@playwright/test";

import { TOKEN } from "../playwright.config";

export async function signIn(page: Page, token = TOKEN) {
  await page.goto(`/login#token=${token}`);
  await page.waitForURL((url) => url.pathname === "/");
}

interface SampleAssessment {
  uid: string;
  label: string;
  status: string;
  findings: { severity: string; validation: string; title: string }[];
  verdicts: { allowed: boolean }[];
}

export function sample(): SampleAssessment[] {
  const dir = path.join(__dirname, "..", "sample-data");
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .map((n) => JSON.parse(readFileSync(path.join(dir, n), "utf8")) as SampleAssessment);
}
