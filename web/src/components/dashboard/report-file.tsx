"use client";

/* The combined report's two files (PDF and DOCX) in the Selection panel: what each one is (its
   label, media type, how long to wait, what to say while it is built), the Generate button they
   share, and the status line that reports on the last one asked for. report-selection.tsx owns
   the request; these only show it. */
import { Download, FileText, FileType, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CombinedFile } from "@/lib/report/combined/options";
import { DOCX_MEDIA } from "@/lib/report/formats";
import { cn } from "@/lib/utils";

export interface FileSpec {
  /** The format's name on the button and in the messages. */
  label: string;
  accept: string;
  /** How long to wait for the whole file. */
  timeoutMs: number;
  /** The status line while the file is built. */
  doing: string;
  Icon: LucideIcon;
}

/** The PDF gets the printer's own 90 s and some; the Word document is built in memory. */
export const COMBINED_FILES: Record<CombinedFile, FileSpec> = {
  pdf: {
    label: "PDF",
    accept: "application/pdf",
    timeoutMs: 120_000,
    doing: "Generating the PDF on this computer — the download starts when the file is complete.",
    Icon: FileText,
  },
  docx: {
    label: "DOCX",
    accept: DOCX_MEDIA,
    timeoutMs: 30_000,
    doing: "Generating the Word document — the download starts when the file is complete.",
    Icon: FileType,
  },
};

export type FileState =
  | { kind: "idle" }
  | { kind: "generating"; format: CombinedFile }
  | { kind: "done"; format: CombinedFile; name: string }
  /** 501: no browser to print the PDF with; the Word document is offered instead. */
  | { kind: "unsupported"; format: CombinedFile; message: string; docx: string }
  /** 413: the Word document would be too large; asking again would not help. */
  | { kind: "refused"; format: CombinedFile; message: string }
  | { kind: "failed"; format: CombinedFile; message: string };

/** "Generate PDF" / "Generate DOCX": focusable while it can't act (aria-disabled, with the reason
    as its description), so focus is never dropped; `onGenerate` runs only when it can. */
export function GenerateButton({
  format,
  state,
  blocked,
  describedBy,
  onGenerate,
}: {
  format: CombinedFile;
  state: FileState;
  blocked: boolean;
  describedBy: string;
  onGenerate: (format: CombinedFile) => void;
}) {
  const { label, Icon } = COMBINED_FILES[format];
  const generating = state.kind === "generating" && state.format === format;
  return (
    <Button variant="outline" onClick={() => !blocked && onGenerate(format)} aria-disabled={blocked || undefined} aria-describedby={describedBy}>
      <Icon className="size-3.5" aria-hidden /> {generating ? `Generating ${label}…` : `Generate ${label}`}
    </Button>
  );
}

/** What the last file asked for is doing, with what to do next: Retry on a failure, the Word
    document on a 501, the reason on a 413. The region is always there (empty while idle), so a
    screen reader hears every change. */
export function FileStatus({ state, onRetry }: { state: FileState; onRetry: (format: CombinedFile) => void }) {
  const failed = state.kind === "failed" || state.kind === "unsupported" || state.kind === "refused";
  const spec = state.kind === "idle" ? null : COMBINED_FILES[state.format];
  return (
    <p
      role="status"
      className={cn("rep-status", state.kind === "idle" && "sr-only", failed && "is-error")}
      data-file={state.kind}
      data-format={state.kind === "idle" ? undefined : state.format}
    >
      {state.kind === "generating" && spec?.doing}
      {state.kind === "done" && `Downloaded ${state.name}.`}
      {state.kind === "unsupported" && (
        <>
          {state.message}{" "}
          <a href={state.docx} download className="ui-link inline-flex items-center gap-1">
            <Download className="size-3.5" aria-hidden /> Download DOCX
          </a>
        </>
      )}
      {state.kind === "refused" && state.message}
      {state.kind === "failed" && (
        <>
          The {spec?.label} could not be generated: {state.message}.{" "}
          <button type="button" onClick={() => onRetry(state.format)} className="ui-link">
            Retry
          </button>
        </>
      )}
    </p>
  );
}
