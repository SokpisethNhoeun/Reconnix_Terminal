/* The export format registry and the text renderers the menu, preview page and route share. */
import { describe, expect, it } from "vitest";

import {
  EXPORT_FORMATS,
  downloadHref,
  exportFileName,
  isExportFormat,
  openHref,
  previewHref,
} from "@/lib/report/formats";
import { renderText } from "@/lib/report/render";

import { sampleAssessments } from "./fixtures";

const assessment = sampleAssessments().find((a) => a.findings.length > 0)!;

describe("export formats", () => {
  it("lists five distinct formats with their own extension and media type", () => {
    expect(EXPORT_FORMATS.map((f) => f.id)).toEqual(["pdf", "html", "json", "csv", "sarif"]);
    expect(new Set(EXPORT_FORMATS.map((f) => f.ext)).size).toBe(5);
    expect(new Set(EXPORT_FORMATS.map((f) => f.media)).size).toBe(5);
  });

  it("accepts only known ids", () => {
    expect(isExportFormat("csv")).toBe(true);
    for (const bad of ["exe", "", "PDF", "../pdf"]) expect(isExportFormat(bad)).toBe(false);
  });

  it("builds the download, open and preview links from the uid", () => {
    expect(exportFileName("20261005-140300-9f76_RCX-DEMO-001", "sarif")).toBe("20261005-140300-9f76_RCX-DEMO-001.sarif");
    expect(downloadHref("u1", "csv")).toBe("/api/assessments/u1/export?format=csv");
    expect(openHref("u1", "pdf")).toBe("/api/assessments/u1/export?format=pdf&inline=1");
    expect(openHref("u1", "html")).toBe("/api/assessments/u1/export?format=html");
    expect(previewHref("u1", "json")).toBe("/assessments/u1/export?format=json");
    expect(downloadHref("a b/c", "csv")).toBe("/api/assessments/a%20b%2Fc/export?format=csv");
  });
});

describe("renderText", () => {
  it("renders every text format from one assessment", () => {
    expect(renderText("html", assessment)).toContain("Security Assessment Report");
    expect(renderText("csv", assessment).split("\n")[0]).toContain("ID,Severity");
    expect(JSON.parse(renderText("sarif", assessment)).version).toBe("2.1.0");
    const json = JSON.parse(renderText("json", assessment));
    expect(json.uid).toBe(assessment.uid);
    expect(json.findings).toHaveLength(assessment.findings.length);
  });
});
