/* The AI Assistant page: a visual mock of the Reconix chat. The transcript, the scope
   manifest, the approval gate and the running rail are read from a real assessment (the one
   waiting for a decision), so it mirrors what the terminal app shows. Nothing here acts;
   assessments are driven from the terminal app. */
import { Diamond } from "lucide-react";

import type { Assessment } from "@/lib/data/schema";
import { approvalRows } from "@/lib/data/stats";
import { templateLabel } from "@/lib/templates";

import { ApprovalGate } from "./approval-gate";
import { Composer } from "./composer";
import { FlowSteps } from "./flow-steps";
import { RunningPanel } from "./running-panel";
import { ScopeManifest } from "./scope-manifest";

function kindWord(kind: string, template: string): string {
  const k = `${kind} ${template}`.toLowerCase();
  if (k.includes("web")) return "web application";
  if (k.includes("api")) return "API";
  if (k.includes("network")) return "network range";
  if (k.includes("code") || k.includes("source")) return "source repository";
  return "target";
}

export function AssistantView({ assessment: a }: { assessment: Assessment }) {
  const pending = approvalRows([a]).find((r) => r.state === "PENDING") ?? approvalRows([a])[0];
  const userSaid = a.timeline.find((e) => e.type === "chat" && e.who === "you")?.text || `scan ${a.target}`;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="card">
          <FlowSteps status={a.status} />
        </div>

        <div className="flex flex-col gap-5">
          <p className="chat-you">{userSaid}</p>

          <div className="flex gap-3">
            <span className="eyebrow mt-0.5 flex flex-none items-center gap-1.5">
              <Diamond size={12} aria-hidden />
              reconix
            </span>
            <p className="text-[13.5px] leading-relaxed [overflow-wrap:anywhere]">
              Target identified: {a.target} ({kindWord(a.target_kind, a.template.name)}). Suggested template:{" "}
              {a.template.name ? templateLabel(a.template.name) : "Web"}.
            </p>
          </div>

          {a.scope && <ScopeManifest assessment={a} />}
          {pending && <ApprovalGate approval={pending.approval} />}
        </div>

        <Composer />
      </div>

      <RunningPanel assessment={a} />
    </div>
  );
}
