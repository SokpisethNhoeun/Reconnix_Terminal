#!/usr/bin/env node
/* Start the dashboard on 127.0.0.1 with a fresh launch token, then print (and open) the
   sign-in link.

     npm start                 # next start  (after npm run build)
     npm run dev               # next dev    (hot reload)
     npm start -- --no-open    # don't open a browser

   Env: RECONIX_WEB_PORT (3100), RECONIX_DATA_DIR (~/.reconix/assessments),
        RECONIX_WEB_TOKEN (only for tests; normally a new random token each start). */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const mode = process.argv[2] === "dev" ? "dev" : "start";
const openBrowser = !process.argv.includes("--no-open");
const port = process.env.RECONIX_WEB_PORT || "3100";
const token = process.env.RECONIX_WEB_TOKEN || randomBytes(24).toString("base64url");
const link = `http://127.0.0.1:${port}/login#token=${token}`;
const dataDir = process.env.RECONIX_DATA_DIR || "~/.reconix/assessments";

const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), mode, "-H", "127.0.0.1", "-p", port], {
  stdio: ["inherit", "pipe", "inherit"],
  env: { ...process.env, RECONIX_WEB_TOKEN: token, RECONIX_WEB_PORT: port },
});

let announced = false;
child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (announced || !/ready/i.test(String(chunk))) return;
  announced = true;
  writeLink();
  process.stdout.write(
    `\n  Reconix analysis dashboard (read-only)\n` +
      `  Data     ${dataDir}\n` +
      `  Sign in  ${link}\n` +
      `  The link changes every time the dashboard starts. Press Ctrl+C to stop.\n` +
      `  From the TUI, run /web to open it.\n\n`,
  );
  if (openBrowser) open(link);
});

/* Drop the sign-in link where the TUI's /web command looks for it (private: 0700/0600),
   and remove it on exit so a stale link is never opened. */
const linkFile = process.env.RECONIX_WEB_URL_FILE || path.join(homedir(), ".reconix", "web.url");

function writeLink() {
  try {
    mkdirSync(path.dirname(linkFile), { recursive: true, mode: 0o700 });
    writeFileSync(linkFile, `${link}\n`, { mode: 0o600 });
  } catch {
    /* best effort: the link is printed above */
  }
}

function removeLink() {
  try {
    rmSync(linkFile, { force: true });
  } catch {
    /* ignore */
  }
}

/* The browser is opened on a private redirect file (folder 0700, file 0600), never on the
   link itself, so the token doesn't show up in other users' view of the process list. */
let redirectDir = "";

function open(url) {
  redirectDir = mkdtempSync(path.join(tmpdir(), "reconix-web-"));
  const file = path.join(redirectDir, "open.html");
  writeFileSync(
    file,
    `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${url}">` +
      `<title>Reconix</title><a href="${url}">Open the Reconix dashboard</a>\n`,
    { mode: 0o600 },
  );
  const [cmd, args] =
    process.platform === "darwin" ? ["open", [file]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", file]] : ["xdg-open", [file]];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  } catch {
    /* no browser available: the link is printed above */
  }
  setTimeout(cleanup, 60_000).unref();
}

function cleanup() {
  if (redirectDir) rmSync(redirectDir, { recursive: true, force: true });
  redirectDir = "";
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  cleanup();
  removeLink();
  process.exit(code ?? 0);
});
