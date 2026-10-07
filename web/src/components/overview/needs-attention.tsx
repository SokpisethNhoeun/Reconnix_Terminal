/* What the operator should look at next: runs waiting in the TUI, findings to review,
   stopped and interrupted runs. Shows the first `limit` (one of each kind first) and says
   how many more there are; the overview's "View all" opens the rest. */
import { CircleSlash, Clock, ShieldX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { type Assessment, SEVERITIES } from "@/lib/data/schema";
import { attentionItems } from "@/lib/data/stats";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

function Item({ icon, tone, title, children, href }: { icon: ReactNode; tone: string; title: string; children: string; href?: string }) {
  // one line of detail each, so the list keeps the height of the recent assessments next to it
  return (
    <li className="well relative flex items-center gap-3 px-3.5 py-3" title={`${title}: ${children}`}>
      <span className={cn("grid size-[30px] flex-none place-items-center rounded-[10px] text-tone shadow-[var(--raise-sm)]", tone)} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="stretch block truncate text-[13px] font-semibold">
            {title}
          </Link>
        ) : (
          <b className="block truncate text-[13px] font-semibold">{title}</b>
        )}
        <span className="block truncate text-[12.5px] text-muted">{children}</span>
      </div>
    </li>
  );
}

export function NeedsAttention({ assessments, limit }: { assessments: Assessment[]; limit: number }) {
  const { items } = attentionItems(assessments);
  if (!items.length) return <p className="text-[13px] text-muted">Nothing is waiting. Every finding is confirmed.</p>;
  const more = items.length - limit;
  return (
    <ul className="m-0 flex flex-1 list-none flex-col gap-2.5 p-0">
      {items.slice(0, limit).map((item) => {
        if (item.kind === "review") {
          const parts = SEVERITIES.filter((s) => item.bySeverity[s]).map((s) => `${item.bySeverity[s]} ${s.toLowerCase()}`);
          return (
            <Item key="review" icon={<TriangleAlert size={16} />} tone="tone-accent" title={`${plural(item.count, "finding")} need review`} href="/findings?val=review">
              {`${parts.join(", ")} not confirmed yet.`}
            </Item>
          );
        }
        const a = item.assessment;
        const href = `/assessments/${a.uid}`;
        if (item.kind === "waiting") {
          return (
            <Item key={a.uid} icon={<Clock size={16} />} tone="tone-warn" title={`${a.label} waits for you`} href={href}>
              {`${a.waiting_for ? `${a.waiting_for[0].toUpperCase()}${a.waiting_for.slice(1)}` : "A decision"} on ${a.target}. Decide it in the terminal app.`}
            </Item>
          );
        }
        if (item.kind === "stopped") {
          return (
            <Item key={a.uid} icon={<ShieldX size={16} />} tone="tone-bad" title={`${a.label} stopped`} href={href}>
              {`${a.target}: ${a.stopped_reason || "the run stopped early"}.`}
            </Item>
          );
        }
        return (
          <Item key={a.uid} icon={<CircleSlash size={16} />} tone="tone-faint" title={`${a.label} was interrupted`} href={href}>
            {`${a.target}: the terminal app closed before this run finished.`}
          </Item>
        );
      })}
      {more > 0 && <li className="mt-auto px-1 text-[12.5px] text-muted">and {more} more</li>}
    </ul>
  );
}
