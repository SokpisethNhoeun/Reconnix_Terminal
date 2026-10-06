/* Overview: what Reconix found across every saved assessment. */
import Link from "next/link";

import { AssessmentTable } from "@/components/assessments/assessment-table";
import { HBars } from "@/components/charts/hbars";
import { PerDayChart } from "@/components/charts/per-day-chart";
import { SeverityBars } from "@/components/charts/severity-bars";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/neu/card";
import { Dot } from "@/components/neu/chips";
import { Kpi, KpiGrid, KpiNote } from "@/components/neu/kpi";
import { EmptyState } from "@/components/overview/empty-state";
import { NeedsAttention } from "@/components/overview/needs-attention";
import { SkippedFiles } from "@/components/overview/skipped-files";
import { byTemplate, overview, perDay, topReferences } from "@/lib/data/stats";
import { loadLibrary, shownDir } from "@/lib/data/store";
import { formatDay, formatNumber, plural } from "@/lib/format";
import { referenceName } from "@/lib/references";

const DAYS = 8;

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
  const findings = assessments.flatMap((a) => a.findings);
  const oldest = assessments[assessments.length - 1].created_at;
  const newest = assessments[0].created_at;
  const days = perDay(assessments, DAYS, new Date()).map((d) => ({
    label: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${d.day}T12:00:00`)),
    findings: d.findings,
    assessments: d.assessments,
  }));
  const refs = topReferences(findings, 5).map((r) => ({
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
  const s = stats.byStatus;

  return (
    <>
      <PageHeader
        title="Overview"
        sub={`What Reconix found across ${plural(stats.assessments, "assessment")} · ${formatDay(oldest)} – ${formatDay(newest)}`}
      />
      <SkippedFiles problems={problems} />
      <KpiGrid>
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
        </Kpi>
        <Kpi label="Findings" value={stats.findings}>
          <KpiNote>
            <Dot tone="ok" />
            {stats.confirmed} confirmed
          </KpiNote>
          <KpiNote>
            <Dot tone="warn" />
            {stats.review} for review
          </KpiNote>
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Findings by severity" hint="all assessments">
          <SeverityBars findings={findings} />
        </Card>
        <Card title="Findings per day" hint={`last ${DAYS} days`}>
          <PerDayChart data={days} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Recent assessments" actions={<Link className="link" href="/assessments">View all</Link>}>
          <AssessmentTable assessments={assessments.slice(0, 5)} compact />
        </Card>
        <Card title="Needs attention">
          <NeedsAttention assessments={assessments} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Top weakness categories" hint="OWASP and CWE references">
          {refs.length ? <HBars rows={refs} wide label="Top weakness categories" /> : <p className="text-[13px] text-muted">No findings yet.</p>}
        </Card>
        <Card title="Findings by template" hint="what kind of target they came from">
          <HBars rows={templates} wide label="Findings by template" />
        </Card>
      </div>
    </>
  );
}
