/* Dashboard: what Reconix found across every saved assessment. The headline tiles, the
   decisions and findings that need a look, the severity mix, the daily trend and the latest
   runs. Findings leave out false positives; "need review" means open and not yet confirmed. */
import { Sparkles } from "lucide-react";
import Link from "next/link";

import { PerDayChart } from "@/components/charts/per-day-chart";
import { SeverityDonut } from "@/components/charts/severity-donut";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/neu/card";
import { Badge, Dot } from "@/components/neu/chips";
import { EmptyState } from "@/components/overview/empty-state";
import { NeedsAttention } from "@/components/overview/needs-attention";
import { RecentAssessments } from "@/components/overview/recent-assessments";
import { SkippedFiles } from "@/components/overview/skipped-files";
import { StatCard, StatGrid } from "@/components/overview/stat-cards";
import { buttonVariants } from "@/components/ui/button";
import { currentRole } from "@/lib/auth/guard";
import { mayUseTerminal } from "@/lib/auth/session";
import { effectiveSeverity, isConfirmed, isFalsePositive, needsReview, overview, perDay } from "@/lib/data/stats";
import { loadLibrary, shownDir } from "@/lib/data/store";
import { formatDay, plural } from "@/lib/format";
import { TERMINAL_PAGE } from "@/lib/terminal/paths";
import { cn } from "@/lib/utils";

const DAYS = 8;
const RECENT = 5; // rows in Recent assessments
const ATTENTION_SHOWN = 5; // items in Needs attention

const HIGH_SEVERITY = new Set(["CRITICAL", "HIGH"]);

export default async function DashboardPage() {
  const [{ dir, assessments, problems }, role] = await Promise.all([loadLibrary(), currentRole()]);
  const operator = mayUseTerminal(role);

  if (!assessments.length) {
    return (
      <>
        <PageHeader title="Dashboard" sub="Waiting for the first saved assessment" />
        <SkippedFiles problems={problems} />
        <EmptyState dir={shownDir(dir)} />
      </>
    );
  }

  const stats = overview(assessments);
  const oldest = assessments[assessments.length - 1].created_at;
  const newest = assessments[0].created_at;

  // The findings that count (false positives left out), split by review state and severity.
  const vulns = assessments.flatMap((a) => a.findings).filter((f) => !isFalsePositive(f));
  const critHigh = vulns.filter((f) => HIGH_SEVERITY.has(effectiveSeverity(f)));
  const critHighConfirmed = critHigh.filter(isConfirmed).length;
  const critHighReview = critHigh.filter(needsReview).length;

  const days = perDay(assessments, DAYS, new Date()).map((d) => ({
    label: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${d.day}T12:00:00`)),
    findings: d.findings,
    assessments: d.assessments,
  }));
  const s = stats.byStatus;

  const newAssessment = operator ? (
    <Link href={TERMINAL_PAGE} className={cn(buttonVariants({ variant: "accent", size: "sm" }))}>
      <Sparkles size={15} aria-hidden />
      New assessment in AI Assistant
    </Link>
  ) : undefined;

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub={`What Reconix found across ${plural(stats.assessments, "assessment")} · ${formatDay(oldest)} – ${formatDay(newest)}`}
        actions={newAssessment}
      />
      <SkippedFiles problems={problems} />

      <StatGrid>
        <StatCard
          label="Critical & High"
          value={critHigh.length}
          href="/findings?sev=CRITICAL"
          urgent={critHighReview > 0}
          badge={critHighReview > 0 ? <Badge severity="HIGH">Urgent</Badge> : undefined}
        >
          {critHighReview > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Dot tone="warn" />
              {critHighReview} need review
            </span>
          )}
          {critHighConfirmed > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Dot tone="ok" />
              {critHighConfirmed} confirmed
            </span>
          )}
          {critHigh.length === 0 && <span>none open</span>}
        </StatCard>

        <StatCard label="Findings" value={stats.findings} href="/findings">
          {stats.confirmed > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Dot tone="ok" />
              {stats.confirmed} confirmed
            </span>
          )}
          {stats.review > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Dot tone="warn" />
              {stats.review} need review
            </span>
          )}
          {stats.findings === 0 && <span>nothing found yet</span>}
        </StatCard>

        <StatCard label="Assessments" value={stats.assessments} href="/assessments">
          {s.Completed > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Dot tone="ok" />
              {s.Completed} completed
            </span>
          )}
          {s["Awaiting input"] > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Dot tone="warn" />
              {s["Awaiting input"]} awaiting input
            </span>
          )}
          {s.Running > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Dot tone="accent" />
              {s.Running} running
            </span>
          )}
          {s.Stopped > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Dot tone="bad" />
              {s.Stopped} stopped
            </span>
          )}
        </StatCard>

        <StatCard label="Blocked by policy" value={stats.blocked} href="/policy">
          <span>
            {stats.blocked} of {plural(stats.checks, "AI action")} blocked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Dot tone="ok" />
            All requests stayed in scope
          </span>
        </StatCard>
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Needs attention" hint="decisions first, then critical & high findings to review">
          <NeedsAttention assessments={assessments} limit={ATTENTION_SHOWN} operator={operator} />
        </Card>
        <Card title="Findings by severity" hint="all assessments">
          <SeverityDonut findings={vulns} />
        </Card>
      </div>

      <Card title="Findings per day" hint={`last ${DAYS} days`}>
        <PerDayChart data={days} />
      </Card>

      <Card title="Recent assessments" hint={`latest ${RECENT}`} actions={<Link className="link" href="/assessments">View all</Link>}>
        <RecentAssessments assessments={assessments.slice(0, RECENT)} />
      </Card>
    </>
  );
}
