/* The AI Assistant: a chat preview of Reconix in this browser tab (operators only). A
   read-only mock — the transcript fills the page and the composer stays pinned at the
   bottom. Assessments are driven from the terminal app; this page does not act. */
import type { Metadata } from "next";

import { Composer } from "@/components/assistant/composer";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/neu/card";
import { requireTerminalAccess } from "@/lib/auth/guard";
import { isLive } from "@/lib/data/stats";
import { loadLibrary } from "@/lib/data/store";
import { templateLabel } from "@/lib/templates";

export const metadata: Metadata = { title: "AI Assistant" };

export default async function AssistantPage() {
  await requireTerminalAccess();
  const { assessments } = await loadLibrary();
  // the run waiting for a decision, else the newest live run, else the newest overall
  const a =
    assessments.find((x) => x.status === "Awaiting input") ?? assessments.find(isLive) ?? assessments[0];

  if (!a) {
    return (
      <>
        <PageHeader title="AI Assistant" sub="Start an assessment in the terminal app to see it here" live={false} />
        <Card>
          <p className="text-[13px] text-muted">No assessments yet. Run one in the terminal app and it will appear here.</p>
        </Card>
      </>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col gap-6">
      <PageHeader title="AI Assistant" sub={`${a.label} · ${a.target} · ${a.template.name ? templateLabel(a.template.name) : "no template"}`} />
      <Composer />
    </div>
  );
}
