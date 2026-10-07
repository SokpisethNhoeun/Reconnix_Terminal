#!/usr/bin/env node
/* Start the dashboard on 127.0.0.1 with a fresh launch token, then print (and open) the
   sign-in link. Next to it, start the terminal helper (python -m reconix.webterm) that
   the Terminal page talks to.

     npm start                     # next start  (after npm run build)
     npm run dev                   # next dev    (hot reload)
     npm start -- --no-open        # don't open a browser
     npm start -- --no-terminal    # no Terminal page: the dashboard only reads

   Env: RECONIX_WEB_PORT (3100), RECONIX_TERM_PORT (3101), RECONIX_DATA_DIR
        (~/.reconix/assessments), RECONIX_PYTHON (the repo's .venv, else python3; python on
        Windows),
        RECONIX_WEB_TOKEN (only for tests; normally a new random token each start). */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const mode = process.argv[2] === "dev" ? "dev" : "start";
const openBrowser = !process.argv.includes("--no-open");
const terminal = !process.argv.includes("--no-terminal");
const port = process.env.RECONIX_WEB_PORT || "3100";
const termPort = process.env.RECONIX_TERM_PORT || "3101";
const token = process.env.RECONIX_WEB_TOKEN || randomBytes(24).toString("base64url");
const link = `http://127.0.0.1:${port}/login#token=${token}`;
const dataDir = process.env.RECONIX_DATA_DIR || "~/.reconix/assessments";
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const helper = terminal ? startTerminal() : null;

const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), mode, "-H", "127.0.0.1", "-p", port], {
  stdio: ["inherit", "pipe", "inherit"],
  env: {
    ...process.env,
    RECONIX_WEB_TOKEN: token,
    RECONIX_WEB_PORT: port,
    RECONIX_WEB_TERMINAL: terminal ? "1" : "0",
    RECONIX_TERM_PORT: termPort,
  },
});

/* The terminal helper runs from the repo root (so `reconix` imports without an install)
   with the same token, which signs the Terminal page's tickets. It keeps reading its stdin
   and stops when that closes, so it never outlives this launcher. If it can't start, the
   dashboard still runs; the Terminal page says it can't connect. */
function startTerminal() {
  const windows = process.platform === "win32";
  const venv = path.join(repoRoot, ".venv", windows ? "Scripts/python.exe" : "bin/python");
  const python = process.env.RECONIX_PYTHON || (existsSync(venv) ? venv : windows ? "python" : "python3");
  const proc = spawn(python, ["-m", "reconix.webterm"], {
    cwd: repoRoot,
    stdio: ["pipe", "inherit", "inherit"],
    env: {
      ...process.env,
      RECONIX_WEB_TOKEN: token,
      RECONIX_WEB_PORT: port,
      RECONIX_TERM_PORT: termPort,
      RECONIX_TERM_WATCH_STDIN: "1",
    },
  });
  proc.on("error", (error) => {
    console.error(`[terminal] The Terminal page is unavailable: couldn't run ${python} (${error.message}). Set RECONIX_PYTHON.`);
  });
  proc.on("exit", (code, signal) => {
    if (!stopping) console.error(`[terminal] The terminal helper stopped (${signal ?? `exit code ${code}`}); the Terminal page can't connect.`);
  });
  return proc;
}

let stopping = false;

/* On Windows, kill() is a hard kill, so the helper is told by closing its stdin instead:
   it then closes its sessions (and their TUIs) itself. */
function stopTerminal() {
  stopping = true;
  if (!helper || helper.exitCode !== null || helper.signalCode !== null) return;
  if (process.platform === "win32") helper.stdin.end();
  else helper.kill("SIGTERM");
}

let announced = false;
child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (announced || !/ready/i.test(String(chunk))) return;
  announced = true;
  writeLink();
  process.stdout.write(
    `\n  Reconix analysis dashboard\n` +
      `  Data     ${dataDir}\n` +
      `  Terminal ${terminal ? `the Terminal page (helper on ws://127.0.0.1:${termPort})` : "off (--no-terminal): read-only"}\n` +
      `  Sign in  ${signInLine()}\n` +
      `  The link changes every time the dashboard starts. Press Ctrl+C to stop.\n` +
      `  From the TUI, run /web to open it.\n\n`,
  );
  if (openBrowser) open(link);
});

/* The link signs in with full control of the Terminal page, so it is printed only to a
   terminal, never into a log (started by the TUI, our output goes to ~/.reconix/web.log). */
function signInLine() {
  return process.stdout.isTTY ? link : `the link is in ${linkFile} (/web in the TUI opens it)`;
}

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

for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopTerminal();
    child.kill(signal);
  });
child.on("exit", (code) => {
  stopTerminal();
  cleanup();
  removeLink();
  process.exit(code ?? 0);
});
