/* The approval requests of gated (risky) actions: what and where, its risk and its state, as
   badges. Across runs each row names its run (it opens that run's Scope) and the waiting ones
   come first. Approvals are only ever given in the TUI. */
import { DashCard } from "@/components/dashboard/dash-card";
import { RunLinkTo } from "@/components/dashboard/run-link";
import type { ScopeCards } from "@/components/dashboard/scope-types";
import { StatusBadge } from "@/components/ui/status-badge";

export function ApprovalList({ data }: { data: ScopeCards["approvals"] }) {
  return (
    <DashCard id="scope-approvals" title="Approval requests" docsHref="/docs/guardrails/approval-model" meta={data.meta} className="dash-panel" bodyClassName="flex flex-col gap-2">
      {data.rows.length ? (
        <ul aria-label="Approval requests" className="flex flex-col">
          {data.rows.map((a) => (
            <li key={a.key} className="dash-approval">
              <span className="min-w-0">
                <span className="block text-[13px] text-foreground [overflow-wrap:anywhere]">{a.action}</span>
                <span className="block font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{a.target}</span>
                {a.run && (
                  <RunLinkTo uid={a.run.uid} label={`Open the scope of ${a.run.label}`} className="font-mono text-[11px] text-primary underline-offset-2 hover:underline">
                    {a.run.label}
                  </RunLinkTo>
                )}
              </span>
              <span className="flex flex-wrap justify-end gap-1.5">
                <StatusBadge meaning={a.risk} />
                <StatusBadge meaning={a.state} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{data.empty}</p>
      )}
      {data.more > 0 && (
        <p className="mt-auto text-[11px] text-muted-foreground">
          {data.more} more · open a run to see all of its requests (waiting ones are listed first).
        </p>
      )}
    </DashCard>
  );
}
