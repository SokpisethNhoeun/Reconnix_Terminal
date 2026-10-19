/* The dashboard's "Recent assessments": the latest runs with their target, template, status
   and the strongest severity found. Each row opens the assessment. */
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { Assessment } from "@/lib/data/schema";
import { highestSeverity, isLive } from "@/lib/data/stats";
import { formatShort } from "@/lib/format";
import { templateLabel } from "@/lib/templates";
import { cn } from "@/lib/utils";

import { Chip, StatusChip } from "../neu/chips";
import { TableWrap } from "../neu/table-wrap";

function HighestSeverity({ assessment }: { assessment: Assessment }) {
  const top = highestSeverity(assessment);
  if (top) {
    const label = top.severity[0] + top.severity.slice(1).toLowerCase();
    return (
      <Chip severity={top.severity}>
        {top.count} {label}
      </Chip>
    );
  }
  if (isLive(assessment)) return <span className="font-mono text-[12.5px] text-muted">Scanning…</span>;
  return <span className="text-faint">None</span>;
}

export function RecentAssessments({ assessments }: { assessments: Assessment[] }) {
  if (!assessments.length) return <p className="text-[13px] text-muted">No assessments yet.</p>;
  return (
    <TableWrap label="Recent assessments table">
      <table className="data">
        <thead>
          <tr>
            <th>Assessment</th>
            <th>Target</th>
            <th>Template</th>
            <th>Status</th>
            <th>Highest severity</th>
            <th className="text-right">Open</th>
          </tr>
        </thead>
        <tbody>
          {assessments.map((a) => (
            <tr key={a.uid} className="row-link">
              <td className="whitespace-nowrap">
                <Link href={`/assessments/${a.uid}`} className="stretch font-mono font-medium">
                  {a.label}
                </Link>
                <span className="cell-sub">{formatShort(a.created_at)}</span>
              </td>
              <td className="min-w-[160px]">
                <span className="font-medium [overflow-wrap:anywhere]">{a.target || "—"}</span>
              </td>
              <td className="whitespace-nowrap text-[13px] text-muted">{a.template.name ? templateLabel(a.template.name) : "—"}</td>
              <td>
                <StatusChip status={a.status} />
              </td>
              <td>
                <HighestSeverity assessment={a} />
              </td>
              <td className="text-right">
                <Link
                  href={`/assessments/${a.uid}`}
                  className={cn(buttonVariants({ variant: "default", size: "sm" }), "relative")}
                  tabIndex={-1}
                  aria-hidden
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
