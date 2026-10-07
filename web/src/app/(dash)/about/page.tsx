/* About: the project explained for someone opening this dashboard for the first time. Plain
   words first (what Reconix is, how an assessment runs, the safety gates), then how the
   pieces fit and notes for developers. Reads no saved data, but needs the viewer role like
   every page (the proxy checks first; this is the second lock). */
import type { Metadata } from "next";

import { AboutIntro } from "@/components/about/about-intro";
import { CodeMap } from "@/components/about/code-map";
import { DataPaths } from "@/components/about/data-paths";
import { DevNotes } from "@/components/about/dev-notes";
import { FlowSteps } from "@/components/about/flow-steps";
import { Glossary } from "@/components/about/glossary";
import { SafetyGates } from "@/components/about/safety-gates";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/layout/page-section";
import { currentRole, requireViewer } from "@/lib/auth/guard";
import { mayUseTerminal } from "@/lib/auth/session";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  await requireViewer();
  const operator = mayUseTerminal(await currentRole());
  return (
    <>
      <PageHeader title="About Reconix" sub="What this project is, how an assessment runs, and how the pieces fit" live={false} />
      <AboutIntro operator={operator} />

      <PageSection
        id="workflow"
        eyebrow="Workflow"
        title="How an assessment runs"
        lede="Eight screens in the terminal app, in this order. The run keeps playing while you move between them; when it reaches a gate, the screen that decides it opens."
      >
        <FlowSteps />
      </PageSection>

      <PageSection
        id="guardrails"
        eyebrow="Guardrails"
        title="Safety gates"
        lede="Authorized testing only. The store is the authority; the screens only ask."
      >
        <SafetyGates />
      </PageSection>

      <PageSection
        id="architecture"
        eyebrow="Architecture"
        title="How the pieces fit"
        lede="One store decides. The terminal app shows it as it runs, and this dashboard reads the copies it saves."
      >
        <DataPaths />
      </PageSection>

      <PageSection id="developers" eyebrow="For developers" title="Code map and commands">
        <CodeMap />
        <DevNotes />
      </PageSection>

      <PageSection id="glossary" eyebrow="Glossary" title="Words you'll see">
        <Glossary />
      </PageSection>
    </>
  );
}
