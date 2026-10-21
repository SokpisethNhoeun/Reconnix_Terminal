/* The combined report's HTML (lib/report/combined/html.ts): its ten sections, the anchors,
   every run and finding, escaping, no scripts, its own meta CSP — and that the single report,
   whose helpers it shares, still matches its saved copy (regenerated once, deliberately, when the
   meta CSP was added to it; otherwise byte-identical to the pre-refactor copy). */
import { describe, expect, it } from "vitest";

import type { Assessment } from "@/lib/data/schema";
import { renderCombinedHtml } from "@/lib/report/combined/html";
import { DEFAULT_COMBINE_OPTIONS } from "@/lib/report/combined/options";
import { combineAssessments } from "@/lib/report/combined/select";
import { esc, escPre, renderReportHtml } from "@/lib/report/html";

import { sampleAssessments } from "./fixtures";
import vectors from "./redact-vectors.json";

const all = sampleAssessments();
const picked = all.slice(0, 3);
const report = combineAssessments(picked, DEFAULT_COMBINE_OPTIONS);
const html = renderCombinedHtml(report, new Date("2026-10-20T09:00:00Z"));

const SECTIONS = [
  "Table of contents",
  "Executive summary",
  "Assessment overview",
  "Combined findings summary",
  "Individual assessment sections",
  "Evidence &amp; technical details",
  "Risk &amp; remediation priorities",
  "Limitations",
  "Appendix &amp; references",
];

describe("the combined HTML report", () => {
  it("is one document with the cover and nine more sections, each with its anchor", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<h1>Combined security assessment report</h1>");
    for (const name of SECTIONS) expect(html).toContain(`<h2>${name}</h2>`);
    for (const id of ["cover", "contents", "summary", "overview", "findings", "runs", "evidence", "priorities", "limitations", "appendix"]) {
      expect(html).toContain(`<section class="sheet" id="${id}">`);
      if (id !== "cover") expect(html).toContain(`href="#${id}"`);
    }
    expect(html).toContain("Generated 2026-10-20");
    expect(html).toContain("break-before:page");
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`);
  });

  it("claims approval only when every run's scope was approved", () => {
    expect(html).toContain("Every run tested inside a scope the operator approved");
    const draft = { ...picked[0], scope: { ...picked[0].scope!, status: "DRAFT" } };
    const out = renderCombinedHtml(combineAssessments([draft, picked[1]], DEFAULT_COMBINE_OPTIONS));
    expect(out).not.toContain("Every run tested inside a scope the operator approved");
    expect(out).toContain("1 of the runs had no approved scope: see Limitations.");
    expect(out).toContain("combined <b>2 assessments</b>");
  });

  it("says when a completed run recorded no findings", () => {
    const out = renderCombinedHtml(combineAssessments([{ ...picked[0], findings: [] }], DEFAULT_COMBINE_OPTIONS));
    expect(out).toContain("This run completed and recorded no findings.");
    expect(out).toContain("Every run completed inside an approved scope; nothing was left out.");
  });

  it("names every run, its uid and every included finding", () => {
    for (const a of picked) {
      expect(html).toContain(esc(a.uid));
      expect(html).toContain(`id="run-${a.uid}"`);
      for (const f of a.findings) if (f.status !== "false-positive") expect(html).toContain(esc(f.title));
    }
    expect(html).toContain(`${report.summary.unique} unique finding`);
    expect(html).toContain(`${report.summary.occurrences} occurrences`);
  });

  it("shows masked evidence only when the option is on", () => {
    const line = picked.flatMap((a) => a.findings).find((f) => f.evidence.length)!.evidence[0];
    expect(html).toContain(esc(line.trim().split(/\s+/)[0]));
    const without = renderCombinedHtml(combineAssessments(picked, { ...DEFAULT_COMBINE_OPTIONS, evidence: false }));
    expect(without).not.toContain('<pre class="evidence">');
    expect(without).toContain("Evidence lines were left out");
  });

  it("carries no scripts and escapes markup in saved text", () => {
    expect(html).not.toContain("<script");
    const hostile = { ...picked[0], findings: [{ ...picked[0].findings[0], title: '<img src=x onerror="alert(1)">', evidence: ["<b>raw</b>"] }] };
    const out = renderCombinedHtml(combineAssessments([hostile], DEFAULT_COMBINE_OPTIONS));
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<b>raw</b>");
    expect(out).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("says when the appendix was left out", () => {
    const out = renderCombinedHtml(combineAssessments(picked, { ...DEFAULT_COMBINE_OPTIONS, appendix: false }));
    expect(out).toContain("The appendix was left out");
    expect(out).not.toContain("Saved copies");
  });
});

// --- masking parity: the TUI's secret vectors through every free-text field of both reports ----
// A saved file is already masked, but the dashboard masks every saved text again (derive*.ts);
// the two report builders must too, field by field, so a secret in any one of them never prints.

type Field = { name: string; put: (a: Assessment, raw: string) => Assessment };

const withFinding = (a: Assessment, patch: Partial<Assessment["findings"][number]>): Assessment => ({
  ...a,
  findings: [{ ...a.findings[0], ...patch }, ...a.findings.slice(1)],
});

const FIELDS: Field[] = [
  { name: "target_url", put: (a, raw) => ({ ...a, target_url: raw }) },
  { name: "stopped_reason", put: (a, raw) => ({ ...a, status: "Stopped", stopped_reason: raw }) },
  { name: "scope.excluded_paths", put: (a, raw) => ({ ...a, scope: { ...a.scope!, excluded_paths: [raw] } }) },
  { name: "finding.title", put: (a, raw) => withFinding(a, { title: raw }) },
  { name: "finding.description", put: (a, raw) => withFinding(a, { description: raw }) },
  { name: "finding.impact", put: (a, raw) => withFinding(a, { impact: raw }) },
  { name: "finding.remediation", put: (a, raw) => withFinding(a, { remediation: raw }) },
  { name: "finding.triage_note", put: (a, raw) => withFinding(a, { triage_note: raw }) },
  { name: "finding.evidence", put: (a, raw) => withFinding(a, { evidence: [raw] }) },
  { name: "finding.affected_url", put: (a, raw) => withFinding(a, { affected_url: raw }) },
  { name: "finding.path", put: (a, raw) => withFinding(a, { path: raw }) },
];

const SINGLE_ONLY: Field[] = [
  { name: "verdict.reason", put: (a, raw) => ({ ...a, verdicts: [{ method: "GET", path: "/x", allowed: false, reason: raw, at: null }] }) },
  { name: "verdict.path", put: (a, raw) => ({ ...a, verdicts: [{ method: "GET", path: raw, allowed: false, reason: "out of scope", at: null }] }) },
  {
    name: "approval.target",
    put: (a, raw) => ({
      ...a,
      approvals: [{ ...a.approvals[0], request_id: "r-1", target: raw }],
      decisions: [{ ...a.decisions[0], request_id: "r-1" }],
    }),
  },
];

describe("masking parity with the dashboard", () => {
  const base = all.find((a) => a.findings.length > 0 && a.scope && a.approvals.length && a.decisions.length)!;
  const secret = (vectors as [string, string][]).filter(([raw, masked]) => raw !== masked);

  const expectMasked = (out: string, raw: string, masked: string, where: string) => {
    expect(out, `${where}: the raw text printed`).not.toContain(esc(raw));
    expect(out, `${where}: the raw text printed in a <pre>`).not.toContain(escPre(raw));
    expect(out.includes(esc(masked)) || out.includes(escPre(masked)), `${where}: the masked text is missing`).toBe(true);
  };

  it("masks every secret vector in every free-text field of the combined report", () => {
    for (const [raw, masked] of secret) {
      for (const field of FIELDS) {
        const out = renderCombinedHtml(combineAssessments([field.put(base, raw), picked[1]], DEFAULT_COMBINE_OPTIONS));
        expectMasked(out, raw, masked, `combined ${field.name} ← ${raw.slice(0, 30)}`);
      }
    }
  });

  it("masks every secret vector in every free-text field of the single report", () => {
    for (const [raw, masked] of secret) {
      // (the single report has no Limitations section, so it never prints stopped_reason)
      for (const field of [...FIELDS.filter((f) => f.name !== "stopped_reason"), ...SINGLE_ONLY]) {
        const out = renderReportHtml(field.put(base, raw));
        expectMasked(out, raw, masked, `single ${field.name} ← ${raw.slice(0, 30)}`);
      }
    }
  });

  it("leaves a plain question alone", () => {
    const [plain] = (vectors as [string, string][]).filter(([raw, masked]) => raw === masked);
    const out = renderReportHtml(withFinding(base, { description: plain[0] }));
    expect(out).toContain(esc(plain[0]));
  });
});

describe("the single report", () => {
  it("matches its saved copy, and carries the meta CSP", async () => {
    const a = all.find((x) => x.findings.length > 0 && x.scope)!;
    const out = renderReportHtml(a, new Date("2026-10-05T12:00:00Z"));
    expect(out).toContain(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`);
    await expect(out).toMatchFileSnapshot("./__snapshots__/single-report.html");
  });

  it("never lets a triage status named like an Object built-in pick a class", () => {
    const a = all.find((x) => x.findings.length > 0)!;
    const out = renderReportHtml({ ...a, findings: [{ ...a.findings[0], status: "constructor", severity: "HIGH", validation: "toString" }] });
    expect(out).toContain('<span class="st open">constructor</span>');
    expect(out).toContain('<span class="val inconclusive">tostring</span>');
    expect(out).not.toContain("function Object");
  });
});
