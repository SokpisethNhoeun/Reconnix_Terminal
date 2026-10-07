/* Where the browser terminal lives. scripts/serve.mjs starts the helper (reconix/webterm)
   next to Next.js and sets RECONIX_WEB_TERMINAL=1 and RECONIX_TERM_PORT; with
   `--no-terminal` it stays off. It reads the environment, so only the server and the proxy
   use it; the browser gets the socket URL with each ticket. */

/** Whether this dashboard hosts the Terminal page. */
export function terminalEnabled(): boolean {
  return process.env.RECONIX_WEB_TERMINAL === "1";
}

export function terminalPort(): string {
  return process.env.RECONIX_TERM_PORT || "3101";
}

/** The helper's origin, for the Content-Security-Policy's connect-src. */
export function terminalSocketOrigin(): string {
  return `ws://127.0.0.1:${terminalPort()}`;
}

/** Where the Terminal page opens its socket (a ticket is added as `?ticket=`). */
export function terminalSocketUrl(): string {
  return `${terminalSocketOrigin()}/`;
}
