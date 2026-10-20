/* The combined report's HTML (lib/report/combined/html.ts): its ten sections, the anchors,
   every run and finding, escaping, no scripts — and that the single report, whose helpers it
   now shares, is byte-identical to the copy saved before the refactor. */
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
  it("is unchanged by sharing its helpers (byte-identical to the saved copy)", async () => {
    const a = all.find((x) => x.findings.length > 0 && x.scope)!;
    await expect(renderReportHtml(a, new Date("2026-10-05T12:00:00Z"))).toMatchFileSnapshot("./__snapshots__/single-report.html");
  });
});
