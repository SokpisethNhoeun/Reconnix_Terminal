/* End-to-end tests: start the built dashboard on the sample data and drive it in Chromium.
   Run `npm run build` first. Uses Playwright's Chromium (`npx playwright install chromium`)
   or the browser at CHROMIUM_PATH. */
import { defineConfig, devices } from "@playwright/test";

export const PORT = 3199;
export const TOKEN = "e2e-token-0123456789abcdef";

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: "node scripts/serve.mjs start --no-open",
    url: `http://127.0.0.1:${PORT}/login`,
    env: { RECONIX_WEB_PORT: String(PORT), RECONIX_WEB_TOKEN: TOKEN, RECONIX_DATA_DIR: "sample-data" },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
