/* The Security knowledge page's addresses (safe for the browser, the proxy and the server). Every
   route under /api/knowledge needs the operator role: src/proxy.ts checks it, and so do the
   handlers (lib/knowledge/respond.ts). */

export const KNOWLEDGE_ROUTE = "/api/knowledge";
/** The routes and anything under them (operators only). */
export const isKnowledgePath = (pathname: string) => pathname === KNOWLEDGE_ROUTE || pathname.startsWith(`${KNOWLEDGE_ROUTE}/`);
/** One knowledge file (DELETE removes it). */
export const knowledgeFileRoute = (id: string) => `${KNOWLEDGE_ROUTE}/${encodeURIComponent(id)}`;
/** The file as it was added (GET: inline for PDF and text, a download for DOCX). */
export const knowledgeOriginalRoute = (id: string) => `${knowledgeFileRoute(id)}/original`;
/** That route: it sets its own, stricter Content-Security-Policy (lib/knowledge/original.ts), so
    the proxy leaves the page's policy off it. */
export const isKnowledgeOriginalPath = (pathname: string) => /^\/api\/knowledge\/[^/]+\/original$/.test(pathname);
/** The page on the dashboard (opened from the AI Assistant's header). */
export const KNOWLEDGE_VIEW = "/?view=knowledge";
