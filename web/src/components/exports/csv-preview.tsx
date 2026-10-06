/* The CSV as a real table (the same rows the file is built from), with the raw text below. */
import { plural } from "@/lib/format";

import { TableWrap } from "../neu/table-wrap";

export function CsvPreview({ rows, raw }: { rows: string[][]; raw: string }) {
  const [header, ...body] = rows;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12.5px] text-muted">
        {plural(body.length, "row")} · {plural(header.length, "column")}
      </p>
      <TableWrap label="CSV preview">
        <table className="data min-w-[1100px] text-[12.5px]">
          <thead>
            <tr>
              {header.map((cell) => (
                <th key={cell}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, i) => (
              <tr key={row[0] || i}>
                {row.map((cell, j) => (
                  <td key={header[j]} className="max-w-[320px] align-top [overflow-wrap:anywhere]">
                    {cell || <span className="text-faint">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <details className="text-[13px]">
        <summary className="cursor-pointer text-muted hover:text-text">Raw CSV</summary>
        <pre className="evidence mt-3 max-h-[40vh] overflow-auto" tabIndex={0}>
          {raw}
        </pre>
      </details>
    </div>
  );
}
