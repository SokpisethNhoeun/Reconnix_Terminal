/* What the About page says, as data. Keep it in step with the README and CLAUDE.md (and
   the landing site's copy): it explains the project and claims nothing beyond them. */
import {
  Database,
  FileJson,
  FileOutput,
  Globe,
  KeyRound,
  LayoutTemplate,
  ListChecks,
  type LucideIcon,
  MonitorSmartphone,
  Play,
  ScanSearch,
  ShieldCheck,
  SquareTerminal,
  Ticket,
  TriangleAlert,
  User,
} from "lucide-react";

import type { Tone } from "@/components/neu/chips";

// --- intro ------------------------------------------------------------------------------

export const TAGLINE = "AI-planned security assessments inside an approved scope.";

export const SUMMARY = [
  "Reconix is an AI-powered terminal assistant for authorized security testing. It plans an " +
    "assessment, keeps every action inside a scope a person approved, and turns tool results " +
    "into clear findings and reports.",
  "This project holds two things: the keyboard-first terminal app (a Python TUI built with " +
    "Textual) and this local dashboard (Next.js) that shows what the app saved. In this version " +
    "the testing itself is simulated, so no real scanner runs, but the process is real: the " +
    "target picks a template, the template builds the scope, plan, approvals and findings, and a " +
    "policy engine checks every request against the scope you approved.",
];

export interface Fact {
  label: string;
  value: string;
  tone: Tone;
}

/** Short `LABEL ▸ value` readouts under the summary (the landing's status chips). */
export const FACTS: Fact[] = [
  { label: "scope", value: "approved first", tone: "warn" },
  { label: "execution", value: "simulated", tone: "accent" },
  { label: "dashboard", value: "read-only", tone: "ok" },
];

export interface Part {
  icon: LucideIcon;
  title: string;
  body: string;
}

export const PARTS: Part[] = [
  {
    icon: SquareTerminal,
    title: "Terminal app",
    body: "Where assessments run. Type a target, approve the scope, run the plan, decide each gate.",
  },
  {
    icon: MonitorSmartphone,
    title: "This dashboard",
    body: "Reads the assessments the app saved on this computer. Its pages never change anything.",
  },
  {
    icon: Globe,
    title: "Terminal page",
    body: "Runs the same terminal app in a browser tab, so every gate is still the app's gate.",
  },
];

// --- workflow ---------------------------------------------------------------------------

export interface FlowStep {
  key: string;
  name: string;
  icon: LucideIcon;
  body: string;
  you?: string; // what a person decides here
  gate?: boolean; // the approval gate: amber, like on the landing site
}

/** The eight screens of the terminal app, in flow order (FLOW in shell/navigation.py). */
export const FLOW_STEPS: FlowStep[] = [
  {
    key: "start",
    name: "Start",
    icon: Play,
    body: "Type a target: a URL, an IPv4 address or range, a git repo or a local path. An empty Enter plays the demo.",
  },
  {
    key: "template",
    name: "Template",
    icon: LayoutTemplate,
    body: "The target picks one of four templates (Web URL, Network, API, Source Code), which drafts a scope manifest in plain words.",
    you: "Approve, edit or reject the scope.",
  },
  {
    key: "plan",
    name: "Plan",
    icon: ListChecks,
    body: "Every phase, the target login it may need, and each risky action with its exact request.",
    you: "Run plan to start testing.",
  },
  {
    key: "approval",
    name: "Approval",
    icon: ShieldCheck,
    body: "Each gated action waits here. Rejecting stops the assessment.",
    you: "MEDIUM: approve or reject. HIGH: approve, then double-check the exact request.",
    gate: true,
  },
  {
    key: "execution",
    name: "Execution",
    icon: ScanSearch,
    body: "The live run: each task queued, running, paused or done, with the live output. It pauses when a step needs you.",
    you: "Sign in to the target when asked (secure form).",
  },
  {
    key: "findings",
    name: "Findings",
    icon: TriangleAlert,
    body: "Filter, sort and triage the findings; import nuclei, nmap or ZAP output.",
  },
  {
    key: "detail",
    name: "Finding detail",
    icon: FileJson,
    body: "One finding's evidence (masked) and analysis, its triage, and previous / next.",
  },
  {
    key: "report",
    name: "Report",
    icon: FileOutput,
    body: "Export HTML, PDF, DOCX, JSON, SARIF, CSV or Markdown, or open this dashboard.",
  },
];

// --- guardrails -------------------------------------------------------------------------

export interface Guard {
  title: string;
  body: string;
}

export const GUARDS: Guard[] = [
  {
    title: "Scope first",
    body: "Testing starts only after the scope is approved and the plan is run.",
  },
  {
    title: "Policy check on every request",
    body: "The policy engine compares each request with the approved scope and blocks the rest. Blocked requests show on the Policy page.",
  },
  {
    title: "Decisions bound to the request",
    body: "Each risky action waits for a person, and the approval is tied to that exact request (its command hash).",
  },
  {
    title: "HIGH risk: a double check",
    body: "A second confirmation with a single-use token. The dialog starts on “No, go back”.",
  },
  {
    title: "Secrets stay out",
    body: "Target logins live in memory for the session, one-time codes are never stored, evidence is masked, and saved copies hold no secret.",
  },
  {
    title: "The store decides",
    body: "Screens only ask. Every decision goes through the store, which validates it and refuses what breaks a rule.",
  },
];

export interface RiskRule {
  level: string;
  tone: Tone;
  rule: string;
}

export const RISK_RULES: RiskRule[] = [
  { level: "LOW", tone: "ok", rule: "Runs after the checks pass." },
  { level: "MEDIUM", tone: "warn", rule: "Waits for a person to approve or reject." },
  { level: "HIGH", tone: "bad", rule: "Approve, then double-check the exact request." },
];

// --- architecture -----------------------------------------------------------------------

export interface PathNode {
  icon: LucideIcon;
  title: string;
  sub: string;
}

export interface DataPath {
  title: string;
  nodes: PathNode[];
}

export const DATA_PATHS: DataPath[] = [
  {
    title: "An assessment",
    nodes: [
      { icon: User, title: "You", sub: "type a target, decide the gates" },
      { icon: SquareTerminal, title: "Terminal app", sub: "Textual screens ask" },
      { icon: Database, title: "Store", sub: "decides and validates; the backend seam" },
      { icon: FileJson, title: "Saved copy", sub: "~/.reconix/assessments, secrets removed" },
      { icon: MonitorSmartphone, title: "This dashboard", sub: "checks each file, then shows it" },
    ],
  },
  {
    title: "The Terminal page",
    nodes: [
      { icon: Globe, title: "Browser tab", sub: "operators only" },
      { icon: Ticket, title: "Ticket", sub: "single use, valid for 60 s" },
      { icon: KeyRound, title: "Helper", sub: "127.0.0.1:3101, checks Host and Origin" },
      { icon: SquareTerminal, title: "Terminal app", sub: "in a pseudo-terminal, same store" },
    ],
  },
];

// --- for developers ---------------------------------------------------------------------

export interface CodeEntry {
  path: string;
  about: string;
}

export interface CodeArea {
  root: string;
  title: string;
  entries: CodeEntry[];
}

export const CODE_MAP: CodeArea[] = [
  {
    root: "reconix/",
    title: "The terminal app (Python, Textual + Rich)",
    entries: [
      { path: "app.py", about: "the app: key bindings and the command runner" },
      { path: "shell/", about: "app behaviour: navigation, the hosted run, actions, dialogs" },
      { path: "flow/", about: "RunController plays the run; gates route to screens" },
      { path: "store/", about: "the only backend seam: run, templates, scope, policy, approvals, reports" },
      { path: "screens/", about: "one file per screen (01 Start … 08 Report), forms, dialogs" },
      { path: "widgets/", about: "reusable pieces: menus, prompt, question, run log, spinner" },
      { path: "commands/", about: "slash commands: /new, /template, /findings, /web …" },
      { path: "webterm/", about: "the Terminal page's server: tickets, origin checks, pty sessions" },
      { path: "theme.py", about: "every color, for the terminal app and this dashboard" },
    ],
  },
  {
    root: "web/src/",
    title: "This dashboard (Next.js, React, Tailwind)",
    entries: [
      { path: "app/", about: "the pages and the few routes: sign-in, downloads, terminal ticket" },
      { path: "components/", about: "cards, chips, charts, tables, the terminal panel" },
      { path: "lib/data/", about: "reads and validates the saved copies (schema.ts mirrors snapshot.py)" },
      { path: "lib/auth/", about: "sign-in link, roles (viewer, operator), CSP, terminal tickets" },
      { path: "proxy.ts", about: "checks the Host and the role before every page and route" },
      { path: "styles/tokens.css", about: "generated from theme.py; never edited by hand" },
    ],
  },
];

export const RULES: string[] = [
  "The store decides; screens ask. Every decision is validated in the store.",
  "Never put user, tool or scope text into markup: it is always rendered as text.",
  "Colors come only from tokens (theme.py), in the terminal app and here.",
  "Secrets never reach chat, logs, reports or the saved copies.",
  "The dashboard only reads; change schema.ts together with snapshot.py.",
  "Every page needs the viewer role; the Terminal page needs operator.",
];

export interface CommandLine {
  cmd: string;
  note: string;
}

export const COMMANDS: CommandLine[] = [
  { cmd: "python -m reconix", note: "run the terminal app" },
  { cmd: "pytest -q", note: "store and screen tests" },
  { cmd: "cd web && npm run dev", note: "this dashboard + the Terminal page" },
  { cmd: "RECONIX_DATA_DIR=sample-data npm run dev", note: "with the sample assessments" },
  { cmd: "npm run build && npm run e2e", note: "dashboard browser tests (sample data)" },
];

// --- glossary ---------------------------------------------------------------------------

export interface Term {
  term: string;
  meaning: string;
}

export const GLOSSARY: Term[] = [
  { term: "Assessment", meaning: "One run against one target, from Start to Report." },
  {
    term: "Template",
    meaning: "The kind of target (Web URL, Network, API, Source Code). It builds the scope, plan, approvals and findings.",
  },
  {
    term: "Scope manifest",
    meaning: "What Reconix will test, what it may do, what it will never touch, and its tools. Nothing runs until it is approved.",
  },
  { term: "Gate", meaning: "A point where the run waits for a person: the scope, the plan, the target login, each risky action." },
  { term: "Policy check", meaning: "The store's verdict on one request: ALLOWED inside the scope, BLOCKED outside it." },
  { term: "Risk", meaning: "LOW, MEDIUM or HIGH, for an action. It decides how much approval the action needs." },
  { term: "Severity", meaning: "CRITICAL, HIGH, MEDIUM, LOW or INFO, for a finding." },
  { term: "Validation", meaning: "CONFIRMED, or REVIEW when a person should check the finding (unconfirmed or inconclusive)." },
  { term: "Triage", meaning: "What you decided about a finding: open, fixed, accepted risk or false positive." },
  { term: "Viewer / operator", meaning: "Dashboard roles. Viewers read; operators can also use the Terminal page." },
];
