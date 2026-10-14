/* Overview: what Reconix found across every saved assessment. The risk views (severity,
   CVSS, weakness and category) count open findings at the analyst's severity; false
   positives are left out everywhere. */
import Link from "next/link";

import { AssessmentTable } from "@/components/assessments/assessment-table";
import { HBars } from "@/components/charts/hbars";
import { PerDayChart } from "@/components/charts/per-day-chart";
import { SeverityBars } from "@/components/charts/severity-bars";
import { SeverityTable } from "@/components/charts/severity-table";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/neu/card";
import { Dot, TRIAGE_TONE } from "@/components/neu/chips";
import { Kpi, KpiGrid, KpiNote } from "@/components/neu/kpi";
import { EmptyState } from "@/components/overview/empty-state";
import { LiveRuns } from "@/components/overview/live-runs";
import { NeedsAttention } from "@/components/overview/needs-attention";
import { SkippedFiles } from "@/components/overview/skipped-files";
import {
  ATTENTION,
  attentionItems,
  byTemplate,
  categoryCounts,
  isLive,
  isOpen,
  overview,
  perDay,
  topReferences,
} from "@/lib/data/stats";
import { loadLibrary, shownDir } from "@/lib/data/store";
import { formatDay, formatDuration, formatNumber, plural } from "@/lib/format";
import { referenceName } from "@/lib/references";
import { query } from "@/lib/utils";

const DAYS = 8;
const RECENT = 5; // rows in Recent assessments
const ATTENTION_SHOWN = 4; // items in Needs attention: about the height of those rows
const LIVE_SHOWN = 3; // runs in Live now

export default async function OverviewPage() {
  const { dir, assessments, problems } = await loadLibrary();
  if (!assessments.length) {
    return (
      <>
        <PageHeader title="Overview" sub="Waiting for the first saved assessment" />
        <SkippedFiles problems={problems} />
        <EmptyState dir={shownDir(dir)} />
      </>
    );
  }

  const stats = overview(assessments);
  const open = assessments.flatMap((a) => a.findings).filter(isOpen);
  const live = assessments.filter(isLive);
  const oldest = assessments[assessments.length - 1].created_at;
  const newest = assessments[0].created_at;
  const days = perDay(assessments, DAYS, new Date()).map((d) => ({
    label: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${d.day}T12:00:00`)),
    findings: d.findings,
    assessments: d.assessments,
  }));
  const refs = topReferences(open, 5).map((r) => ({
    key: r.ref,
    label: r.ref,
    sub: referenceName(r.ref),
    value: r.count,
    tip: `${r.ref}: ${plural(r.count, "finding")}`,
  }));
  const templates = byTemplate(assessments).map((t) => ({
    key: t.name,
    label: t.name,
    sub: plural(t.assessments, "assessment"),
    value: t.findings,
    tip: `${t.name}: ${plural(t.findings, "finding")} from ${plural(t.assessments, "assessment")}`,
  }));
  const categories = categoryCounts(open).map((c) => ({
    key: c.name,
    label: c.name,
    value: c.count,
    tip: `${c.name}: ${plural(c.count, "open finding")}`,
  }));
  const s = stats.byStatus;
  const attention = attentionItems(assessments);

  return (
    <>
      <PageHeader
        title="Overview"
        sub={`What Reconix found across ${plural(stats.assessments, "assessment")} · ${formatDay(oldest)} – ${formatDay(newest)}`}
      />
      <SkippedFiles problems={problems} />
      <KpiGrid cols={6}>
        <Kpi label="Assessments" value={stats.assessments}>
          {s.Completed > 0 && (
            <KpiNote>
              <Dot tone="ok" />
              {s.Completed} completed
            </KpiNote>
          )}
          {s["Awaiting input"] > 0 && (
            <KpiNote>
              <Dot tone="warn" />
              {s["Awaiting input"]} waiting
            </KpiNote>
          )}
          {s.Running > 0 && (
            <KpiNote>
              <Dot tone="accent" />
              {s.Running} running
            </KpiNote>
          )}
          {s.Stopped > 0 && (
            <KpiNote>
              <Dot tone="bad" />
              {s.Stopped} stopped
            </KpiNote>
          )}
          {s.Interrupted > 0 && (
            <KpiNote>
              <Dot tone="faint" />
              {s.Interrupted} interrupted
            </KpiNote>
          )}
          {stats.avgTestingMs !== null && <span>avg {formatDuration(stats.avgTestingMs)} testing</span>}
        </Kpi>
        <Kpi label="Findings" value={stats.findings}>
          <KpiNote>
            <Dot tone={TRIAGE_TONE.open} />
            {stats.open} open
          </KpiNote>
          {stats.fixed > 0 && (
            <KpiNote>
              <Dot tone={TRIAGE_TONE.fixed} />
              {stats.fixed} fixed
            </KpiNote>
          )}
          {stats.accepted > 0 && (
            <KpiNote>
              <Dot tone={TRIAGE_TONE.accepted} />
              {stats.accepted} accepted
            </KpiNote>
          )}
          {stats.falsePositive > 0 && (
            <KpiNote>
              <Dot tone={TRIAGE_TONE["false-positive"]} />
              {plural(stats.falsePositive, "false positive")} left out
            </KpiNote>
          )}
        </Kpi>
        <Kpi label="Highest CVSS" value={stats.cvss.scored ? stats.cvss.max.toFixed(1) : "—"}>
          <span>
            {stats.cvss.scored ? `avg ${stats.cvss.avg.toFixed(1)} · ${stats.cvss.scored} open scored` : "nothing open is scored"}
          </span>
        </Kpi>
        <Kpi label="Blocked by policy" value={stats.blocked}>
          <span>of {plural(stats.checks, "policy check")}</span>
        </Kpi>
        <Kpi label="Approvals granted" value={stats.granted}>
          <KpiNote>
            <Dot tone="bad" />
            {stats.rejected} rejected
          </KpiNote>
          <KpiNote>
            <Dot tone="warn" />
            {stats.pending} pending
          </KpiNote>
        </Kpi>
        <Kpi label="Requests sent" value={formatNumber(stats.requests)}>
          <span>all inside approved scope</span>
        </Kpi>
      </KpiGrid>

      {live.length > 0 && (
        <Card title="Live now" hint={`${plural(live.length, "run")} in the terminal app`}>
          <LiveRuns assessments={live} limit={LIVE_SHOWN} />
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Findings by severity" hint="open findings">
          <SeverityBars findings={open} />
          <SeverityTable findings={open} />
        </Card>
        <Card title="Findings per day" hint={`last ${DAYS} days`}>
          <PerDayChart data={days} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Recent assessments" actions={<Link className="link" href="/assessments">View all</Link>}>
          <AssessmentTable assessments={assessments.slice(0, RECENT)} compact />
        </Card>
        <Card
          title="Needs attention"
          actions={
            attention.runs > 0 && (
              <Link className="link" href={`/assessments${query({ status: ATTENTION })}`}>
                View all ({attention.runs})
              </Link>
            )
          }
        >
          <NeedsAttention assessments={assessments} limit={ATTENTION_SHOWN} />
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Top weakness categories" hint="OWASP and CWE, open findings">
          {refs.length ? <HBars rows={refs} label="Top weakness categories" /> : <p className="text-[13px] text-muted">No open findings.</p>}
        </Card>
        <Card title="Findings by category" hint="open findings">
          {categories.length ? <HBars rows={categories} label="Findings by category" /> : <p className="text-[13px] text-muted">No open findings.</p>}
        </Card>
        <Card title="Findings by template" hint="what kind of target they came from" className="md:col-span-2 xl:col-span-1">
          <HBars rows={templates} label="Findings by template" />
        </Card>
      </div>
    </>
  );
}
