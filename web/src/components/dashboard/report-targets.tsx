/* Every target across the saved runs, the most findings first: its runs, findings and worst
   severity; a row opens the newest run's report. */
import { DashCard } from "@/components/dashboard/dash-card";
import type { ReportTargetRow } from "@/components/dashboard/report-types";
import { RunLinkTo } from "@/components/dashboard/run-link";
import { SeverityBadge } from "@/components/ui/status-badge";

const count = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export function ReportTargets({ targets }: { targets: ReportTargetRow[] }) {
  return (
    <DashCard id="report-targets" title="Targets" docsHref="/docs/reports/exporting" meta={count(targets.length, "target")} className="dash-panel">
      <ul aria-label="Targets" className="flex flex-col gap-px">
        {targets.map((t) => (
          <li key={t.target}>
            <RunLinkTo
              uid={t.latest.uid}
              label={`Open the newest report for ${t.target} (${t.latest.label}): ${count(t.runs, "run")}, ${count(t.findings, "finding")}`}
              className="dash-target-row"
            >
              <span className="min-w-0">
                <span className="block truncate font-mono text-xs text-foreground">{t.target}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {count(t.runs, "run")} · {count(t.findings, "finding")}
                </span>
              </span>
              {t.worst ? <SeverityBadge level={t.worst} /> : <span className="text-[11px] text-muted-foreground">no findings</span>}
            </RunLinkTo>
          </li>
        ))}
      </ul>
    </DashCard>
  );
}
