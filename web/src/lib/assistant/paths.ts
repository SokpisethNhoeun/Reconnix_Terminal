/* The AI Assistant's addresses (safe for the browser, the proxy and the server). Every route
   under /api/assistant needs the operator role: src/proxy.ts checks it, and so do the handlers. */

export const ASSISTANT_ROUTE = "/api/assistant";
/** The route and anything under it (operators only). */
export const isAssistantPath = (pathname: string) => pathname === ASSISTANT_ROUTE || pathname.startsWith(`${ASSISTANT_ROUTE}/`);
/** The saved conversations (GET the list, DELETE all). */
export const CONVERSATIONS_ROUTE = `${ASSISTANT_ROUTE}/conversations`;
/** One saved conversation (GET, PATCH to rename, DELETE). */
export const conversationRoute = (id: string) => `${CONVERSATIONS_ROUTE}/${encodeURIComponent(id)}`;
/** The saved models (GET the Model menu's view, POST adds a provider). */
export const MODELS_ROUTE = `${ASSISTANT_ROUTE}/models`;
/** One saved provider (PATCH changes it, DELETE removes it). */
export const modelRoute = (id: string) => `${MODELS_ROUTE}/${encodeURIComponent(id)}`;
/** The model that answers next (PUT). */
export const MODELS_ACTIVE_ROUTE = `${MODELS_ROUTE}/active`;
/** "Test connection" (POST). */
export const MODELS_TEST_ROUTE = `${MODELS_ROUTE}/test`;
/** "Fetch models" (POST). */
export const MODELS_FETCH_ROUTE = `${MODELS_ROUTE}/fetch`;
/** The assistant on the dashboard page; /assistant redirects here. */
export const ASSISTANT_VIEW = "/?view=assistant";
