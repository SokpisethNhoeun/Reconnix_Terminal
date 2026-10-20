/* The combined report's HTML (lib/report/combined/html.ts): its ten sections, the anchors,
   every run and finding, escaping, no scripts, its own meta CSP — and that the single report,
   whose helpers it shares, still matches its saved copy (regenerated once, deliberately, when the
   meta CSP was added to it; otherwise byte-identical to the pre-refactor copy). */
import { describe, expect, it } from "vitest";

import { renderCombinedHtml } from "@/lib/report/combined/html";
import { DEFAULT_COMBINE_OPTIONS } from "@/lib/report/combined/options";
import { combineAssessments } from "@/lib/report/combined/select";
import { esc, renderReportHtml } from "@/lib/report/html";

import { sampleAssessments } from "./fixtures";

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
