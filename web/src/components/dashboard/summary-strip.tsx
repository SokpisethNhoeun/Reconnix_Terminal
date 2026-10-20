/* The Overview's summary strip: Findings, Assessment progress, Tool execution and Duration, for
   one run or every run (derive*.ts). Each card: a label, one big number and its context as badges
   and words, never colour alone; every badge and note with an explanation is a toggletip
   (hint.tsx), reachable by keyboard and touch too. Big numbers carry data-countup for the intro's
   count-up. */
import { Bug, Clock, Gauge, Wrench, type LucideIcon } from "lucide-react";

import type { SummaryStrip as Summary } from "@/components/dashboard/overview-types";
import { Hint } from "@/components/dashboard/hint";
import { ViewLink } from "@/components/dashboard/view-link";
import { SeverityBadge, StatusBadge } from "@/components/ui/status-badge";
import { FINDING_REVIEW, type Meaning, RUN_STATUS, SEVERITY_META, STEP_STATUS } from "@/lib/status";

/** Past the scope's time limit (no shared meaning exists for it in lib/status.ts). */
const OVER_LIMIT: Meaning = {
  label: "Over the time limit",
  tone: "danger",
  icon: "interrupted",
  hint: "The run went on past the time limit its scope allowed.",
};

function Card({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="dash-card dash-stat">
      <h2 className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.8} aria-hidden />
        {label}
      </h2>
      {children}
    </section>
  );
}

const Big = ({ value, format = "int" }: { value: string; format?: "int" | "pct" | "duration" | "none" }) =>
  format === "none" ? (
    <span className="dash-stat-value tabnums">{value}</span>
  ) : (
    <span key={value} className="dash-stat-value tabnums" data-countup data-count-format={format}>
      {value}
    </span>
  );

function Meter({ frac, color, label }: { frac: number; color: string; label: string }) {
  return (
    <span className="dash-meter" role="meter" aria-label={label} aria-valuenow={Math.round(frac * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span data-bar-x style={{ width: `${frac * 100}%`, background: color }} />
    </span>
  );
}

export function SummaryStrip({ data }: { data: Summary }) {
  const { findings, progress, tools, duration } = data;
  return (
    <div className="dash-summary" data-motion="top">
      <Card label="Findings" icon={Bug}>
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
          <Big value={String(findings.total)} />
          {findings.worst && (
            <Hint title={`Worst severity: ${SEVERITY_META[findings.worst.level].label}`} text={SEVERITY_META[findings.worst.level].hint}>
              <SeverityBadge level={findings.worst.level} />
            </Hint>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="dash-stat-note">
            {findings.worst
              ? `${findings.worst.count} ${SEVERITY_META[findings.worst.level].label.toLowerCase()} · worst severity`
              : "No findings yet"}
          </p>
          {findings.needsReview > 0 && (
            <Hint title={`${findings.needsReview} need review`} text={FINDING_REVIEW.review.hint}>
              <StatusBadge meaning={FINDING_REVIEW.review} label={`${findings.needsReview} need review`} />
            </Hint>
          )}
        </div>
        <ViewLink view={findings.link.view} filters={findings.link.filters} label={findings.link.label} className="absolute inset-0 z-[1] rounded-[14px]">
          <span className="sr-only">{findings.link.label}</span>
        </ViewLink>
      </Card>

      <Card label="Assessment progress" icon={Gauge}>
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
          <Big value={`${progress.pct}%`} format="pct" />
          {progress.status && (
            <Hint title={RUN_STATUS[progress.status].label} text={RUN_STATUS[progress.status].hint}>
              <StatusBadge meaning={RUN_STATUS[progress.status]} />
            </Hint>
          )}
          {progress.other && (
            <Hint title={`${progress.other.count} ${RUN_STATUS[progress.other.status].label.toLowerCase()}`} text={RUN_STATUS[progress.other.status].hint}>
              <StatusBadge meaning={RUN_STATUS[progress.other.status]} label={`${progress.other.count} ${RUN_STATUS[progress.other.status].label.toLowerCase()}`} />
            </Hint>
          )}
        </div>
        <Meter frac={progress.pct / 100} color="var(--primary)" label="Assessment progress" />
        <p className="dash-stat-note">{progress.caption}</p>
      </Card>

      <Card label="Tool execution" icon={Wrench}>
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
          <span className="flex items-baseline gap-1.5">
            <Big value={String(tools.steps)} />
            <span className="text-xs text-muted-foreground">{tools.steps === 1 ? "tool step" : "tool steps"}</span>
          </span>
          {tools.running && (
            <Hint title={STEP_STATUS.active.label} text="A run is executing its tool steps now.">
              <StatusBadge meaning={STEP_STATUS.active} />
            </Hint>
          )}
        </div>
        {tools.tools.length ? (
          <Hint title="Tools used" text={tools.tools.join(", ")} className="dash-stat-note min-w-0 self-stretch truncate">
            {`${tools.tools.length === 1 ? "1 tool" : `${tools.tools.length} tools`} · ${tools.tools.join(", ")}`}
          </Hint>
        ) : (
          <p className="dash-stat-note">No approved tool named yet</p>
        )}
        <Hint title="Requests sent" text="Requests the approved tools sent inside the scope (the run's request count)." className="dash-stat-note self-start">
          {tools.caption}
        </Hint>
      </Card>

      <Card label="Duration" icon={Clock}>
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
          <Big value={duration.value} format={duration.countup ? "duration" : "none"} />
          {duration.over > 0 && (
            <Hint title={OVER_LIMIT.label} text={OVER_LIMIT.hint}>
              <StatusBadge meaning={OVER_LIMIT} label={duration.over === 1 ? OVER_LIMIT.label : `${duration.over} over the limit`} />
            </Hint>
          )}
        </div>
        {duration.meter && (
          <Meter frac={duration.meter.frac} color={duration.meter.over ? "var(--danger)" : "var(--primary)"} label="Time used of the limit" />
        )}
        <p className="dash-stat-note">{duration.caption}</p>
      </Card>
    </div>
  );
}
