/* The terminal's addresses in the dashboard (safe for the browser, the proxy and the
   server). The proxy requires the operator role for both. */

export const TERMINAL_PAGE = "/terminal";
export const TICKET_ROUTE = "/api/terminal/ticket";

/** Paths only operators may open: the page and everything under /api/terminal. */
export const isTerminalPath = (pathname: string) =>
  pathname === TERMINAL_PAGE || pathname === "/api/terminal" || pathname.startsWith("/api/terminal/");
