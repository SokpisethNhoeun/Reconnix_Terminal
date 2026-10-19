/* One assessment: summary, timeline, findings, scope & policy, approvals. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailHeader } from "@/components/assessments/detail-header";
import { PlanList } from "@/components/assessments/plan-list";
import { ScopeDetails } from "@/components/assessments/scope-details";
import { WaitingBanner } from "@/components/assessments/waiting-banner";
import { SeverityBars } from "@/components/charts/severity-bars";
import { FindingsTable } from "@/components/findings/findings-table";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/neu/card";
import { Chip, Dot } from "@/components/neu/chips";
import { Kpi } from "@/components/neu/kpi";
import { SegmentedLinks } from "@/components/neu/segmented";
import { ApprovalsTable } from "@/components/policy/approvals-table";
import { VerdictsTable } from "@/components/policy/verdicts-table";
import { TIMELINE_FILTERS, Timeline } from "@/components/timeline/timeline";
import { currentRole } from "@/lib/auth/guard";
import { mayUseTerminal } from "@/lib/auth/session";
import { allFindings, approvalRows, blockedVerdicts, isConfirmed } from "@/lib/data/stats";
import { loadAssessment } from "@/lib/data/store";
import { formatDateTime, plural } from "@/lib/format";
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
  const [a, role] = await Promise.all([loadAssessment(uid), currentRole()]);
  if (!a) notFound();
  const operator = mayUseTerminal(role);

  const tab: Tab = (TABS as readonly string[]).includes(param(sp.tab)) ? (param(sp.tab) as Tab) : "summary";
  const base = `/assessments/${a.uid}`;
  const findings = allFindings([a]);
  const approvals = approvalRows([a]);
  const granted = approvals.filter((r) => r.state === "APPROVED").length;
  const pending = approvals.filter((r) => r.state === "PENDING").length;
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

      {a.status === "Awaiting input" && <WaitingBanner assessment={a} operator={operator} context="detail" />}

      {tab === "summary" && (
        <>
          <section className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
            <Kpi label="Findings" value={findings.length}>
              {findings.length ? (
                <span className="inline-flex items-center gap-1.5">
                  <Dot tone="ok" />
                  {findings.filter(isConfirmed).length} confirmed
                </span>
              ) : (
                <span>Severity breakdown appears after validation</span>
              )}
            </Kpi>
            <Kpi label="Blocked by policy" value={blockedVerdicts(a).length}>
              <span>{a.verdicts.length ? `of ${plural(a.verdicts.length, "action")} checked` : "No actions checked yet"}</span>
            </Kpi>
            <Kpi label="Approvals" value={granted}>
              {pending > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <Dot tone="warn" />
                  {pending} waiting · plan review
                </span>
              ) : (
                <span>{granted ? "granted" : "none needed yet"}</span>
              )}
            </Kpi>
          </section>
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

      {tab === "findings" && (
        <Card>
          {findings.length ? <FindingsTable rows={findings} /> : <p className="text-[13px] text-muted">No findings yet.</p>}
        </Card>
      )}

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
