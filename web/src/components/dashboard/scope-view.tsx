/* The Scope view, for one run or every saved run (ScopeCards, derive-scope.ts), in the Overview's
   style: the summary strip, then the boundary (one run's target, ports and exclusions, or every
   target tested), the approval requests, the permitted actions and tools, and the limits.
   Server component. */
import { ApprovalList } from "@/components/dashboard/approval-list";
import { ChipPanel } from "@/components/dashboard/chip-panel";
import { DashCard } from "@/components/dashboard/dash-card";
import { ScopeBoundary } from "@/components/dashboard/scope-boundary";
import { ScopeTargets } from "@/components/dashboard/scope-targets";
import type { ScopeCards } from "@/components/dashboard/scope-types";
import { StatMeter } from "@/components/dashboard/stat-card";
import { StatStrip } from "@/components/dashboard/stat-strip";
import { DocsLink, ViewHeader } from "@/components/dashboard/view-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TIME_LIMIT } from "@/lib/status";

const MANIFEST_DOCS = "/docs/configuration/scope-manifest";

export function ScopeView({ data }: { data: ScopeCards }) {
  const { usage } = data.limits;
  return (
    <div className="dash-view dash-sheet" data-mode={data.mode}>
      <ViewHeader title="Scope" tag={data.tag} about={data.about}>
        <DocsLink href={MANIFEST_DOCS}>Scope Manifest</DocsLink>
      </ViewHeader>

      {data.empty ? (
        <DashCard id="scope-empty" title="No Scope Manifest" docsHref={MANIFEST_DOCS}>
          <p className="text-sm text-muted-foreground">{data.empty}</p>
        </DashCard>
      ) : (
        <>
          <StatStrip stats={data.stats} label="Scope summary" />
          <div className="dash-panels">
            {data.boundary.mode === "run" ? <ScopeBoundary data={data.boundary} /> : <ScopeTargets data={data.boundary} />}
            <ApprovalList data={data.approvals} />
            <ChipPanel
              id="scope-permitted"
              title="Permitted actions"
              docsHref={MANIFEST_DOCS}
              meta={data.mode === "all" ? "in how many runs" : undefined}
              groups={[
                { label: "Actions", chips: data.permitted.actions, empty: "No action listed." },
                { label: "Tools", chips: data.permitted.tools, empty: "No tool approved." },
              ]}
            />
            <ChipPanel
              id="scope-limits"
              title="Limits"
              docsHref="/docs/configuration/policies"
              meta={data.mode === "all" ? "in how many runs" : undefined}
              groups={data.limits.rows.map((r) => ({ ...r, empty: r.label === "Window" ? "No time limit." : "None listed." }))}
            >
              {usage && (
                <div className="mt-auto flex flex-col gap-1.5">
                  <h3 className="dash-subhead">Time used</h3>
                  <StatMeter frac={usage.frac} color={usage.over ? "var(--danger)" : "var(--primary)"} label="Time used of the window" />
                  <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    {usage.caption}
                    {usage.over && <StatusBadge meaning={TIME_LIMIT.over} />}
                  </p>
                </div>
              )}
            </ChipPanel>
          </div>
        </>
      )}
    </div>
  );
}
