/* The AI Assistant's addresses (safe for the browser, the proxy and the server). The route
   needs the operator role: src/proxy.ts checks it, and so does the handler. */

export const ASSISTANT_ROUTE = "/api/assistant";
/** The route and anything ever added under it (operators only). */
export const isAssistantPath = (pathname: string) => pathname === ASSISTANT_ROUTE || pathname.startsWith(`${ASSISTANT_ROUTE}/`);
export const ASSISTANT_PAGE = "/assistant";
/** The assistant on the dashboard page; /assistant redirects here. */
export const ASSISTANT_VIEW = "/?view=assistant";
