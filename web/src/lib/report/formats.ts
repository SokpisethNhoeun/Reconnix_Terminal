/* The export formats the dashboard offers for one assessment: one list that the Export menu,
   the preview page and the API route all read, so they can never disagree. Pure metadata and
   URL helpers; safe to import from client components. */

export type ExportFormat = "pdf" | "html" | "json" | "csv" | "sarif";
export type PreviewKind = "frame" | "table" | "code";

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
  /** What is inside, for the facts line. */
  contents: string;
  preview: PreviewKind;
}

export const EXPORT_FORMATS: readonly ExportSpec[] = [
  {
    id: "pdf",
    label: "PDF",
    title: "PDF report",
    ext: "pdf",
    media: "application/pdf",
    blurb: "The styled security report, printed to PDF on this computer. Page 1 is the one-page executive summary.",
    contents: "executive summary, findings table, detailed findings, scope, policy & governance",
    preview: "frame",
  },
  {
    id: "html",
    label: "HTML",
    title: "HTML report",
    ext: "html",
    media: "text/html; charset=utf-8",
    blurb: "The same report as one self-contained web page: open it anywhere, or print it yourself.",
    contents: "executive summary, findings table, detailed findings, scope, policy & governance",
    preview: "frame",
  },
  {
    id: "json",
    label: "JSON",
    title: "JSON snapshot",
    ext: "json",
    media: "application/json; charset=utf-8",
    blurb: "The complete saved assessment, exactly as the terminal app wrote it (evidence already masked).",
    contents: "findings, timeline, scope, policy verdicts, approvals, plan",
    preview: "code",
  },
  {
    id: "csv",
    label: "CSV",
    title: "CSV spreadsheet",
    ext: "csv",
    media: "text/csv; charset=utf-8",
    blurb: "Findings as a spreadsheet: one row per finding, for tracking and triage outside Reconix.",
    contents: "one row per finding: id, severity, CVSS, status, category, location, CWE/OWASP, remediation",
    preview: "table",
  },
  {
    id: "sarif",
    label: "SARIF",
    title: "SARIF 2.1",
    ext: "sarif",
    media: "application/sarif+json; charset=utf-8",
    blurb: "Findings for CI and code-scanning dashboards (SARIF 2.1, one result per finding).",
    contents: "a Reconix tool run with one rule per weakness and one result per finding",
    preview: "code",
  },
];

export const DEFAULT_EXPORT: ExportFormat = "pdf";

export const isExportFormat = (value: string): value is ExportFormat =>
  EXPORT_FORMATS.some((f) => f.id === value);

export function exportSpec(id: ExportFormat): ExportSpec {
  return EXPORT_FORMATS.find((f) => f.id === id) as ExportSpec;
}

export const exportFileName = (uid: string, id: ExportFormat) => `${uid}.${exportSpec(id).ext}`;

/** The API route that serves the file as a download. */
export const downloadHref = (uid: string, id: ExportFormat) =>
  `/api/assessments/${encodeURIComponent(uid)}/export?format=${id}`;

/** The same file shown in the browser (PDF and HTML only); the PDF hides the viewer toolbar. */
export const openHref = (uid: string, id: ExportFormat) =>
  id === "pdf" ? `${downloadHref(uid, id)}&inline=1` : downloadHref(uid, id);

/** The preview page for one format. */
export const previewHref = (uid: string, id: ExportFormat) =>
  `/assessments/${encodeURIComponent(uid)}/export?format=${id}`;
