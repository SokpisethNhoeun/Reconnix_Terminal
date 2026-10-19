/* The seven-step flow across the top of the AI Assistant: Start, Template, Plan, Approval,
   Execution, Findings, Report. Steps before the current one are done, one is active. */
import { Check } from "lucide-react";

import type { Status } from "@/lib/data/schema";
import { cn } from "@/lib/utils";

const STEPS = ["Start", "Template", "Plan", "Approval", "Execution", "Findings", "Report"] as const;

// How far the flow has reached for each run status (the index of the active step).
const ACTIVE: Record<Status, number> = {
  New: 1,
  "Awaiting input": 3,
  Running: 4,
  Completed: 7,
  Stopped: 4,
  Interrupted: 4,
};

export function FlowSteps({ status }: { status: Status }) {
  const active = ACTIVE[status];
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3 text-[13.5px]">
      {STEPS.map((label, i) => {
        const state = i < active ? "done" : i === active ? "active" : "todo";
        return (
          <div key={label} className="flex min-w-0 items-center gap-2">
            <span className={cn("flow-step", state)}>
              <i aria-hidden>{state === "done" ? <Check size={12} /> : state === "active" ? "●" : i + 1}</i>
              <span className={cn(state === "todo" && "text-muted", state === "active" && "font-semibold")}>{label}</span>
            </span>
            {i < STEPS.length - 1 && <span className="flow-line" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}
