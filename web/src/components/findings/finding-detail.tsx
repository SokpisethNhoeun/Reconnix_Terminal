/* One finding in full. The TUI masks evidence before saving it; it is shown as plain text
   (React escapes it), never as HTML. */
import type { FindingRow } from "@/lib/data/stats";

import { Card } from "../neu/card";
import { Chip, SeverityChip, TriageChip, ValidationChip } from "../neu/chips";
import { KeyValues } from "../neu/key-values";

export function FindingDetail({ finding }: { finding?: FindingRow }) {
  if (!finding) {
    return (
      <Card>
        <p className="text-[13px] text-muted">Select a finding to see its details.</p>
      </Card>
    );
  }
  return (
    <Card className="lg:sticky lg:top-6">
      <div className="flex flex-col gap-2.5">
        <span className="font-mono text-[11.5px] text-muted">
          {finding.assessment.label} · {finding.assessment.target} · finding {finding.id}
        </span>
        <h3 className="text-[17px] leading-snug font-semibold text-balance">{finding.title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityChip severity={finding.severity} />
          <ValidationChip validation={finding.validation} />
          <TriageChip status={finding.status} />
          {finding.cvss_score > 0 && <Chip>CVSS {finding.cvss_score.toFixed(1)}</Chip>}
        </div>
      </div>
      <KeyValues
        items={[
          ...(finding.category ? [{ label: "Category", value: finding.category }] : []),
          ...(finding.cvss_vector ? [{ label: "CVSS vector", value: finding.cvss_vector, mono: true }] : []),
          { label: "Description", value: finding.description },
          { label: "Affected", value: finding.affected_url, mono: true },
          { label: "Evidence", value: <pre className="evidence flex-1">{finding.evidence.join("\n") || "—"}</pre> },
          { label: "Impact", value: finding.impact },
          { label: "Remediation", value: finding.remediation },
          ...(finding.triage_note ? [{ label: "Analyst note", value: finding.triage_note }] : []),
          {
            label: "References",
            value: finding.references.length ? finding.references.map((r) => <Chip key={r}>{r}</Chip>) : "—",
          },
          { label: "Tool", value: finding.tool },
        ]}
      />
      <p className="text-xs text-muted">
        Evidence is masked before it is saved: cookies, tokens, keys and URL passwords are redacted.
      </p>
    </Card>
  );
}
