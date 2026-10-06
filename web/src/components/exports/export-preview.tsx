/* Shows one export the way the reader will see it: the report in a frame, the CSV as a
   table, JSON and SARIF as code. The PDF needs a browser on the dashboard machine; without
   one the HTML report is offered instead. */
import { Printer } from "lucide-react";
import Link from "next/link";

import { csvRows } from "@/lib/data/export";
import type { Assessment } from "@/lib/data/schema";
import { type ExportFormat, exportSpec, openHref, previewHref } from "@/lib/report/formats";

import { Notice } from "../neu/notice";
import { CodePreview } from "./code-preview";
import { CsvPreview } from "./csv-preview";
import { FramePreview } from "./frame-preview";

interface Props {
  assessment: Assessment;
  format: ExportFormat;
  /** The export's text (every format but the PDF). */
  text: string | null;
  pdfReady: boolean;
}

export function ExportPreview({ assessment: a, format, text, pdfReady }: Props) {
  const spec = exportSpec(format);
  if (format === "pdf") {
    if (!pdfReady) {
      return (
        <Notice icon={<Printer size={18} />} tone="warn">
          <b className="font-semibold">No PDF printer here.</b> PDF export needs Chrome or Chromium on the computer that
          runs this dashboard (set <code className="font-mono">RECONIX_CHROME</code> to its path). Meanwhile, preview the{" "}
          <Link href={previewHref(a.uid, "html")} className="link">
            HTML report
          </Link>{" "}
          and print it to PDF from your browser.
        </Notice>
      );
    }
    return <FramePreview src={`${openHref(a.uid, "pdf")}#toolbar=0&view=FitH`} title={`${a.label} — ${spec.title}`} />;
  }
  if (format === "html") return <FramePreview src={openHref(a.uid, "html")} title={`${a.label} — ${spec.title}`} />;
  if (format === "csv") return <CsvPreview rows={csvRows(a)} raw={text ?? ""} />;
  return <CodePreview text={text ?? ""} label={spec.title} />;
}
