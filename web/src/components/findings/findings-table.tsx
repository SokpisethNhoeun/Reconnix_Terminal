/* Findings as a table; each row opens the finding's own page. The sub-line under the title
   is the finding's category and its first standard reference (CWE/CVE). */
import Link from "next/link";

import { effectiveSeverity, type FindingRow } from "@/lib/data/stats";
import { formatDay } from "@/lib/format";

import { Cvss, FindingStatus, SeverityChip } from "../neu/chips";
import { TableWrap } from "../neu/table-wrap";

function tags(f: FindingRow): string {
  const ref = f.cwe[0] || f.cve[0] || f.references[0] || "";
  return [f.category, ref].filter(Boolean).join(" · ");
}

export function FindingsTable({ rows }: { rows: FindingRow[] }) {
  if (!rows.length) return <p className="text-[13px] text-muted">No findings match these filters.</p>;
  return (
    <TableWrap label="Findings table">
      <table className="data">
        <thead>
          <tr>
            <th>Severity</th>
            <th className="min-w-[220px]">Finding</th>
            <th>Target</th>
            <th>Assessment</th>
            <th className="text-right">CVSS</th>
            <th>Status</th>
            <th>Found</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.key} className="row-link">
              <td>
                <SeverityChip severity={effectiveSeverity(f)} />
              </td>
              <td>
                <Link href={`/findings/${encodeURIComponent(f.key)}`} className="stretch font-medium">
                  {f.title}
                </Link>
                {tags(f) && <span className="cell-sub [overflow-wrap:anywhere]">{tags(f)}</span>}
              </td>
              <td className="min-w-[140px] [overflow-wrap:anywhere]">{f.assessment.target || "—"}</td>
              <td className="whitespace-nowrap font-mono text-[12.5px]">{f.assessment.label}</td>
              <td className="text-right font-mono text-[13px] tabular-nums">
                <Cvss score={f.cvss_score} />
              </td>
              <td>
                <FindingStatus status={f.status} validation={f.validation} />
              </td>
              <td className="whitespace-nowrap text-[12.5px] text-muted">{formatDay(f.assessment.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
