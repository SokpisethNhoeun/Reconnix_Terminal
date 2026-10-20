/* A model reply as React elements: paragraphs, headings, bullet and numbered lists, quotes,
   tables (they scroll sideways), code blocks (language label and Copy), **bold**, *italic* and
   `code`. Everything else stays plain text: the reply is never parsed as HTML (no
   dangerouslySetInnerHTML), and Markdown links stay text, so nothing in it can run or link
   anywhere. */
import { Fragment } from "react";

import { CodeBlock } from "./code-block";

export type Align = "left" | "center" | "right" | null;

export type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; level: 3 | 4; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "hr" }
  | { kind: "code"; lang: string; text: string }
  | { kind: "table"; head: string[]; align: Align[]; rows: string[][] };

const BULLET = /^\s*[-*•+]\s+/;
const NUMBER = /^\s*\d{1,3}[.)]\s+/;
const HEADING = /^\s*(#{1,6})\s+/;
const QUOTE = /^\s*>\s?/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const FENCE = /^\s*(```|~~~)\s*([\w+#.-]{0,24})/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const MAX_COLUMNS = 12;

/** The cells of a table line ("| a | b |" → ["a", "b"]); `\|` stays a bar inside a cell. */
export function cells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  return trimmed
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"))
    .slice(0, MAX_COLUMNS);
}

const alignOf = (sep: string): Align => {
  const s = sep.trim();
  if (s.startsWith(":") && s.endsWith(":")) return "center";
  if (s.endsWith(":")) return "right";
  return s.startsWith(":") ? "left" : null;
};

/** Splits reply text into blocks (pure; unit-tested). */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const code: string[] = [];
      const close = fence[1];
      for (i += 1; i < lines.length && !lines[i].trim().startsWith(close); i++) code.push(lines[i]);
      blocks.push({ kind: "code", lang: fence[2].toLowerCase(), text: code.join("\n") });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    // a table: a line with bars, then a separator line (| --- | :-: |)
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("|")) {
      flush();
      const head = cells(line);
      const align = cells(lines[i + 1]).map(alignOf);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i].includes("|") && lines[i].trim(); i++) {
        const row = cells(lines[i]);
        rows.push(head.map((_, c) => row[c] ?? ""));
      }
      i -= 1;
      blocks.push({ kind: "table", head, align: head.map((_, c) => align[c] ?? null), rows });
      continue;
    }
    if (RULE.test(line)) {
      flush();
      blocks.push({ kind: "hr" });
      continue;
    }
    const list = BULLET.test(line) ? "ul" : NUMBER.test(line) ? "ol" : null;
    if (list) {
      flush();
      const item = line.replace(list === "ul" ? BULLET : NUMBER, "");
      const last = blocks[blocks.length - 1];
      if (last && last.kind === list) last.items.push(item);
      else blocks.push({ kind: list, items: [item] });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "h", level: heading[1].length <= 2 ? 3 : 4, text: line.replace(HEADING, "").replace(/\s+#+\s*$/, "") });
      continue;
    }
    if (QUOTE.test(line)) {
      flush();
      const text = line.replace(QUOTE, "");
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "quote") last.text += ` ${text}`;
      else blocks.push({ kind: "quote", text });
      continue;
    }
    const last = blocks[blocks.length - 1];
    // a wrapped line right under a list item belongs to it
    if (!para.length && last && (last.kind === "ul" || last.kind === "ol") && /^\s{2,}/.test(line)) {
      last.items[last.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|(?<![*\w])\*(?![\s*])[^*\n]+?(?<![\s*])\*(?![*\w]))/g;

function Inline({ text }: { text: string }) {
  const parts = text.split(INLINE);
  return (
    <>
      {parts.map((part, i) => {
        if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
        if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

export function MessageText({ text }: { text: string }) {
  return (
    <div className="ai-prose">
      {parseBlocks(text).map((b, i) => {
        switch (b.kind) {
          case "code":
            return <CodeBlock key={i} lang={b.lang} code={b.text} />;
          case "table":
            return (
              <div key={i} className="ai-table-wrap" tabIndex={0} role="region" aria-label="Table" data-lenis-prevent>
                <table className="ai-table">
                  <thead>
                    <tr>
                      {b.head.map((h, c) => (
                        <th key={c} scope="col" data-align={b.align[c] ?? undefined}>
                          <Inline text={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c} data-align={b.align[c] ?? undefined}>
                            <Inline text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "ul":
          case "ol": {
            const List = b.kind;
            return (
              <List key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inline text={item} />
                  </li>
                ))}
              </List>
            );
          }
          case "h": {
            const Heading = b.level === 3 ? "h3" : "h4";
            return (
              <Heading key={i}>
                <Inline text={b.text} />
              </Heading>
            );
          }
          case "quote":
            return (
              <blockquote key={i}>
                <Inline text={b.text} />
              </blockquote>
            );
          case "hr":
            return <hr key={i} />;
          default:
            return (
              <p key={i}>
                <Inline text={b.text} />
              </p>
            );
        }
      })}
    </div>
  );
}
