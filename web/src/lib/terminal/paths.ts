/* The terminal's addresses in the dashboard (safe for the browser, the proxy and the
   server). The proxy opens both only to a session, and only while this dashboard hosts the
   terminal. */

export const TERMINAL_PAGE = "/terminal";
/** The Terminal view on the dashboard page; /terminal redirects here. */
export const TERMINAL_VIEW = "/?view=terminal";
export const TICKET_ROUTE = "/api/terminal/ticket";

/** The refusal a terminal route gives while this dashboard doesn't host the terminal. */
export const TERMINAL_OFF = "The terminal is off: this dashboard was started with --no-terminal.";

/** The terminal's paths: the page and everything under /api/terminal. */
export const isTerminalPath = (pathname: string) =>
  pathname === TERMINAL_PAGE || pathname === "/api/terminal" || pathname.startsWith("/api/terminal/");
