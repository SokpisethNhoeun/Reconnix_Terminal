/* The report exports (CSV, SARIF) built from a saved assessment. */
import { describe, expect, it } from "vitest";

import { csvRows, toCsv, toSarif } from "@/lib/data/export";

import { sampleAssessments } from "./fixtures";

const assessment = sampleAssessments().find((a) => a.findings.length > 0)!;

describe("report exports", () => {
  it("CSV has a header and one row per finding", () => {
    const lines = toCsv(assessment).trimEnd().split("\n");
    expect(lines[0].startsWith("ID,Severity,CVSS")).toBe(true);
    expect(lines).toHaveLength(1 + assessment.findings.length);
  });

  it("CSV rows (the preview table) are the file's rows", () => {
    const rows = csvRows(assessment);
    expect(rows).toHaveLength(1 + assessment.findings.length);
    expect(rows[0]).toHaveLength(13);
    expect(rows.every((r) => r.length === rows[0].length)).toBe(true);
    expect(rows[1][6]).toBe(assessment.findings[0].title);
  });

  it("CSV escapes commas and quotes", () => {
    const tricky = { ...assessment, findings: [{ ...assessment.findings[0], title: 'A, "B"' }] };
    const row = toCsv(tricky as typeof assessment).split("\n")[1];
    expect(row).toContain('"A, ""B"""');
  });

  it("SARIF is valid 2.1.0 with a result per finding", () => {
    const doc = JSON.parse(toSarif(assessment));
    expect(doc.version).toBe("2.1.0");
    expect(doc.runs[0].tool.driver.name).toBe("Reconix");
    expect(doc.runs[0].results).toHaveLength(assessment.findings.length);
  });
});
