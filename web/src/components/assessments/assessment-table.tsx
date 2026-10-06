/* Saved assessments as a table; each row opens the assessment. `compact` is the short
   version on the overview. */
import Link from "next/link";

import type { Assessment } from "@/lib/data/schema";
import { approvalRows, blockedVerdicts, durationMs } from "@/lib/data/stats";
import { formatDuration, formatShort } from "@/lib/format";

import { SeverityMix } from "../findings/severity-mix";
import { Chip, DecisionChip, StatusChip } from "../neu/chips";
import { TableWrap } from "../neu/table-wrap";

export function AssessmentTable({ assessments, compact }: { assessments: Assessment[]; compact?: boolean }) {
  if (!assessments.length) return <p className="text-[13px] text-muted">No assessments match.</p>;
  return (
    <TableWrap label="Assessments table">
      <table className="data">
        <thead>
          <tr>
            <th>Assessment</th>
            <th>Target</th>
            <th>Status</th>
            {!compact && <th>Duration</th>}
            <th>Findings</th>
            {!compact && <th className="text-right">Checks / blocked</th>}
            {!compact && <th>Approvals</th>}
            {!compact && <th>Report</th>}
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
              <td className="min-w-[180px]">
                <span className="font-medium [overflow-wrap:anywhere]">{a.target || "—"}</span>
                <span className="cell-sub">{a.template.name || "template not chosen"}</span>
              </td>
              <td>
                <StatusChip status={a.status} />
              </td>
              {!compact && <td className="whitespace-nowrap font-mono text-[12.5px]">{formatDuration(durationMs(a))}</td>}
              <td>
                <SeverityMix findings={a.findings} />
              </td>
              {!compact && (
                <td className="text-right font-mono text-[12.5px] tabular-nums">
                  {a.verdicts.length} / {blockedVerdicts(a).length}
                </td>
              )}
              {!compact && (
                <td>
                  <span className="flex flex-wrap gap-1.5">
                    {approvalRows([a]).map((r) => (
                      <span key={r.approval.request_id} title={`${r.approval.risk}: ${r.approval.action}`}>
                        <DecisionChip state={r.state} />
                      </span>
                    ))}
                    {!a.approvals.length && <span className="text-faint">—</span>}
                  </span>
                </td>
              )}
              {!compact && (
                <td>{a.run.report_path ? <Chip tone="ok">{a.run.report_path.split(".").pop()}</Chip> : <span className="text-faint">—</span>}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
