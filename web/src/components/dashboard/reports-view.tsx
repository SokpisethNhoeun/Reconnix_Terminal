import Link from "next/link";
import { SquareArrowOutUpRight } from "lucide-react";
import type { Dashboard } from "@/components/dashboard/derive";
import { SeverityBadge, StatusBadge } from "@/components/ui/status-badge";
import { EXPORT_FORMATS, downloadHref } from "@/lib/report/formats";
import { RUN_STATUS, SEVERITY_META } from "@/lib/status";

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className="font-mono text-[13px] text-foreground [overflow-wrap:anywhere]">{v}</dd>
    </div>
  );
}

export function ReportsView({ dash }: { dash: Dashboard }) {
  const { assessment, checks, findingTotal, findings, maskedSecrets, minutes, planSteps, requests, scopeCounts, severity } = dash;
  return (
    <div className="dash-view max-w-4xl">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-medium text-foreground">Report</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">A summary of this assessment from its saved copy.</p>
        </div>
        <Link
          href="/docs/reference/reports"
          className="dash-card-open inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Report format <SquareArrowOutUpRight className="size-3.5" aria-hidden />
        </Link>
      </header>

      {/* the full report, rendered by /api/assessments/[uid]/export (lib/report/*) */}
      <nav aria-label="Download the report" className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Download</span>
        {EXPORT_FORMATS.map((f) => (
          <a
            key={f.id}
            href={downloadHref(assessment.uid, f.id)}
            download
            className="dash-chip h-[28px] border border-border px-3 text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {f.label}
          </a>
        ))}
      </nav>

      <article className="rounded-2xl border border-border bg-gradient-to-b from-card to-[var(--card-2)] p-6">
        <div className="border-b border-border pb-4">
          <h2 className="text-lg font-medium text-foreground">{assessment.name}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Meta k="Assessment" v={assessment.id} />
            <Meta k="Target" v={assessment.target} />
            <Meta k="Template" v={assessment.template} />
            <Meta k="Status" v={<StatusBadge meaning={RUN_STATUS[assessment.status]} />} />
            <Meta k="Started" v={assessment.startedAt} />
            <Meta k="Duration" v={assessment.duration} />
            <Meta k="Operator" v={assessment.operator} />
            <Meta k="Progress" v={`${assessment.progress}%`} />
          </dl>
        </div>

        {/* summary */}
        <section className="border-b border-border py-4">
          <h3 className="mb-3 text-[13px] font-medium text-foreground">Summary</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              [String(findingTotal), "findings"],
              [`${checks.allowed} / ${checks.total}`, "policy checks allowed"],
              [String(checks.blocked), "blocked by policy"],
              [String(maskedSecrets), "secrets masked"],
            ].map(([n, l]) => (
              <div key={l} className="dash-tile p-3">
                <div className="text-[22px] leading-none tabnums text-foreground">{n}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1.5">
            {severity.map((s) => (
              <div key={s.level} className="flex items-center gap-3 text-xs">
                <SeverityBadge level={s.level} className="w-[84px]" />
                <span className="tabnums w-5 text-right text-foreground">{s.count}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full" style={{ width: `${s.share}%`, background: SEVERITY_META[s.level].color }} />
                </span>
                <span className="tabnums w-8 text-right text-muted-foreground">{s.share}%</span>
              </div>
            ))}
          </div>
        </section>

        {/* findings table */}
        <section className="border-b border-border py-4">
          <h3 className="mb-3 text-[13px] font-medium text-foreground">Findings</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pr-3 font-normal">ID</th>
                  <th className="py-1.5 pr-3 font-normal">Severity</th>
                  <th className="py-1.5 pr-3 font-normal">Finding</th>
                  <th className="py-1.5 pr-3 font-normal">Tool</th>
                  <th className="py-1.5 pr-3 font-normal">Weakness</th>
                  <th className="py-1.5 font-normal">Rating</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr key={f.id} className="border-t border-border">
                    <td className="py-2 pr-3 font-mono text-foreground">{f.id}</td>
                    <td className="py-2 pr-3">
                      <SeverityBadge level={f.severity} />
                    </td>
                    <td className="py-2 pr-3 text-foreground">{f.title}</td>
                    <td className="py-2 pr-3 font-mono text-muted-foreground">{f.tool}</td>
                    <td className="py-2 pr-3 font-mono text-muted-foreground">{f.cwe}</td>
                    <td className="py-2 font-mono text-muted-foreground">{f.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* run budget */}
        <section className="pt-4">
          <h3 className="mb-3 text-[13px] font-medium text-foreground">Run</h3>
          <dl className="grid grid-cols-3 gap-4">
            <Meta k="Minutes" v={minutes.max !== null ? `${minutes.used} / ${minutes.max}` : String(minutes.used)} />
            <Meta k="Plan steps" v={`${planSteps.done} / ${planSteps.total}`} />
            <Meta k="Requests sent" v={String(requests)} />
          </dl>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {scopeCounts.inScope} in scope · {scopeCounts.excluded} excluded · saved assessment {assessment.uid}
          </p>
        </section>
      </article>
    </div>
  );
}
