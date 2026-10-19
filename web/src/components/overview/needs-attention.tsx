/* What the operator should look at next: decisions a run is waiting on in the TUI first,
   then the open critical and high findings still to review, worst first. Each row carries a
   tag, one line of context, and a button to the place that acts on it. */
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import type { Assessment } from "@/lib/data/schema";
import { attentionFeed, effectiveSeverity } from "@/lib/data/stats";
import { formatDay, timeAgo } from "@/lib/format";
import { TERMINAL_PAGE } from "@/lib/terminal/paths";
import { cn } from "@/lib/utils";

import { Badge } from "../neu/chips";

function Row({
  tag,
  title,
  sub,
  action,
}: {
  tag: ReactNode;
  title: string;
  sub: string;
  action: ReactNode;
}) {
  return (
    <li className="well feed-row" title={`${title} — ${sub}`}>
      <span className="feed-badge">{tag}</span>
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[13.5px] font-semibold">{title}</b>
        <span className="block truncate text-[12.5px] text-muted">{sub}</span>
      </div>
      {action}
    </li>
  );
}

export function NeedsAttention({ assessments, limit, operator }: { assessments: Assessment[]; limit: number; operator: boolean }) {
  const items = attentionFeed(assessments);
  if (!items.length) {
    return <p className="text-[13px] text-muted">Nothing is waiting, and every critical and high finding is confirmed.</p>;
  }
  const more = items.length - limit;
  return (
    <ul className="m-0 flex flex-1 list-none flex-col gap-2.5 p-0">
      {items.slice(0, limit).map((item) => {
        if (item.kind === "decision") {
          const a = item.assessment;
          const what = a.waiting_for ? `${a.waiting_for[0].toUpperCase()}${a.waiting_for.slice(1)}` : "Approve the scan plan";
          return (
            <Row
              key={`d-${a.uid}`}
              tag={
                <Badge tone="warn" solid>
                  Decision
                </Badge>
              }
              title={`${a.label} needs your decision`}
              sub={`${what} for ${a.target} · ${timeAgo(a.saved_at)}`}
              action={
                operator ? (
                  <Link href={TERMINAL_PAGE} className={cn(buttonVariants({ variant: "accent", size: "sm" }), "flex-none")}>
                    Continue in AI
                    <ArrowRight size={15} aria-hidden />
                  </Link>
                ) : (
                  <Link href={`/assessments/${a.uid}`} className={cn(buttonVariants({ variant: "default", size: "sm" }), "flex-none")}>
                    View
                  </Link>
                )
              }
            />
          );
        }
        const f = item.finding;
        const a = f.assessment;
        const sev = effectiveSeverity(f);
        return (
          <Row
            key={`f-${f.key}`}
            tag={
              <Badge severity={sev} solid>
                {sev}
              </Badge>
            }
            title={f.title}
            sub={`${a.label} · ${a.target} · found ${formatDay(a.created_at)} · need review`}
            action={
              <Link href={`/assessments/${a.uid}`} className={cn(buttonVariants({ variant: "default", size: "sm" }), "flex-none")}>
                View
              </Link>
            }
          />
        );
      })}
      {more > 0 && (
        <li className="mt-auto px-1 pt-0.5 text-[12.5px] text-muted">
          and {more} more to review
        </li>
      )}
    </ul>
  );
}
