import {
  BookOpen,
  Bot,
  FileText,
  LifeBuoy,
  Rocket,
  ShieldCheck,
  SquareTerminal,
  Target,
  TerminalSquare,
  type LucideIcon,
} from "lucide-react";

import commandsJson from "@/content/docs/commands.json";

export type DocPage = { title: string; href: string; description: string };

export type DocGroup = {
  /** url segment under /docs (also the content key in src/content/docs) */
  id: string;
  title: string;
  /** group landing page; for single-page groups (Overview) it is the page itself */
  href: string;
  description: string;
  icon: LucideIcon;
  pages: DocPage[];
};

/** One slash command as `scripts/export_commands.py` wrote it (the TUI's `Command`). */
export type CommandEntry = {
  name: string;
  aliases: string[];
  description: string;
  /** the argument is picked from a list */
  takes_argument: boolean;
  /** a missing argument opens that list as a menu (false: the list only suggests) */
  ask: boolean;
  question: string;
  empty: string;
};

export type CommandGroup = { id: string; title: string; commands: CommandEntry[] };

/**
 * The generated command reference: every command of `reconix/commands/builtin.py`, grouped by
 * area. Regenerate with `python scripts/export_commands.py`; `tests/test_export_commands.py`
 * fails when the file is stale.
 */
export const COMMAND_GROUPS: CommandGroup[] = commandsJson.groups;

export const COMMANDS: CommandEntry[] = COMMAND_GROUPS.flatMap((g) => g.commands);

export const commandHref = (name: string) => `/docs/commands/${name}`;

/**
 * The docs structure, single source of truth for the docs sidebar, the navbar "Docs" and
 * "Guardrails" dropdowns, breadcrumbs, prev/next links, search and the sitemap. Adding a page =
 * add it here and add its content to src/content/docs/<group>.tsx under the same slug.
 * The Commands group's pages come from the generated reference (one per command).
 */
export const DOCS_NAV: DocGroup[] = [
  {
    id: "overview",
    title: "Overview",
    href: "/docs",
    description: "What the Reconix terminal is, what it does and where to start.",
    icon: BookOpen,
    pages: [],
  },
  {
    id: "getting-started",
    title: "Getting started",
    href: "/docs/getting-started",
    description: "Install the terminal, launch it and run a first assessment.",
    icon: Rocket,
    pages: [
      { title: "Introduction", href: "/docs/getting-started/introduction", description: "What Reconix does, what is simulated and what is real." },
      { title: "Requirements", href: "/docs/getting-started/requirements", description: "Python, a terminal, and the optional pieces for PDF, the dashboard and a model." },
      { title: "Installation", href: "/docs/getting-started/installation", description: "Clone, create a virtual environment, install." },
      { title: "Launching", href: "/docs/getting-started/launching", description: "python -m reconix, the reconix command and run.py." },
      { title: "First steps", href: "/docs/getting-started/first-steps", description: "A first assessment on the demo target, gate by gate." },
    ],
  },
  {
    id: "terminal-guide",
    title: "Terminal guide",
    href: "/docs/terminal-guide",
    description: "The eight screens, the keys and the slash-command bar.",
    icon: SquareTerminal,
    pages: [
      { title: "The screens", href: "/docs/terminal-guide/screens", description: "Start, Template, Plan, Approval, Execution, Findings, Finding Detail and Report." },
      { title: "Keys", href: "/docs/terminal-guide/keys", description: "The keys that work everywhere and the ones each screen adds." },
      { title: "The command bar", href: "/docs/terminal-guide/command-bar", description: "Slash commands, Tab completion, history and Ctrl+R." },
      { title: "The prompt", href: "/docs/terminal-guide/prompt", description: "What a typed line does: a target, a question, a command or a path." },
    ],
  },
  {
    id: "ai-models",
    title: "AI models",
    href: "/docs/ai-models",
    description: "Connect a model with /provider and /model, and what runs without one.",
    icon: Bot,
    pages: [
      { title: "Providers", href: "/docs/ai-models/providers", description: "/provider: set, test, use a model, unset; the six-provider catalog." },
      { title: "Models", href: "/docs/ai-models/models", description: "/model: pick the active model, switch mid-run, chat with it." },
      { title: "Configuration", href: "/docs/ai-models/configuration", description: "The .env seed, the encrypted llm.db and the 0600 key file." },
      { title: "Common errors", href: "/docs/ai-models/errors", description: "Every message the provider and model commands can show." },
    ],
  },
  {
    id: "commands",
    title: "Commands",
    href: "/docs/commands",
    description: "Every slash command: purpose, syntax, an example, what happens and its errors.",
    icon: TerminalSquare,
    pages: COMMANDS.map((c) => ({ title: `/${c.name}`, href: commandHref(c.name), description: c.description })),
  },
  {
    id: "assessment-guide",
    title: "Security assessment guide",
    href: "/docs/assessment-guide",
    description: "From a typed request to findings: scope, plan, tools, policy checks, approval gates and execution.",
    icon: Target,
    pages: [
      { title: "Request and template", href: "/docs/assessment-guide/request", description: "A target picks a template; four templates cover web, API, network and source code." },
      { title: "Scope manifest", href: "/docs/assessment-guide/scope", description: "What a scope allows, how to edit it, what approving it locks." },
      { title: "Plan and tools", href: "/docs/assessment-guide/plan", description: "The phases, the target login the tools need, and the gated steps." },
      { title: "Policy checks", href: "/docs/assessment-guide/policy-checks", description: "Every request is checked against the approved scope before it runs." },
      { title: "Approval gates", href: "/docs/assessment-guide/approval-gates", description: "MEDIUM: one decision. HIGH: a double check with a single-use token and the request hash." },
      { title: "Execution", href: "/docs/assessment-guide/execution", description: "The live run, its pauses, and stopping it." },
      { title: "Findings", href: "/docs/assessment-guide/findings", description: "How findings appear, and how the run ends." },
      { title: "The AI agent", href: "/docs/assessment-guide/ai-agent", description: "/assess with a model: a real assessment through the same gates." },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    href: "/docs/reports",
    description: "Review the results, understand the findings, export from the terminal or the dashboard.",
    icon: FileText,
    pages: [
      { title: "Reviewing results", href: "/docs/reports/reviewing", description: "The Report screen, the summary and the audit trail." },
      { title: "Understanding findings", href: "/docs/reports/understanding-findings", description: "Severity, validation, CVSS, triage, filters and imports." },
      { title: "Exporting", href: "/docs/reports/exporting", description: "PDF, JSON and DOCX from the terminal, saved under ./reports/." },
      { title: "The web dashboard", href: "/docs/reports/dashboard", description: "Single downloads, the preview, and the combined report of up to five runs." },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    href: "/docs/troubleshooting",
    description: "What each error means and what to do about it.",
    icon: LifeBuoy,
    pages: [
      { title: "Model connection", href: "/docs/troubleshooting/model-connection", description: "Unreachable providers, bad keys, timeouts." },
      { title: "Missing tools", href: "/docs/troubleshooting/missing-tools", description: "No Chrome for the PDF, no python-docx, no harness." },
      { title: "Policy errors", href: "/docs/troubleshooting/policy-errors", description: "Blocked requests and refused edits." },
      { title: "Unknown commands", href: "/docs/troubleshooting/unknown-commands", description: "Typos, the path rule, and commands that need a run." },
      { title: "Report failures", href: "/docs/troubleshooting/report-failures", description: "When an export is refused or can't be written." },
      { title: "The web dashboard", href: "/docs/troubleshooting/web-dashboard", description: "/web can't start: ports, Node and the log." },
    ],
  },
  {
    id: "guardrails",
    title: "Guardrails",
    href: "/docs/guardrails",
    description: "The rules that keep an assessment inside what you approved.",
    icon: ShieldCheck,
    pages: [
      { title: "Authorized use", href: "/docs/guardrails/authorized-use", description: "Only assess what you may test." },
      { title: "Scope & safety", href: "/docs/guardrails/scope-and-safety", description: "The scope check, canonical paths and untrusted data." },
      { title: "Approval model", href: "/docs/guardrails/approval-model", description: "The scope once, every risky action, and the HIGH double check." },
      { title: "Credential handling", href: "/docs/guardrails/credential-handling", description: "Logins in memory, codes never stored, secrets masked everywhere." },
      { title: "LLM data handling", href: "/docs/guardrails/llm-data-handling", description: "What a model sees, what it never decides." },
      { title: "Limitations", href: "/docs/guardrails/limitations", description: "What Reconix does not do." },
    ],
  },
];

export type DocEntry = DocPage & { group: DocGroup; isGroup: boolean };

/** Every docs route in reading order: each group's landing, then its pages. */
export const DOCS_ENTRIES: DocEntry[] = DOCS_NAV.flatMap((g) => [
  { title: g.title, href: g.href, description: g.description, group: g, isGroup: true },
  ...g.pages.map((p) => ({ ...p, group: g, isGroup: false })),
]);

export const DOCS_ROUTES = DOCS_ENTRIES.map((e) => e.href);

/**
 * The docs pages the dashboard and the site link to, by meaning. Components link through this
 * map, never through a string literal, so the docs can move again by changing one place; the
 * test checks that every address here is a live page (DOCS_ROUTES).
 */
export const DOCS = {
  home: "/docs",
  gettingStarted: "/docs/getting-started",
  introduction: "/docs/getting-started/introduction",
  assessmentGuide: "/docs/assessment-guide",
  request: "/docs/assessment-guide/request",
  scope: "/docs/assessment-guide/scope",
  plan: "/docs/assessment-guide/plan",
  policyChecks: "/docs/assessment-guide/policy-checks",
  approvalGates: "/docs/assessment-guide/approval-gates",
  approvalModel: "/docs/guardrails/approval-model",
  llmData: "/docs/guardrails/llm-data-handling",
  screens: "/docs/terminal-guide/screens",
  configuration: "/docs/ai-models/configuration",
  findings: "/docs/reports/understanding-findings",
  exporting: "/docs/reports/exporting",
  dashboard: "/docs/reports/dashboard",
} as const;
export type DocsLink = (typeof DOCS)[keyof typeof DOCS];

export function findDoc(href: string): DocEntry | undefined {
  return DOCS_ENTRIES.find((e) => e.href === href);
}

/** Previous / next readable page. Group landings of multi-page groups are skipped (they only list pages). */
export function docNeighbours(href: string): { prev?: DocEntry; next?: DocEntry } {
  const reading = DOCS_ENTRIES.filter((e) => !e.isGroup || e.group.pages.length === 0);
  const i = reading.findIndex((e) => e.href === href);
  if (i < 0) return {};
  return { prev: reading[i - 1], next: reading[i + 1] };
}
