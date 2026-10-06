/* One assessment: summary, timeline, findings, scope & policy, approvals. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailHeader } from "@/components/assessments/detail-header";
import { PlanList } from "@/components/assessments/plan-list";
import { ScopeDetails } from "@/components/assessments/scope-details";
import { SeverityBars } from "@/components/charts/severity-bars";
import { FindingDetail } from "@/components/findings/finding-detail";
import { FindingsTable } from "@/components/findings/findings-table";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/neu/card";
import { Chip } from "@/components/neu/chips";
import { Kpi, KpiGrid } from "@/components/neu/kpi";
import { SegmentedLinks } from "@/components/neu/segmented";
import { ApprovalsTable } from "@/components/policy/approvals-table";
import { VerdictsTable } from "@/components/policy/verdicts-table";
import { TIMELINE_FILTERS, Timeline } from "@/components/timeline/timeline";
import { allFindings, approvalRows, blockedVerdicts, isConfirmed } from "@/lib/data/stats";
import { loadAssessment } from "@/lib/data/store";
import { formatDateTime, formatNumber } from "@/lib/format";
import { param, query } from "@/lib/utils";

const TABS = ["summary", "timeline", "findings", "scope", "approvals"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata(props: PageProps<"/assessments/[uid]">): Promise<Metadata> {
  const assessment = await loadAssessment((await props.params).uid);
  return { title: assessment ? `${assessment.label} · ${assessment.target}` : "Not found" };
}

export default async function AssessmentPage(props: PageProps<"/assessments/[uid]">) {
  const { uid } = await props.params;
  const sp = await props.searchParams;
  const a = await loadAssessment(uid);
  if (!a) notFound();

  const tab: Tab = (TABS as readonly string[]).includes(param(sp.tab)) ? (param(sp.tab) as Tab) : "summary";
  const base = `/assessments/${a.uid}`;
  const findings = allFindings([a]);
  const approvals = approvalRows([a]);
  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "timeline", label: "Timeline" },
    { id: "findings", label: `Findings (${findings.length})` },
    { id: "scope", label: "Scope & policy" },
    { id: "approvals", label: "Approvals" },
  ].map((t) => ({ label: t.label, href: `${base}${query({ tab: t.id === "summary" ? undefined : t.id })}`, current: t.id === tab }));

  return (
    <>
      <PageHeader title={a.label} sub={`${a.target || "target not set"} · ${formatDateTime(a.created_at)}`} />
      <DetailHeader assessment={a} tabs={tabs} />

      {tab === "summary" && (
        <>
          <KpiGrid>
            <Kpi compact label="Findings" value={findings.length} />
            <Kpi compact label="Confirmed" value={findings.filter(isConfirmed).length} />
            <Kpi compact label="Blocked" value={blockedVerdicts(a).length} />
            <Kpi compact label="Approvals" value={approvals.filter((r) => r.state === "APPROVED").length} />
            <Kpi compact label="Requests" value={formatNumber(a.run.requests)} />
          </KpiGrid>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Card title="Plan" hint={`${a.plan.filter((t) => t.status === "done").length}/${a.plan.length} done`}>
              <PlanList assessment={a} />
            </Card>
            <Card title="Findings by severity">
              {findings.length ? <SeverityBars findings={findings} meter={false} /> : <p className="text-[13px] text-muted">No findings yet. They appear after validation.</p>}
            </Card>
            <Card title={a.scope?.status === "APPROVED" ? "Approved scope" : "Scope"}>
              <ScopeDetails assessment={a} />
            </Card>
          </div>
        </>
      )}

      {tab === "timeline" && (
        <Card
          title="Timeline"
          hint="everything that happened, in order"
          actions={
            <SegmentedLinks
              label="Show"
              items={TIMELINE_FILTERS.map((f) => ({
                label: f.label,
                href: `${base}${query({ tab: "timeline", who: f.id })}`,
                current: (param(sp.who) || "all") === f.id,
              }))}
            />
          }
        >
          <Timeline entries={a.timeline} filter={param(sp.who) || "all"} />
        </Card>
      )}

      {tab === "findings" &&
        (findings.length ? (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
            <Card>
              <FindingsTable
                rows={findings}
                selected={(findings.find((f) => f.id === param(sp.f)) ?? findings[0]).key}
                hrefFor={(f) => `${base}${query({ tab: "findings", f: f.id })}`}
              />
            </Card>
            <FindingDetail finding={findings.find((f) => f.id === param(sp.f)) ?? findings[0]} />
          </div>
        ) : (
          <Card>
            <p className="text-[13px] text-muted">No findings yet.</p>
          </Card>
        ))}

      {tab === "scope" && (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Card title="Scope" actions={a.scope && <Chip tone={a.scope.status === "APPROVED" ? "ok" : "warn"}>{a.scope.status}</Chip>}>
            <ScopeDetails assessment={a} />
          </Card>
          <Card title="Policy checks" hint={`${a.verdicts.length} checked · ${blockedVerdicts(a).length} blocked`}>
            <VerdictsTable rows={a.verdicts.map((verdict) => ({ verdict }))} />
          </Card>
        </div>
      )}

      {tab === "approvals" && (
        <Card title="Approvals" hint="each decision is bound to the exact request it allowed">
          <ApprovalsTable rows={approvals} />
        </Card>
      )}
    </>
  );
}
