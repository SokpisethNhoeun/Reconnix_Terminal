/* Approval decisions: who approved what, why, and the request hash it was bound to. */
import type { ApprovalRow } from "@/lib/data/stats";
import { formatShort } from "@/lib/format";

import { DecisionChip, SeverityChip } from "../neu/chips";
import { TableWrap } from "../neu/table-wrap";

/** "sha256:abcd…1234" → "abcd…1234": the algorithm is shown as the label, not twice. */
const shortHash = (hash: string) => {
  const hex = hash.replace(/^sha256:/, "");
  return hex.length > 12 ? `${hex.slice(0, 4)}…${hex.slice(-4)}` : hex;
};

export function ApprovalsTable({ rows, showAssessment }: { rows: ApprovalRow[]; showAssessment?: boolean }) {
  if (!rows.length) return <p className="text-[13px] text-muted">No approval was needed yet.</p>;
  return (
    <TableWrap label="Approval decisions table">
      <table className="data">
        <thead>
          <tr>
            {showAssessment && <th>Assessment</th>}
            <th>Risk</th>
            <th>Action</th>
            <th>Decision</th>
            <th>Reason</th>
            <th>Bound to</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ assessment, approval, state, decision }) => (
            <tr key={`${assessment.uid}~${approval.request_id}`}>
              {showAssessment && (
                <td className="whitespace-nowrap">
                  <span className="font-mono text-[12.5px] font-medium">{assessment.label}</span>
                  <span className="cell-sub">{assessment.target}</span>
                </td>
              )}
              <td>
                <SeverityChip severity={approval.risk === "HIGH" ? "HIGH" : "MEDIUM"} />
              </td>
              <td>
                <span className="font-mono text-[12.5px]">{approval.action}</span>
                <span className="cell-sub [overflow-wrap:anywhere]">{approval.target}</span>
              </td>
              <td className="whitespace-nowrap">
                <DecisionChip state={state} />
                <span className="cell-sub">{decision ? `${decision.operator} · ${formatShort(decision.at)}` : "waiting in the TUI"}</span>
              </td>
              <td>{decision?.reason || "—"}</td>
              <td className="whitespace-nowrap font-mono text-[12px] text-muted" title={approval.command_hash}>
                sha256 {shortHash(approval.command_hash)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
