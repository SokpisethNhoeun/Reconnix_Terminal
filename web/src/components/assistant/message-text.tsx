/* A model reply as React elements: paragraphs, bullet and numbered lists, headings, code
   blocks, **bold** and `code`. Everything else stays plain text: the reply is never parsed as
   HTML (no dangerouslySetInnerHTML), so nothing in it can run or link anywhere. */
import { Fragment } from "react";

export type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; text: string };

const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d{1,3}[.)]\s+/;
const HEADING = /^\s*#{1,4}\s+/;

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
    if (line.trim().startsWith("```")) {
      flush();
      const code: string[] = [];
      for (i += 1; i < lines.length && !lines[i].trim().startsWith("```"); i++) code.push(lines[i]);
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }
    if (!line.trim()) {
      flush();
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
    if (HEADING.test(line)) {
      flush();
      blocks.push({ kind: "h", text: line.replace(HEADING, "") });
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

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={i} className="font-medium text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
          <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">
            {part.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function MessageText({ text }: { text: string }) {
  return (
    <div className="space-y-2 [overflow-wrap:anywhere]">
      {parseBlocks(text).map((b, i) => {
        if (b.kind === "code")
          return (
            <pre key={i} className="dash-tile overflow-x-auto p-2.5 font-mono text-[12px] leading-relaxed text-foreground" data-lenis-prevent>
              {b.text}
            </pre>
          );
        if (b.kind === "ul" || b.kind === "ol") {
          const List = b.kind;
          return (
            <List key={i} className={`space-y-1 pl-5 ${b.kind === "ul" ? "list-disc" : "list-decimal"}`}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} />
                </li>
              ))}
            </List>
          );
        }
        if (b.kind === "h")
          return (
            <p key={i} className="font-medium text-foreground">
              <Inline text={b.text} />
            </p>
          );
        return (
          <p key={i}>
            <Inline text={b.text} />
          </p>
        );
      })}
    </div>
  );
}
