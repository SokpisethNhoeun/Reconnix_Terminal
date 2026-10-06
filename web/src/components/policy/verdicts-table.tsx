/* Policy engine decisions on proposed requests (allowed or blocked, and why). */
import type { Assessment } from "@/lib/data/schema";
import { formatClock, formatShort } from "@/lib/format";

import { VerdictChip } from "../neu/chips";
import { TableWrap } from "../neu/table-wrap";

type Verdict = Assessment["verdicts"][number];

export function VerdictsTable({ rows }: { rows: { assessment?: Assessment; verdict: Verdict }[] }) {
  if (!rows.length) return <p className="text-[13px] text-muted">No requests were checked yet.</p>;
  const showAssessment = rows.some((r) => r.assessment);
  return (
    <TableWrap label="Policy checks table">
      <table className="data">
        <thead>
          <tr>
            {showAssessment ? <th>Assessment</th> : <th>Time</th>}
            <th>Verdict</th>
            <th>Request</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ assessment, verdict }, i) => (
            <tr key={`${assessment?.uid ?? ""}~${i}`}>
              {showAssessment && assessment ? (
                <td className="whitespace-nowrap">
                  <span className="font-mono text-[12.5px] font-medium">{assessment.label}</span>
                  <span className="cell-sub">{formatShort(verdict.at ?? assessment.created_at)}</span>
                </td>
              ) : (
                <td className="whitespace-nowrap font-mono text-[12px] text-muted">{formatClock(verdict.at)}</td>
              )}
              <td>
                <VerdictChip allowed={verdict.allowed} />
              </td>
              <td className="font-mono text-[12.5px] [overflow-wrap:anywhere]">
                {verdict.method} {verdict.path}
              </td>
              <td className={verdict.allowed ? "text-muted" : undefined}>{verdict.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
