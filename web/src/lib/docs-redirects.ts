/* Where the documentation's old addresses go. The docs were restructured in redesign v3
   (docs/WEB_REDESIGN_V3_PLAN.md): every page of the previous structure either still exists at
   the same address or redirects (308, in next.config.ts) to the nearest new page, so links in
   the dashboard, bookmarks and the old sitemap keep working. tests/docs-nav.test.ts checks that
   every old route is covered and that no redirect shadows a live page.
   Plain data with no imports, so next.config.ts can load it. */

export type DocsRedirect = { source: string; destination: string };

/** Every docs route the previous structure had (its DOCS_NAV before redesign v3). */
export const OLD_DOCS_ROUTES: string[] = [
  "/docs",
  "/docs/getting-started",
  "/docs/getting-started/requirements",
  "/docs/getting-started/installation",
  "/docs/getting-started/configuration",
  "/docs/getting-started/first-assessment",
  "/docs/assessments",
  "/docs/assessments/workflow",
  "/docs/assessments/templates",
  "/docs/interfaces",
  "/docs/interfaces/terminal",
  "/docs/interfaces/vscode-extension",
  "/docs/interfaces/local-viewer",
  "/docs/configuration",
  "/docs/configuration/scope-manifest",
  "/docs/configuration/policies",
  "/docs/guardrails",
  "/docs/guardrails/authorized-use",
  "/docs/guardrails/scope-and-safety",
  "/docs/guardrails/approval-model",
  "/docs/guardrails/credential-handling",
  "/docs/guardrails/llm-data-handling",
  "/docs/guardrails/model-switching",
  "/docs/guardrails/knowledge-and-rag",
  "/docs/guardrails/limitations",
  "/docs/architecture",
  "/docs/reference",
  "/docs/reference/findings",
  "/docs/reference/reports",
];

/** Old address → the nearest page of the new structure (the rest of OLD_DOCS_ROUTES still exist). */
export const DOCS_REDIRECTS: DocsRedirect[] = [
  { source: "/docs/getting-started/configuration", destination: "/docs/ai-models/configuration" },
  { source: "/docs/getting-started/first-assessment", destination: "/docs/getting-started/first-steps" },
  { source: "/docs/assessments", destination: "/docs/assessment-guide" },
  { source: "/docs/assessments/workflow", destination: "/docs/assessment-guide" },
  { source: "/docs/assessments/templates", destination: "/docs/assessment-guide/request" },
  { source: "/docs/interfaces", destination: "/docs/terminal-guide" },
  { source: "/docs/interfaces/terminal", destination: "/docs/terminal-guide/screens" },
  { source: "/docs/interfaces/vscode-extension", destination: "/docs/getting-started/introduction" },
  { source: "/docs/interfaces/local-viewer", destination: "/docs/reports/dashboard" },
  { source: "/docs/configuration", destination: "/docs/assessment-guide/scope" },
  { source: "/docs/configuration/scope-manifest", destination: "/docs/assessment-guide/scope" },
  { source: "/docs/configuration/policies", destination: "/docs/assessment-guide/policy-checks" },
  { source: "/docs/guardrails/model-switching", destination: "/docs/ai-models/models" },
  { source: "/docs/guardrails/knowledge-and-rag", destination: "/docs/guardrails/llm-data-handling" },
  { source: "/docs/architecture", destination: "/docs/getting-started/introduction" },
  { source: "/docs/reference", destination: "/docs/reports" },
  { source: "/docs/reference/findings", destination: "/docs/reports/understanding-findings" },
  { source: "/docs/reference/reports", destination: "/docs/reports/exporting" },
];
