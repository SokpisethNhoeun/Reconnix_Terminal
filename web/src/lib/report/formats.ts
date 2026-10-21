/* The export formats the dashboard offers for one assessment: one list that the Report view's
   downloads and the API route both read, so they can never disagree. Pure metadata and URL
   helpers; safe to import from client components. */

export type ExportFormat = "pdf" | "html" | "json" | "csv" | "sarif";

export interface ExportSpec {
  id: ExportFormat;
  /** Short name for the switcher and the menu. */
  label: string;
  /** Longer name for headings. */
  title: string;
  ext: string;
  media: string;
  /** What the file is for, in one sentence. */
  blurb: string;
}

export const EXPORT_FORMATS: readonly ExportSpec[] = [
  {
    id: "pdf",
    label: "PDF",
    title: "PDF report",
    ext: "pdf",
    media: "application/pdf",
    blurb: "The styled security report, printed to PDF on this computer. Page 1 is the one-page executive summary.",
  },
  {
    id: "html",
    label: "HTML",
    title: "HTML report",
    ext: "html",
    media: "text/html; charset=utf-8",
    blurb: "The same report as one self-contained web page: open it anywhere, or print it yourself.",
  },
  {
    id: "json",
    label: "JSON",
    title: "JSON snapshot",
    ext: "json",
    media: "application/json; charset=utf-8",
    blurb: "The complete saved assessment, exactly as the terminal app wrote it (evidence already masked).",
  },
  {
    id: "csv",
    label: "CSV",
    title: "CSV spreadsheet",
    ext: "csv",
    media: "text/csv; charset=utf-8",
    blurb: "Findings as a spreadsheet: one row per finding, for tracking and triage outside Reconix.",
  },
  {
    id: "sarif",
    label: "SARIF",
    title: "SARIF 2.1",
    ext: "sarif",
    media: "application/sarif+json; charset=utf-8",
    blurb: "Findings for CI and code-scanning dashboards (SARIF 2.1, one result per finding).",
  },
];

/** The 501 the PDF routes answer, and the Report view repeats, when no browser can print. */
export const NO_PRINTER =
  "PDF export needs a Chrome/Chromium browser on the dashboard machine (set RECONIX_CHROME). Download the HTML report instead and print it to PDF.";

export const isExportFormat = (value: string): value is ExportFormat =>
  EXPORT_FORMATS.some((f) => f.id === value);

export function exportSpec(id: ExportFormat): ExportSpec {
  return EXPORT_FORMATS.find((f) => f.id === id) as ExportSpec;
}

export const exportFileName = (uid: string, id: ExportFormat) => `${uid}.${exportSpec(id).ext}`;

/** The API route that serves the file as a download (the HTML inline; the PDF too with `&inline=1`). */
export const downloadHref = (uid: string, id: ExportFormat) =>
  `/api/assessments/${encodeURIComponent(uid)}/export?format=${id}`;
