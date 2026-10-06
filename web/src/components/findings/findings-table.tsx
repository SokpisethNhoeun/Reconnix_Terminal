/* Findings as a table; each row selects the finding shown in the detail card next to it. */
import Link from "next/link";

import type { FindingRow } from "@/lib/data/stats";

import { Cvss, SeverityChip, TriageChip, ValidationChip } from "../neu/chips";
import { TableWrap } from "../neu/table-wrap";

interface Props {
  rows: FindingRow[];
  selected?: string;
  hrefFor: (row: FindingRow) => string;
  showAssessment?: boolean;
}

export function FindingsTable({ rows, selected, hrefFor, showAssessment }: Props) {
  if (!rows.length) return <p className="text-[13px] text-muted">No findings match these filters.</p>;
  return (
    <TableWrap label="Findings table">
      <table className="data">
        <thead>
          <tr>
            <th>Severity</th>
            <th>CVSS</th>
            <th className="min-w-[200px]">Finding</th>
            {showAssessment && <th>Assessment</th>}
            <th>Validation</th>
            {!showAssessment && <th>Tool</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.key} className="row-link" aria-current={f.key === selected ? "true" : undefined}>
              <td>
                <SeverityChip severity={f.severity} />
              </td>
              <td className="font-mono text-[13px] tabular-nums">
                <Cvss score={f.cvss_score} />
              </td>
              <td>
                <Link href={hrefFor(f)} scroll={false} className="stretch font-medium">
                  {f.title}
                </Link>
                <span className="cell-sub flex flex-wrap items-center gap-2 [overflow-wrap:anywhere]">
                  <span>
                    {f.id} · {f.path}
                  </span>
                  {f.status !== "open" && <TriageChip status={f.status} />}
                </span>
              </td>
              {showAssessment && (
                <td className="min-w-[150px]">
                  <span className="font-mono text-[12.5px] font-medium whitespace-nowrap">{f.assessment.label}</span>
                  <span className="cell-sub [overflow-wrap:anywhere]">{f.assessment.target}</span>
                </td>
              )}
              <td>
                <ValidationChip validation={f.validation} />
              </td>
              {!showAssessment && <td className="text-muted">{f.tool}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
