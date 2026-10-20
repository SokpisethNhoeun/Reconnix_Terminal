"use client";

/* Combining saved runs into one report, in the Report view's all-runs mode: the Selection
   panel (the count, the options, Preview report, Generate PDF, Clear selection), the runs table
   with a checkbox per run (ReportRuns), and the preview frame (ReportPreview). The selection
   lives here, in state — never in the address — so it survives paging and searching the table.

   Preview fetches the HTML first (so a refused or failed request shows as an error, not as a
   blank frame) and then frames the same URL. Generate PDF is enabled once the preview of this
   exact selection and options was shown; it fetches the PDF, waits for the whole file, then
   downloads that one blob. A 501 (no browser to print with) offers the HTML instead. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileText, X } from "lucide-react";

import { DashCard } from "@/components/dashboard/dash-card";
import { ReportPreview, type PreviewState } from "@/components/dashboard/report-preview";
import { ReportRuns } from "@/components/dashboard/report-runs";
import type { ReportRunRow } from "@/components/dashboard/report-types";
import { Checkbox } from "@/components/ui/checkbox";
import { COMBINE_MAX, type CombineOptions, combinedFileName, combinedHref, DEFAULT_COMBINE_OPTIONS } from "@/lib/report/combined/options";
import { cn } from "@/lib/utils";

type PdfState =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "done"; name: string }
  | { kind: "unsupported"; message: string; html: string }
  | { kind: "failed"; message: string };

const OPTIONS: { key: keyof CombineOptions; label: string; hint: string }[] = [
  { key: "evidence", label: "Include masked evidence", hint: "Each occurrence's evidence lines, as masked when they were saved." },
  { key: "low", label: "Include LOW and INFO findings", hint: "Off: only CRITICAL, HIGH and MEDIUM findings." },
  { key: "appendix", label: "Include the appendix", hint: "Tools, references and the saved copies' ids." },
];

/** Why a response was refused, from its JSON `detail` when it has one. */
async function describe(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    if (body.detail) return body.detail;
  } catch {
    /* not JSON */
  }
  return `The dashboard answered ${res.status}.`;
}

const fileNameOf = (disposition: string | null) => disposition?.match(/filename="([A-Za-z0-9._-]+)"/)?.[1] ?? null;

export function ReportCombine({ runs }: { runs: ReportRunRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [options, setOptions] = useState<CombineOptions>(DEFAULT_COMBINE_OPTIONS);
  const [preview, setPreview] = useState<PreviewState>({ kind: "idle" });
  const [pdf, setPdf] = useState<PdfState>({ kind: "idle" });
  const request = useRef(0); // the latest preview request: older answers are dropped
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const chosen = useMemo(() => new Set(selected), [selected]);
  const href = combinedHref(selected, "html", options);
  const previewed = preview.kind === "shown" && preview.href === href;
  const stale = preview.kind !== "idle" && preview.href !== href;

  const toggle = useCallback((uid: string) => {
    setSelected((list) => (list.includes(uid) ? list.filter((u) => u !== uid) : list.length < COMBINE_MAX ? [...list, uid] : list));
    setPdf({ kind: "idle" });
  }, []);
  const setOption = (key: keyof CombineOptions, on: boolean) => {
    setOptions((o) => ({ ...o, [key]: on }));
    setPdf({ kind: "idle" });
  };
  const clear = () => {
    setSelected([]);
    setPdf({ kind: "idle" });
  };

  const showPreview = async () => {
    const id = (request.current += 1);
    setPreview({ kind: "loading", href, stage: "fetch" });
    try {
      const res = await fetch(href, { credentials: "same-origin", headers: { accept: "text/html" } });
      if (!alive.current || request.current !== id) return;
      if (!res.ok) {
        setPreview({ kind: "failed", href, message: await describe(res) });
        return;
      }
      setPreview({ kind: "loading", href, stage: "frame" });
    } catch {
      if (alive.current && request.current === id) setPreview({ kind: "failed", href, message: "The dashboard could not be reached." });
    }
  };
  const frameLoaded = () => setPreview((p) => (p.kind === "loading" && p.stage === "frame" ? { kind: "shown", href: p.href } : p));

  const generatePdf = async () => {
    setPdf({ kind: "generating" });
    try {
      const res = await fetch(combinedHref(selected, "pdf", options), { credentials: "same-origin" });
      if (!alive.current) return;
      if (res.status === 501) {
        const body = (await res.json()) as { detail: string; html: string };
        setPdf({ kind: "unsupported", message: body.detail, html: body.html });
        return;
      }
      if (!res.ok) {
        setPdf({ kind: "failed", message: await describe(res) });
        return;
      }
      const blob = await res.blob();
      if (!alive.current) return;
      const name = fileNameOf(res.headers.get("content-disposition")) ?? combinedFileName(selected.length, "pdf", new Date());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setPdf({ kind: "done", name });
    } catch {
      if (alive.current) setPdf({ kind: "failed", message: "The dashboard could not be reached." });
    }
  };

  const none = selected.length === 0;
  const generating = pdf.kind === "generating";
  const pdfReason = none ? "Pick at least one run" : !previewed ? "Preview the report first" : null;

  return (
    <>
      <DashCard
        id="report-combine"
        title="Combine runs"
        docsHref="/docs/reference/reports"
        meta={
          <span aria-live="polite">
            {selected.length} of {COMBINE_MAX} selected
          </span>
        }
        className="is-wide"
        bodyClassName="rep-select"
      >
        <p className="rep-help">
          Tick up to {COMBINE_MAX} runs in the table below, choose what to include, preview the report, then generate one PDF with every run in it. A finding
          seen in several runs is counted once, with each run as an occurrence.
        </p>
        <fieldset className="rep-options">
          <legend className="rep-legend">Options</legend>
          {OPTIONS.map((o) => (
            <Checkbox key={o.key} label={o.label} title={o.hint} checked={options[o.key]} onChange={(e) => setOption(o.key, e.target.checked)} />
          ))}
        </fieldset>
        <div className="rep-actions">
          <button type="button" onClick={showPreview} disabled={none || preview.kind === "loading"} className="rep-btn rep-btn-primary" aria-describedby="rep-preview-why">
            <Eye className="size-3.5" aria-hidden /> {preview.kind === "loading" ? "Loading preview…" : "Preview report"}
          </button>
          <button type="button" onClick={generatePdf} disabled={Boolean(pdfReason) || generating} className="rep-btn" aria-describedby="rep-pdf-why">
            <FileText className="size-3.5" aria-hidden /> {generating ? "Generating…" : "Generate PDF"}
          </button>
          <button type="button" onClick={clear} disabled={none} className="rep-btn rep-btn-quiet">
            <X className="size-3.5" aria-hidden /> Clear selection
          </button>
          <span id="rep-preview-why" className="rep-reason">
            {none ? "Pick at least one run." : ""}
          </span>
          <span id="rep-pdf-why" className="rep-reason">
            {pdfReason && !none ? `${pdfReason}.` : ""}
          </span>
        </div>
        <PdfStatus state={pdf} onRetry={generatePdf} />
      </DashCard>
      <ReportRuns runs={runs} selection={{ chosen, max: COMBINE_MAX, onToggle: toggle }} />
      {preview.kind !== "idle" && <ReportPreview state={preview} runs={selected.length} stale={stale} onLoaded={frameLoaded} onRetry={showPreview} />}
    </>
  );
}

/** What the PDF is doing, with what to do next: a Retry on failure, the HTML on a 501. */
function PdfStatus({ state, onRetry }: { state: PdfState; onRetry: () => void }) {
  const failed = state.kind === "failed" || state.kind === "unsupported";
  return (
    <p role={failed ? "alert" : "status"} aria-live={failed ? undefined : "polite"} className={cn("rep-status", failed && "is-error")} data-pdf={state.kind}>
      {state.kind === "generating" && "Generating the PDF on this computer — the download starts when the file is complete."}
      {state.kind === "done" && `Downloaded ${state.name}.`}
      {state.kind === "unsupported" && (
        <>
          {state.message}{" "}
          <a href={state.html} download className="rep-link">
            <Download className="size-3.5" aria-hidden /> Download HTML
          </a>
        </>
      )}
      {state.kind === "failed" && (
        <>
          The PDF could not be generated: {state.message}{" "}
          <button type="button" onClick={onRetry} className="rep-link">
            Retry
          </button>
        </>
      )}
    </p>
  );
}
