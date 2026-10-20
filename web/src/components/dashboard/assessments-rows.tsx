/* One page of saved runs, each a link to that run's Overview (`/?uid=…`, no view): ID and template,
   when and target, the status badge (what the run waits on as its tooltip), findings with the worst
   severity, and plan steps done of total. Cards on phones, two to a row from 640 px, and one
   table-like row each from 1024 px (assessments.css); the cell labels become a header row there. */
import Link from "next/link";

import type { ReportRunRow } from "@/components/dashboard/report-types";
import { SeverityBadge, StatusBadge } from "@/components/ui/status-badge";
import { RUN_STATUS } from "@/lib/status";

const COLUMNS = ["Run", "Target", "Status", "Findings", "Plan"] as const;

/** The Overview of one run: its address, with no view and none of this view's filters. */
export const runOverviewHref = (uid: string) => `/?uid=${encodeURIComponent(uid)}`;

export function AssessmentsRows({ rows }: { rows: ReportRunRow[] }) {
  return (
    <div className="asm-table">
      <div className="asm-head" aria-hidden="true">
        {COLUMNS.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <ul aria-label="Saved assessments" className="asm-list">
        {rows.map((r) => (
          <li key={r.uid}>
            <Link
              href={runOverviewHref(r.uid)}
              title={`Open the overview of ${r.id} (${r.template}, ${r.when})`}
              className="asm-row dash-finding-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="asm-cell asm-run">
                <span className="asm-k">Run</span>
                <span className="block truncate text-foreground">
                  {r.id} · {r.template}
                </span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">{r.when}</span>
              </span>
              <span className="asm-cell asm-target">
                <span className="asm-k">Target</span>
                <span className="block font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{r.target}</span>
              </span>
              <span className="asm-cell asm-status" title={r.waiting || undefined}>
                <span className="asm-k">Status</span>
                <StatusBadge meaning={RUN_STATUS[r.status]} />
                {r.waiting && <span className="sr-only">, waiting on {r.waiting}</span>}
              </span>
              <span className="asm-cell asm-findings">
                <span className="asm-k">Findings</span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span className="tabnums text-foreground">{r.findings}</span>
                  {r.worst && <SeverityBadge level={r.worst} />}
                </span>
              </span>
              <span className="asm-cell asm-plan">
                <span className="asm-k">Plan</span>
                <span className="font-mono text-[11px] tabnums text-muted-foreground">
                  {r.steps.done}/{r.steps.total}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
