/* One finding on its own page: the header with its severity and scores, then what is wrong,
   the evidence, how to fix it, its impact and score, its short history, and the next step.
   The TUI masks evidence before saving; it is shown as plain text (React escapes it). */
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { effectiveSeverity, type FindingRow } from "@/lib/data/stats";
import { formatDateTime, formatShort } from "@/lib/format";
import { TERMINAL_PAGE } from "@/lib/terminal/paths";
import { cn } from "@/lib/utils";

import { Card } from "../neu/card";
import { Chip, FindingStatus, SeverityChip } from "../neu/chips";
import { KeyValues } from "../neu/key-values";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <p className="eyebrow">{title}</p>
      {children}
    </Card>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-0.5 text-[13.5px] font-medium [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

export function FindingView({ finding: f, operator }: { finding: FindingRow; operator: boolean }) {
  const severity = effectiveSeverity(f);
  const a = f.assessment;
  const fixSteps = f.remediation.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const references = f.references.length ? f.references : f.cwe.concat(f.cve, f.owasp);

  return (
    <>
      <Link href="/findings" className="link">
        ← All findings
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityChip severity={severity} />
            <FindingStatus status={f.status} validation={f.validation} />
            {f.cvss_score > 0 && <Chip>CVSS {f.cvss_score.toFixed(1)}</Chip>}
            {f.category && <Chip>{f.category}</Chip>}
            {f.cwe[0] && <Chip>{f.cwe[0]}</Chip>}
          </div>
          <span className="font-mono text-[12px] text-muted">{f.id}</span>
        </div>
        <h1 className="text-[22px] leading-snug font-semibold text-balance">{f.title}</h1>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <Meta label="Target">{a.target || "—"}</Meta>
          <Meta label="Affected">
            <span className="font-mono text-[12.5px]">{f.affected_url || f.path || "—"}</span>
          </Meta>
          <Meta label="Assessment">
            <Link href={`/assessments/${a.uid}`} className="link font-mono">
              {a.label} →
            </Link>
          </Meta>
          <Meta label="Found">{formatDateTime(a.created_at)}</Meta>
        </div>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel title="What is wrong">
            <p className="text-[13.5px] leading-relaxed [overflow-wrap:anywhere]">{f.description || "No description."}</p>
          </Panel>

          <Panel title="Evidence">
            <pre className="evidence">{f.evidence.join("\n") || "—"}</pre>
            <p className="text-[12.5px] text-ok">
              ✓ Masked before saving: cookies, tokens, keys and URL passwords are redacted · inside approved scope
            </p>
          </Panel>

          {f.remediation && (
            <Panel title="How to fix">
              {fixSteps.length > 1 ? (
                <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-[13.5px] leading-relaxed">
                  {fixSteps.map((step, i) => (
                    <li key={i}>{step.replace(/^\d+[.)]\s*/, "")}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-[13.5px] leading-relaxed">{f.remediation}</p>
              )}
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Impact">
            <p className="text-[13.5px] leading-relaxed [overflow-wrap:anywhere]">{f.impact || "Not described."}</p>
          </Panel>

          <Panel title="Score">
            <KeyValues
              items={[
                { label: "CVSS", value: f.cvss_score > 0 ? `${f.cvss_score.toFixed(1)} ${severity[0] + severity.slice(1).toLowerCase()}` : "—" },
                ...(f.cvss_vector ? [{ label: "Vector", value: f.cvss_vector, mono: true }] : []),
                { label: "Found by", value: f.tool || "—" },
                {
                  label: "References",
                  value: references.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {references.map((r) => (
                        <Chip key={r}>{r}</Chip>
                      ))}
                    </span>
                  ) : (
                    "—"
                  ),
                },
              ]}
            />
          </Panel>

          <Panel title="History">
            <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[13px]">
              <li>
                <b className="font-semibold">Found by {f.tool || "the scanner"}</b>
                <span className="cell-sub">{formatShort(a.created_at)} · {a.label}</span>
              </li>
              <li>
                <b className="font-semibold">{f.validation === "CONFIRMED" ? "Confirmed" : "Safe check passed"}</b>
                <span className="cell-sub">status: {f.validation === "CONFIRMED" ? "Confirmed" : "Need review"}</span>
              </li>
              {f.triage_note ? (
                <li>
                  <b className="font-semibold">Analyst note</b>
                  <span className="cell-sub [overflow-wrap:anywhere]">{f.triage_note}</span>
                </li>
              ) : (
                f.validation !== "CONFIRMED" && <li className="text-muted">Waiting for a person to confirm</li>
              )}
            </ul>
          </Panel>

          <Panel title="Next step">
            <p className="text-[13px] text-muted">Confirm it, or mark it as a false positive, in the AI Assistant.</p>
            {operator ? (
              <Link href={TERMINAL_PAGE} className={cn(buttonVariants({ variant: "accent", size: "sm" }), "self-start")}>
                Review in AI Assistant
                <ArrowRight size={15} aria-hidden />
              </Link>
            ) : (
              <Link href={`/assessments/${a.uid}`} className={cn(buttonVariants({ variant: "default", size: "sm" }), "self-start")}>
                Open the assessment
                <ArrowUpRight size={15} aria-hidden />
              </Link>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
