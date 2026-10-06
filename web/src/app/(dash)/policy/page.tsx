/* How the guardrails held: policy checks, blocked requests, and every approval decision. */
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/neu/card";
import { Dot, SeverityChip } from "@/components/neu/chips";
import { Kpi, KpiGrid, KpiNote } from "@/components/neu/kpi";
import { TableWrap } from "@/components/neu/table-wrap";
import { ApprovalsTable } from "@/components/policy/approvals-table";
import { VerdictsTable } from "@/components/policy/verdicts-table";
import { type DecisionState, approvalRows, blockedVerdicts, overview } from "@/lib/data/stats";
import { loadLibrary } from "@/lib/data/store";
import { plural } from "@/lib/format";

export const metadata: Metadata = { title: "Policy & approvals" };

const STATES: DecisionState[] = ["APPROVED", "REJECTED", "PENDING"];

export default async function PolicyPage() {
  const { assessments } = await loadLibrary();
  const stats = overview(assessments);
  const approvals = approvalRows(assessments);
  const blocked = assessments.flatMap((a) => blockedVerdicts(a).map((verdict) => ({ assessment: a, verdict })));
  const count = (risk: string, state: DecisionState) => approvals.filter((r) => r.approval.risk === risk && r.state === state).length;

  return (
    <>
      <PageHeader title="Policy & approvals" sub={`How the guardrails held across ${plural(assessments.length, "assessment")}`} />
      <KpiGrid>
        <Kpi label="Policy checks" value={stats.checks}>
          <span>every proposed request</span>
        </Kpi>
        <Kpi label="Allowed" value={stats.checks - stats.blocked}>
          <KpiNote>
            <Dot tone="ok" />
            inside approved scope
          </KpiNote>
        </Kpi>
        <Kpi label="Blocked" value={stats.blocked}>
          <KpiNote>
            <Dot tone="bad" />
            excluded path or host
          </KpiNote>
        </Kpi>
        <Kpi label="Approvals granted" value={stats.granted}>
          <span>MEDIUM and HIGH</span>
        </Kpi>
        <Kpi label="Rejected · pending" value={`${stats.rejected} · ${stats.pending}`}>
          <span>decided in the terminal app</span>
        </Kpi>
      </KpiGrid>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title="Blocked requests" hint="stopped by the policy engine">
          <VerdictsTable rows={blocked} />
        </Card>
        <Card title="Approvals by risk">
          <TableWrap label="Approvals by risk table">
            <table className="data">
              <thead>
                <tr>
                  <th>Risk</th>
                  {STATES.map((s) => (
                    <th key={s} className="text-right">
                      {s.toLowerCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["MEDIUM", "HIGH"] as const).map((risk) => (
                  <tr key={risk}>
                    <td>
                      <SeverityChip severity={risk} />
                    </td>
                    {STATES.map((s) => (
                      <td key={s} className="text-right tabular-nums">
                        {count(risk, s)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <p className="text-[12.5px] text-muted">
            HIGH approvals need a second confirmation of the exact request. Every decision is bound to the hash of the request it allowed.
          </p>
        </Card>
      </div>

      <Card title="Approval decisions" hint="who approved what, and why">
        <ApprovalsTable rows={approvals} showAssessment />
      </Card>
    </>
  );
}
