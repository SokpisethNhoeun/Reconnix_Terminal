/* End-to-end tests: start the built dashboard on the sample data and drive it in Chromium.
   Run `npm run build` first. Uses Playwright's Chromium (`npx playwright install chromium`)
   or the browser at CHROMIUM_PATH. The terminal helper runs a stand-in instead of the TUI:
   it prints READY and echoes what is typed (needs the repo's Python with websockets). */
import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";

// E2E_PORT moves the three test ports together, so several checkouts can test at once.
export const PORT = Number(process.env.E2E_PORT || 3199);
export const TOKEN = "e2e-token-0123456789abcdef";
export const TERM_PORT = PORT - 1;
export const LLM_PORT = PORT - 4; // e2e/llm-stub.mjs, the AI Assistant's stand-in model

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: "node e2e/llm-stub.mjs",
      url: `http://127.0.0.1:${LLM_PORT}/`,
      env: { LLM_STUB_PORT: String(LLM_PORT) },
      reuseExistingServer: false,
    },
    {
      command: "node scripts/serve.mjs start --no-open",
      url: `http://127.0.0.1:${PORT}/login`,
      env: {
        RECONIX_WEB_PORT: String(PORT),
        RECONIX_WEB_TOKEN: TOKEN,
        RECONIX_DATA_DIR: "sample-data",
        // the sample files are old: keep their waiting run waiting instead of reading it as stale
        RECONIX_STALE_AFTER_HOURS: "0",
        // no 10 s self-refresh under a test (a spec that wants it sets its own server)
        RECONIX_LIVE_REFRESH_MS: "0",
        RECONIX_TERM_PORT: String(TERM_PORT),
        RECONIX_TERM_TEST: "1",
        RECONIX_TERM_COMMAND: "sh -c 'echo READY; exec cat'",
        // keep the test server's sign-in link out of ~/.reconix/web.url (a running dashboard's)
        RECONIX_WEB_URL_FILE: path.join(tmpdir(), `reconix-e2e-${PORT}.url`),
        // the AI Assistant's saved conversations go to a test folder, never ~/.reconix/assistant
        RECONIX_ASSISTANT_DIR: path.join(tmpdir(), `reconix-e2e-assistant-${PORT}`),
        // the specs ask more than the default 12 questions a minute
        RECONIX_ASSISTANT_RATE_PER_MINUTE: "120",
        // the AI Assistant asks the stand-in, never a real model (these override web/.env.local)
        LLM_BASE_URL: `http://127.0.0.1:${LLM_PORT}/v1`,
        LLM_MODEL: "stub-model",
        LLM_API_KEY: "",
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
