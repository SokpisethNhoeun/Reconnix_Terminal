/* The AI Assistant's right rail: the run it is working on now — its plan, its counts, and
   the findings it has turned up so far. Read from the chosen assessment. */
import { Check } from "lucide-react";

import type { Assessment } from "@/lib/data/schema";
import { allFindings, blockedVerdicts, durationMs, effectiveSeverity } from "@/lib/data/stats";
import { formatDuration, plural } from "@/lib/format";
import { templateLabel } from "@/lib/templates";
import { cn } from "@/lib/utils";

import { Badge, StatusChip } from "../neu/chips";

const PLAN_NOTE = { done: "done", active: "waiting for you", pending: "queued" } as const;

export function RunningPanel({ assessment: a }: { assessment: Assessment }) {
  const done = a.plan.filter((t) => t.status === "done").length;
  const findings = allFindings([a]);
  const blocked = blockedVerdicts(a);

  return (
    <aside className="card sticky top-6 gap-5 self-start">
      <div className="flex flex-col gap-3">
        <span className="eyebrow">Running assessment</span>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-mono text-[18px] font-semibold">{a.label}</h2>
          <StatusChip status={a.status} />
        </div>
        <p className="text-[12.5px] text-muted [overflow-wrap:anywhere]">
          {a.target} · {a.template.name ? templateLabel(a.template.name) : "no template"} · {formatDuration(durationMs(a)) || "just started"}
        </p>
      </div>

      {a.plan.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <span className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
            Plan · {done} of {a.plan.length} done
          </span>
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {a.plan.map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "grid size-[18px] flex-none place-items-center rounded-full",
                      t.status === "done" ? "text-ok shadow-[var(--raise-sm)]" : "text-faint shadow-[var(--press-sm)]",
                    )}
                    aria-hidden
                  >
                    {t.status === "done" ? <Check size={11} /> : t.status === "active" ? <span className="dot tone-warn" /> : ""}
                  </span>
                  <span className={t.status === "pending" ? "text-muted" : undefined}>{t.label}</span>
                </span>
                <span className={cn("font-mono text-[11px]", t.status === "active" ? "text-warn" : "text-muted")}>{PLAN_NOTE[t.status]}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <dl className="m-0 flex flex-col gap-2.5 border-t border-line pt-4 text-[13px]">
        <span className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Counts</span>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Findings so far</dt>
          <dd className="m-0 font-medium">{plural(findings.length, "candidate")}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Blocked by policy</dt>
          <dd className={cn("m-0 font-medium", blocked.length && "text-bad")}>
            {blocked.length}
            {blocked[0] && <span className="ml-1.5 font-mono text-[11.5px]">({blocked[0].method} {blocked[0].path})</span>}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Approvals</dt>
          <dd className="m-0 font-medium text-warn">
            {a.approvals.length} needed · {a.decisions.length} done
          </dd>
        </div>
      </dl>

      {findings.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-line pt-4">
          <span className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Findings so far</span>
          {findings.slice(0, 3).map((f) => (
            <div key={f.key} className="well flex flex-col gap-1 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[12.5px] font-semibold">
                  {f.id} <span className="font-sans font-normal text-muted">{f.category || "finding"}</span>
                </span>
                <Badge severity={effectiveSeverity(f)}>{effectiveSeverity(f)}</Badge>
              </div>
              <span className="text-[12px] text-muted [overflow-wrap:anywhere]">{f.title}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
