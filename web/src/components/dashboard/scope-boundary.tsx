/* One run's boundary: the target the scope allows, with its approval state and the ports it may
   touch, and the paths it must leave alone. Icons and words carry the meaning, not colour. */
import { Check, X } from "lucide-react";

import { ChipList } from "@/components/dashboard/chip-panel";
import { DashCard } from "@/components/dashboard/dash-card";
import type { Boundary } from "@/components/dashboard/scope-types";
import { StatusBadge } from "@/components/ui/status-badge";

export function ScopeBoundary({ data }: { data: Extract<Boundary, { mode: "run" }> }) {
  return (
    <DashCard id="scope-boundary" title="Boundary" docsHref="/docs/assessment-guide/scope" className="dash-panel" bodyClassName="flex flex-col gap-4">
      <div>
        <h3 className="dash-subhead">
          <Check className="size-3.5 text-success" aria-hidden /> In scope
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 font-mono text-sm text-foreground [overflow-wrap:anywhere]">{data.target}</span>
          <StatusBadge meaning={data.state} />
        </div>
        <div className="mt-2.5">
          {data.ports.length ? (
            <ChipList label="Allowed ports" chips={data.ports.map((p) => ({ label: `port ${p}`, count: null, title: `Port ${p} may be tested` }))} />
          ) : (
            <p className="text-xs text-muted-foreground">The template&apos;s default ports.</p>
          )}
        </div>
      </div>
      <div>
        <h3 className="dash-subhead">
          <X className="size-3.5 text-danger" aria-hidden /> Excluded
        </h3>
        {data.exclude.length ? (
          <ul aria-label="Excluded paths" className="flex flex-col gap-1.5">
            {data.exclude.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <X className="size-3.5 shrink-0 text-danger" aria-hidden />
                <span className="min-w-0 font-mono text-xs text-foreground [overflow-wrap:anywhere]">{p}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Nothing excluded.</p>
        )}
      </div>
    </DashCard>
  );
}
