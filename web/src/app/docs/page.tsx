import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";
import { DocGroupCards } from "@/components/docs-cards";
import { Callout, DocLink, DocsLayout, DocSection, Mono } from "@/components/docs-layout";
import { DOCS_NAV } from "@/lib/docs-nav";

export const metadata = { title: "Documentation · Reconix" };

const SCREENS = ["Start", "Template", "Plan", "Approval", "Execution", "Findings", "Finding Detail", "Report"];

/** The docs overview: what the terminal is, the flow in one line, and a card per group. */
export default function DocsHome() {
  return (
    <DocsLayout href="/docs" title="Documentation" lede="The Reconix terminal: what it does, how an assessment runs, and every command and key.">
      <Link
        href="/docs/getting-started/first-steps"
        className="group flex items-center gap-4 rounded-2xl border border-primary/40 bg-primary/5 p-5 transition-colors hover:border-primary"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Rocket className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Start here</span>
          <span className="block font-display text-lg font-semibold text-foreground">Run your first assessment</span>
          <span className="block text-sm text-muted-foreground">Install, launch, and go through every gate on the demo target.</span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>

      <DocSection title="What Reconix is">
        <p>
          Reconix is a keyboard-first terminal application for authorized security assessments. You type a target, Reconix
          picks a template and drafts a scope manifest, you approve it, review the test plan and run it; every risky step
          waits for your decision, every request is checked against the scope you approved, and the findings end up in a
          report you can export. The flow is eight screens:
        </p>
        <p className="font-mono text-xs text-foreground">{SCREENS.join("  →  ")}</p>
        <p>
          Out of the box the run is <strong>simulated</strong>: no scanner runs, but the process (templates, scope, plan,
          policy checks, approval gates, findings, reports) is the real one. With a model connected through{" "}
          <DocLink href="/docs/ai-models/providers">/provider</DocLink> and the backend harness installed,{" "}
          <DocLink href="/docs/assessment-guide/ai-agent">/assess</DocLink> runs a real assessment through the same gates.
        </p>
        <Callout variant="warning" title="Authorized use only">
          Only assess targets you are authorized to test. See <DocLink href="/docs/guardrails/authorized-use">Authorized use</DocLink>.
        </Callout>
      </DocSection>

      <DocSection title="Where things are">
        <ul>
          <li>
            The terminal: <Mono>python -m reconix</Mono> (or <Mono>reconix</Mono>, or <Mono>python run.py</Mono>). See{" "}
            <DocLink href="/docs/getting-started/launching">Launching</DocLink>.
          </li>
          <li>
            Reports: <Mono>./reports/&lt;assessment id&gt;.&lt;ext&gt;</Mono>, in the folder you launched from. See{" "}
            <DocLink href="/docs/reports/exporting">Exporting</DocLink>.
          </li>
          <li>
            Saved copies of every run, with secrets removed: <Mono>~/.reconix/assessments/</Mono>; the web dashboard
            (<Mono>/web</Mono>) reads them. See <DocLink href="/docs/reports/dashboard">The web dashboard</DocLink>.
          </li>
          <li>
            Model settings: <Mono>~/.reconix/llm.db</Mono>, with API keys encrypted. See{" "}
            <DocLink href="/docs/ai-models/configuration">Configuration</DocLink>.
          </li>
        </ul>
      </DocSection>

      <DocSection title="Browse the docs">
        <DocGroupCards groups={DOCS_NAV.filter((g) => g.id !== "overview")} />
      </DocSection>
    </DocsLayout>
  );
}
