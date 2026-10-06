/* Everything that happened in one assessment, in order: chat, tool output, policy
   verdicts and the operator's decisions. All text is rendered as text. */
import type { TimelineEntry } from "@/lib/data/schema";
import { labelTimeline } from "@/lib/data/stats";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

export const TIMELINE_FILTERS = [
  { id: "all", label: "All" },
  { id: "YOU", label: "You" },
  { id: "AI", label: "AI" },
  { id: "TOOL", label: "Tools" },
  { id: "POLICY", label: "Policy" },
] as const;

const TONE: Record<string, string> = { ok: "tone-ok", warn: "tone-warn", block: "tone-bad" };

function rail(entry: TimelineEntry, who: string): string {
  if (TONE[entry.tone]) return TONE[entry.tone];
  return who === "AI" ? "tone-accent" : "";
}

export function Timeline({ entries, filter }: { entries: TimelineEntry[]; filter: string }) {
  const shown = labelTimeline(entries).filter((r) => filter === "all" || r.who === filter);
  if (!shown.length) return <p className="text-[13px] text-muted">Nothing from this source.</p>;

  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {shown.map(({ entry, who }) => (
        <li key={`${entry.type}-${entry.seq}`} className="tl">
          <span className="pt-[9px] text-right font-mono text-[11.5px] text-muted tabular-nums">{formatClock(entry.at)}</span>
          <span className="tl-rail" aria-hidden>
            <i className={cn(rail(entry, who) && `fill-tone ${rail(entry, who)}`)} />
          </span>
          <div className="flex flex-col gap-1.5 pt-1.5 pb-2.5 text-[13.5px]">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-muted">{who}</span>
            <EntryBody entry={entry} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function EntryBody({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === "card") {
    return (
      <div className="boxed max-w-[520px]">
        <div className="mb-1 text-accent">▸ {entry.text}</div>
        {entry.rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3.5 text-muted">
            <span>{label}</span>
            <b className="font-medium text-text">{value}</b>
          </div>
        ))}
      </div>
    );
  }
  if (entry.kind === "banner") {
    return <div className={cn("boxed text-tone", TONE[entry.tone] ?? "")}>{entry.text}</div>;
  }
  const prefix = entry.kind === "check" ? "✓ " : "";
  return <span className={cn(TONE[entry.tone] && `text-tone ${TONE[entry.tone]}`, entry.tone === "muted" && "text-muted")}>{prefix + entry.text}</span>;
}
