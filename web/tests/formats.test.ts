/* The export format registry and the renderers the menu, preview page and route share. */
import { describe, expect, it } from "vitest";

import { renderDocx, xmlText } from "@/lib/report/docx";
import { docxBlocks } from "@/lib/report/docx-blocks";
import {
  EXPORT_FORMATS,
  downloadHref,
  exportFileName,
  isExportFormat,
  openHref,
  previewHref,
} from "@/lib/report/formats";
import { renderJson } from "@/lib/report/render";

import { sampleAssessments } from "./fixtures";

const assessment = sampleAssessments().find((a) => a.findings.length > 0)!;

describe("export formats", () => {
  it("offers only PDF, DOCX and JSON, each with its own extension and media type", () => {
    expect(EXPORT_FORMATS.map((f) => f.id)).toEqual(["pdf", "docx", "json"]);
    expect(new Set(EXPORT_FORMATS.map((f) => f.ext)).size).toBe(3);
    expect(new Set(EXPORT_FORMATS.map((f) => f.media)).size).toBe(3);
  });

  it("accepts only known ids", () => {
    expect(isExportFormat("docx")).toBe(true);
    for (const bad of ["html", "csv", "sarif", "exe", "", "PDF", "../pdf"]) expect(isExportFormat(bad)).toBe(false);
  });

  it("builds the download, open and preview links from the uid", () => {
    expect(exportFileName("20261005-140300-9f76_RCX-DEMO-001", "docx")).toBe("20261005-140300-9f76_RCX-DEMO-001.docx");
    expect(downloadHref("u1", "docx")).toBe("/api/assessments/u1/export?format=docx");
    expect(openHref("u1")).toBe("/api/assessments/u1/export?format=pdf&inline=1");
    expect(previewHref("u1", "json")).toBe("/assessments/u1/export?format=json");
    expect(downloadHref("a b/c", "docx")).toBe("/api/assessments/a%20b%2Fc/export?format=docx");
  });
});

describe("renderDocx", () => {
  it("is a zip with the Word parts, and has a section per finding", () => {
    const file = renderDocx(assessment);
    expect(file.subarray(0, 4).toString("binary")).toBe("PK\x03\x04");
    for (const part of ["[Content_Types].xml", "word/document.xml", "word/styles.xml"]) {
      expect(file.includes(Buffer.from(part))).toBe(true);
    }
    const headings = docxBlocks(assessment).filter((b) => b.kind === "h2");
    expect(headings).toHaveLength(assessment.findings.length);
  });

  it("escapes text for XML and drops control characters", () => {
    expect(xmlText('<w:t a="1">&\u0001')).toBe("&lt;w:t a=&quot;1&quot;&gt;&amp;");
  });
});

describe("renderJson", () => {
  it("is the saved assessment", () => {
    const json = JSON.parse(renderJson(assessment));
    expect(json.uid).toBe(assessment.uid);
    expect(json.findings).toHaveLength(assessment.findings.length);
  });
});
