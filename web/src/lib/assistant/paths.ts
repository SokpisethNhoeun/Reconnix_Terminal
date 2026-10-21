/* The AI Assistant's addresses (safe for the browser, the proxy and the server). Every route
   under /api/assistant needs the operator role: src/proxy.ts checks it, and so do the handlers. */

export const ASSISTANT_ROUTE = "/api/assistant";
/** The route and anything under it (operators only). */
export const isAssistantPath = (pathname: string) => pathname === ASSISTANT_ROUTE || pathname.startsWith(`${ASSISTANT_ROUTE}/`);
/** The saved conversations (GET the list, DELETE all). */
export const CONVERSATIONS_ROUTE = `${ASSISTANT_ROUTE}/conversations`;
/** One saved conversation (GET, PATCH to rename, DELETE). */
export const conversationRoute = (id: string) => `${CONVERSATIONS_ROUTE}/${encodeURIComponent(id)}`;
/** The assistant on the dashboard page; /assistant redirects here. */
export const ASSISTANT_VIEW = "/?view=assistant";
