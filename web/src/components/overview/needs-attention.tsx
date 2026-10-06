/* What the operator should look at next: runs waiting in the TUI, findings to review,
   stopped runs. */
import { CircleSlash, Clock, ShieldX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { Assessment } from "@/lib/data/schema";
import { attention } from "@/lib/data/stats";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

function Item({ icon, tone, title, children, href }: { icon: ReactNode; tone: string; title: string; children: ReactNode; href?: string }) {
  return (
    <li className="well relative flex items-start gap-3 px-3.5 py-3">
      <span className={cn("grid size-[30px] flex-none place-items-center rounded-[10px] text-tone shadow-[var(--raise-sm)]", tone)} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        {href ? (
          <Link href={href} className="stretch block text-[13px] font-semibold">
            {title}
          </Link>
        ) : (
          <b className="block text-[13px] font-semibold">{title}</b>
        )}
        <span className="text-[12.5px] text-muted">{children}</span>
      </div>
    </li>
  );
}

export function NeedsAttention({ assessments }: { assessments: Assessment[] }) {
  const { waiting, stopped, interrupted, review, reviewBySeverity } = attention(assessments);
  const parts = (["HIGH", "MEDIUM", "LOW"] as const).filter((s) => reviewBySeverity[s]).map((s) => `${reviewBySeverity[s]} ${s.toLowerCase()}`);
  if (!waiting.length && !stopped.length && !interrupted.length && !review) {
    return <p className="text-[13px] text-muted">Nothing is waiting. Every finding is confirmed.</p>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {waiting.map((a) => (
        <Item key={a.uid} icon={<Clock size={16} />} tone="tone-warn" title={`${a.label} waits for you`} href={`/assessments/${a.uid}`}>
          {a.waiting_for ? `${a.waiting_for[0].toUpperCase()}${a.waiting_for.slice(1)}` : "A decision"} on {a.target}. Decide it in the terminal app.
        </Item>
      ))}
      {review > 0 && (
        <Item icon={<TriangleAlert size={16} />} tone="tone-accent" title={`${plural(review, "finding")} need review`} href="/findings?val=review">
          {parts.join(", ")} not confirmed yet.
        </Item>
      )}
      {stopped.map((a) => (
        <Item key={a.uid} icon={<ShieldX size={16} />} tone="tone-bad" title={`${a.label} stopped`} href={`/assessments/${a.uid}`}>
          {a.target}: {a.stopped_reason || "the run stopped early"}.
        </Item>
      ))}
      {interrupted.map((a) => (
        <Item key={a.uid} icon={<CircleSlash size={16} />} tone="tone-faint" title={`${a.label} was interrupted`} href={`/assessments/${a.uid}`}>
          {a.target}: the terminal app closed before this run finished.
        </Item>
      ))}
    </ul>
  );
}
