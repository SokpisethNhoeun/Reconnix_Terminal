/* The Documentation page's four sections, as components. Content only; the page frames them
   with the sub-nav and the previous/next links. Kept in step with the README and CLAUDE.md. */
import { Globe, SquareTerminal } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Card } from "../neu/card";
import { Chip } from "../neu/chips";
import { Notice } from "../neu/notice";

export interface DocSection {
  id: string;
  label: string;
  title: string;
  lede: string;
  Body: () => ReactElement;
}

function H({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 text-[18px] font-semibold">{children}</h3>;
}

function Cmd({ lines }: { lines: string[] }) {
  return (
    <pre className="cmd">
      {lines.map((l) => (
        <div key={l}>
          <span className="cmd-prompt">$</span> {l}
        </div>
      ))}
    </pre>
  );
}

// --- Overview ----------------------------------------------------------------------------

function Overview() {
  return (
    <>
      <H>What Reconix does</H>
      <p className="leading-relaxed text-muted">
        Reconix is an AI assistant for <b className="font-semibold text-text">authorized</b> security testing. It plans the test,
        runs approved tools only inside the scope you confirm, checks the results, and explains each problem with trusted sources
        (OWASP, CWE, CVE).
      </p>
      <p className="leading-relaxed text-muted">
        It is made for <b className="font-semibold text-text">developers</b> checking their own apps and{" "}
        <b className="font-semibold text-text">security teams</b> testing for others.
      </p>

      <H>Two ways to use it</H>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <span className="flex items-center gap-2 text-[14px] font-semibold">
            <SquareTerminal size={17} aria-hidden className="text-accent" />
            Terminal
          </span>
          <p className="text-[13px] text-muted">
            Run <code className="rounded bg-well px-1.5 py-0.5 font-mono text-[12px]">reconix</code> and work with the AI in your
            terminal.
          </p>
        </Card>
        <Card>
          <span className="flex items-center gap-2 text-[14px] font-semibold">
            <Globe size={17} aria-hidden className="text-accent" />
            Local web
          </span>
          <p className="text-[13px] text-muted">
            Start assessments, approve the scope and risky actions, review findings and choose the AI model, all in your browser.
          </p>
        </Card>
      </div>
      <p className="text-[12.5px] text-faint">Both share the same data. Start in one and continue in the other.</p>

      <H>Authorized use</H>
      <Notice icon={<SquareTerminal size={18} />} tone="warn">
        Only test targets you own or have written permission to test. Reconix enforces the scope you approve, but the permission
        itself must come from you or your organization.
      </Notice>

      <H>Limitations</H>
      <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[13.5px] leading-relaxed text-muted">
        <li>
          AI findings can be wrong. Unsure ones are marked <b className="font-semibold text-text">Need review</b> for a person to
          check.
        </li>
        <li>
          Severity is never guessed. Without a scanner rating or CVSS score, it shows as{" "}
          <b className="font-semibold text-text">Unknown</b>.
        </li>
        <li>Reconix only does supported tasks. Anything outside them, or outside your scope, is refused.</li>
      </ul>
    </>
  );
}

// --- Getting started ---------------------------------------------------------------------

function GettingStarted() {
  return (
    <>
      <H>Requirements</H>
      <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[13.5px] leading-relaxed text-muted">
        <li>Python 3.9 or later for the terminal app and this dashboard’s helper.</li>
        <li>Node.js 20 or later to run the local web dashboard.</li>
        <li>Written authorization for every target you plan to assess.</li>
      </ul>

      <H>Installation</H>
      <p className="text-[13.5px] text-muted">Clone the repository and set up the terminal app:</p>
      <Cmd lines={["git clone <your-reconix-repo> reconix", "cd reconix", "python -m venv .venv && source .venv/bin/activate", "pip install -r requirements.txt"]} />
      <p className="text-[13.5px] text-muted">Then start it:</p>
      <Cmd lines={["python -m reconix", "# or: reconix"]} />

      <H>Open the local web</H>
      <p className="text-[13.5px] text-muted">
        The dashboard reads the assessments the terminal app saves. Run it with the sample data to look around first:
      </p>
      <Cmd lines={["cd web && npm install", "RECONIX_DATA_DIR=sample-data npm run dev", "# open http://localhost:3000"]} />
      <p className="text-[13.5px] text-muted">
        Here you can run and approve assessments (operators), review findings and evidence, and export reports.
      </p>

      <H>Your first assessment</H>
      <ol className="m-0 flex list-decimal flex-col gap-2.5 pl-5 text-[13.5px] leading-relaxed">
        <li>
          <b className="font-semibold">Open the AI Assistant</b> and describe the task, or pick a template: Network, API, Source
          Code or Web URL.
        </li>
        <li>
          <b className="font-semibold">Answer the questions</b> Reconix asks and review the draft Scope Manifest.
        </li>
        <li>
          <b className="font-semibold">Tick “I own this target or have written permission”</b> and approve the scope. Nothing
          runs before this step.
        </li>
        <li>
          <b className="font-semibold">Approve any medium- or high-risk action</b> when asked, or stop the assessment at any time.
        </li>
        <li>
          <b className="font-semibold">Review findings</b> on the Findings page, then export the report when the run is complete.
        </li>
      </ol>
    </>
  );
}

// --- Architecture ------------------------------------------------------------------------

const COMPONENTS: [string, string, string][] = [
  ["Terminal (CLI / TUI)", "Python · Textual · Rich", "Starts assessments, edits the scope, approves actions and shows results."],
  ["Local web", "Next.js · TypeScript", "The same in your browser: starts assessments, approves the scope and actions, shows findings, evidence and reports."],
  ["Store", "In-memory (backend seam)", "Validates every request against the Scope Manifest, applies the risk policy, and records approvals and events."],
  ["Templates", "Web · Network · API · Code", "Draft the scope, plan, approvals and findings for each kind of target."],
  ["Policy engine", "Scope + risk rules", "Decides ALLOWED or BLOCKED for each request, and LOW / MEDIUM / HIGH for each action."],
  ["Knowledge", "OWASP · CWE · CVE", "Explains each finding’s impact and fix with trusted references, filtered by the user’s role."],
];

function Architecture() {
  const path = ["Terminal / Local web", "Store", "Policy engine", "Tools"];
  return (
    <>
      <H>Request path</H>
      <p className="leading-relaxed text-muted">
        A request goes from the Terminal or Local web to the Store, which validates it against the approved scope and the risk
        policy before any tool runs. The result returns along the same path.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {path.map((node, i) => (
          <span key={node} className="flex items-center gap-2">
            <span className="chip">{node}</span>
            {i < path.length - 1 && <span className="text-accent" aria-hidden>→</span>}
          </span>
        ))}
      </div>

      <H>Components</H>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Component</th>
              <th>Stack</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {COMPONENTS.map(([name, stack, role]) => (
              <tr key={name}>
                <td className="font-medium whitespace-nowrap">{name}</td>
                <td className="font-mono text-[12.5px] text-muted">{stack}</td>
                <td className="text-muted">{role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H>Where the checks run</H>
      <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[13.5px] leading-relaxed text-muted">
        <li>Scope and command validation happen in the Store before any tool request is forwarded.</li>
        <li>Risk classification uses a fixed policy. The AI may suggest a level, but the Store decides.</li>
        <li>Output masking runs before results are displayed, stored or written to a report.</li>
      </ul>
    </>
  );
}

// --- Findings explained ------------------------------------------------------------------

const SEVERITY: [string, "CRITICAL" | "HIGH" | "MEDIUM" | "LOW", string, string][] = [
  ["Critical", "CRITICAL", "9.0 – 10", "Fix now. An attacker can take full control or steal data."],
  ["High", "HIGH", "7.0 – 8.9", "Fix soon. Serious damage is possible."],
  ["Medium", "MEDIUM", "4.0 – 6.9", "Plan a fix. Harder to use or smaller impact."],
  ["Low", "LOW", "0.1 – 3.9", "Fix when you can. Small risk."],
];

const STATUS: [string, "warn" | "ok" | "faint", string][] = [
  ["Need review", "warn", "The AI found it but isn’t sure. A person should check it."],
  ["Confirmed", "ok", "A person or a safe check proved it is real."],
  ["False positive", "faint", "Checked, and it is not a real problem."],
  ["Fixed", "ok", "The problem was fixed and checked again."],
];

function FindingsExplained() {
  return (
    <>
      <H>Severity: how bad is it?</H>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Severity</th>
              <th>CVSS score</th>
              <th>What to do</th>
            </tr>
          </thead>
          <tbody>
            {SEVERITY.map(([label, sev, score, todo]) => (
              <tr key={sev}>
                <td>
                  <Chip severity={sev}>{label}</Chip>
                </td>
                <td className="font-mono text-[12.5px] text-muted">{score}</td>
                <td className="text-muted">{todo}</td>
              </tr>
            ))}
            <tr>
              <td>
                <Chip tone="faint">Unknown</Chip>
              </td>
              <td className="font-mono text-[12.5px] text-muted">no score</td>
              <td className="text-muted">No scanner rating or CVSS yet. Reconix never guesses.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H>Status: where is it now?</H>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Status</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {STATUS.map(([label, tone, meaning]) => (
              <tr key={label}>
                <td>
                  <Chip tone={tone}>{label}</Chip>
                </td>
                <td className="text-muted">{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H>Other words you’ll see</H>
      <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[13.5px] leading-relaxed text-muted">
        <li>
          <b className="font-semibold text-text">CVSS</b>: a standard score from 0 to 10 for how serious a problem is.
        </li>
        <li>
          <b className="font-semibold text-text">CWE</b>: the standard name for the type of problem, e.g. CWE-434 is
          “unrestricted file upload”.
        </li>
        <li>
          <b className="font-semibold text-text">Evidence</b>: the real request and response that prove the problem. Secrets are
          masked.
        </li>
      </ul>
    </>
  );
}

export const SECTIONS: DocSection[] = [
  { id: "overview", label: "Overview", title: "Overview", lede: "What Reconix is, what it expects from you, and what it can’t do.", Body: Overview },
  { id: "getting-started", label: "Getting started", title: "Getting started", lede: "Install Reconix, start the services, and run your first approved assessment.", Body: GettingStarted },
  { id: "architecture", label: "Architecture", title: "Architecture", lede: "How the terminal, local web, store and policy engine work together, and where the checks happen.", Body: Architecture },
  { id: "findings", label: "Findings explained", title: "Findings explained", lede: "What the labels on the Findings page mean.", Body: FindingsExplained },
];
