/* Findings per severity as numbers: how many, how many confirmed, how many still for
   review. Sits under the severity bars on the overview. */
import { type Finding, SEVERITIES } from "@/lib/data/schema";
import { isConfirmed } from "@/lib/data/stats";
import { cn } from "@/lib/utils";

import { SeverityChip } from "../neu/chips";
import { TableWrap } from "../neu/table-wrap";

export function SeverityTable({ findings }: { findings: Finding[] }) {
  const rows = SEVERITIES.map((severity) => {
    const of = findings.filter((f) => f.severity === severity);
    const confirmed = of.filter(isConfirmed).length;
    return { severity, total: of.length, confirmed, review: of.length - confirmed };
  });
  return (
    <TableWrap label="Findings by severity table" className="mt-auto">
      <table className="data dense">
        <thead>
          <tr>
            <th>Severity</th>
            <th className="text-right">Findings</th>
            <th className="text-right">Confirmed</th>
            <th className="text-right">For review</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.severity}>
              <td>
                <SeverityChip severity={r.severity} />
              </td>
              {[r.total, r.confirmed, r.review].map((n, i) => (
                <td key={i} className={cn("text-right font-mono tabular-nums", !n && "text-muted")}>
                  {n}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
