/* One place that turns a saved assessment into the text of an export (everything but the
   PDF, which `pdf.ts` prints from the HTML). Server-only so the report renderer never ships
   to the browser. */
import "server-only";

import { toCsv, toSarif } from "@/lib/data/export";
import type { Assessment } from "@/lib/data/schema";

import type { ExportFormat } from "./formats";
import { renderReportHtml } from "./html";

export type TextFormat = Exclude<ExportFormat, "pdf">;

export function renderText(format: TextFormat, assessment: Assessment): string {
  switch (format) {
    case "html":
      return renderReportHtml(assessment);
    case "json":
      return `${JSON.stringify(assessment, null, 2)}\n`;
    case "csv":
      return toCsv(assessment);
    case "sarif":
      return toSarif(assessment);
  }
}
