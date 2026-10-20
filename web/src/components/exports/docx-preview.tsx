/* The Word document's content, from the same blocks the .docx is built from, so what you
   check is what you download. Its page look comes from Word; this shows the text and tables. */
import type { DocBlock } from "@/lib/report/docx-blocks";

import { TableWrap } from "../neu/table-wrap";

function Block({ block }: { block: DocBlock }) {
  switch (block.kind) {
    case "title":
      return <h2 className="m-0 font-display text-[22px] font-semibold text-text">{block.text}</h2>;
    case "subtitle":
      return <p className="m-0 text-[14px] text-muted">{block.text}</p>;
    case "h1":
      return <h3 className="m-0 mt-3 font-display text-[17px] font-semibold text-text">{block.text}</h3>;
    case "h2":
      return <h4 className="m-0 mt-2 text-[14.5px] font-semibold text-text">{block.text}</h4>;
    case "note":
      return <p className="m-0 text-[12px] font-semibold tracking-wide text-muted uppercase">{block.text}</p>;
    case "quote":
      return <pre className="evidence m-0 whitespace-pre-wrap">{block.text}</pre>;
    case "table":
      return (
        <TableWrap label="Document table">
          <table className="data text-[12.5px]">
            {block.head && (
              <thead>
                <tr>
                  {block.head.map((cell) => (
                    <th key={cell}>{cell}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={`${row[0]}-${i}`}>
                  {row.map((cell, j) => (
                    <td key={j} className="max-w-[420px] align-top [overflow-wrap:anywhere]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      );
    default:
      return <p className="m-0 text-[13.5px] [overflow-wrap:anywhere] text-text">{block.text}</p>;
  }
}

export function DocxPreview({ blocks }: { blocks: DocBlock[] }) {
  return (
    <div className="flex max-h-[72vh] flex-col gap-2.5 overflow-auto pr-1" tabIndex={0}>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}
