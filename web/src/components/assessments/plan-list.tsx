/* The template's plan: done ✓, in progress, or not reached. */
import { Check } from "lucide-react";

import type { Assessment } from "@/lib/data/schema";
import { cn } from "@/lib/utils";

const NOTE = { done: "done", active: "in progress", pending: "" } as const;

export function PlanList({ assessment }: { assessment: Assessment }) {
  if (!assessment.plan.length) return <p className="text-[13px] text-muted">The plan appears once a template is chosen.</p>;
  const ended = assessment.status === "Stopped";
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {assessment.plan.map((task) => (
        <li key={task.key} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 text-[13px]">
          <span
            className={cn(
              "grid size-[22px] place-items-center rounded-full",
              task.status === "done" ? "text-ok shadow-[var(--raise-sm)]" : "text-faint shadow-[var(--press-sm)]",
            )}
            aria-hidden
          >
            {task.status === "done" ? <Check size={13} /> : task.status === "active" ? <span className="dot tone-accent" /> : "·"}
          </span>
          <span className={task.status === "pending" ? "text-muted" : undefined}>{task.label}</span>
          <span className="font-mono text-[11.5px] text-muted">
            {task.status === "pending" && ended ? "not run" : NOTE[task.status]}
          </span>
        </li>
      ))}
    </ol>
  );
}
