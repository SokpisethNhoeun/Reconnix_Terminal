/* The export formats the dashboard offers for one assessment: one list that the Export menu,
   the preview page and the API route all read, so they can never disagree. Pure metadata and
   URL helpers; safe to import from client components. */

export type ExportFormat = "pdf" | "docx" | "json";
export type PreviewKind = "frame" | "document" | "code";

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
    id: "docx",
    label: "DOCX",
    title: "Word document",
    ext: "docx",
    media: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    blurb: "The report as an editable Word document: open it in Word, LibreOffice or Google Docs.",
    contents: "engagement details, executive summary, findings table, detailed findings",
    preview: "document",
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

/** The PDF shown in the browser instead of downloaded (the preview frames it). */
export const openHref = (uid: string) => `${downloadHref(uid, "pdf")}&inline=1`;

/** The preview page for one format. */
export const previewHref = (uid: string, id: ExportFormat) =>
  `/assessments/${encodeURIComponent(uid)}/export?format=${id}`;
