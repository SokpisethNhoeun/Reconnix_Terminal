/* Shows one export the way the reader will see it: the PDF in a frame, the Word document's
   content, the JSON as code. The PDF needs a browser on the dashboard machine; without one
   the Word document is offered instead. */
import { Printer } from "lucide-react";
import Link from "next/link";

import type { Assessment } from "@/lib/data/schema";
import { docxBlocks } from "@/lib/report/docx-blocks";
import { type ExportFormat, exportSpec, openHref, previewHref } from "@/lib/report/formats";

import { Notice } from "../neu/notice";
import { CodePreview } from "./code-preview";
import { DocxPreview } from "./docx-preview";
import { FramePreview } from "./frame-preview";

interface Props {
  assessment: Assessment;
  format: ExportFormat;
  /** The JSON export's text (null for the other formats). */
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
          runs this dashboard (set <code className="font-mono">RECONIX_CHROME</code> to its path). Meanwhile, export the{" "}
          <Link href={previewHref(a.uid, "docx")} className="link">
            Word document
          </Link>{" "}
          instead.
        </Notice>
      );
    }
    return <FramePreview src={`${openHref(a.uid)}#toolbar=0&view=FitH`} title={`${a.label} — ${spec.title}`} />;
  }
  if (format === "docx") return <DocxPreview blocks={docxBlocks(a)} />;
  return <CodePreview text={text ?? ""} label={spec.title} />;
}
