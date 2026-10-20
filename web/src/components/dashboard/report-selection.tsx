"use client";

/* Combining saved runs into one report, in the Report view's all-runs mode: the Selection
   panel (the count, the options, Preview report, Generate PDF, Clear selection), the runs table
   with a checkbox per run (ReportRuns), and the preview frame (ReportPreview). The selection
   lives here, in state — never in the address — so it survives paging and searching the table.

   Preview fetches the HTML once and hands it to a fully sandboxed frame as `srcDoc` (so a
   refused or failed request shows as an error with Retry, and the report is built once).
   Generate PDF is enabled once the preview of this exact selection and options was shown; it
   fetches the PDF, waits for the whole file, then downloads that one blob. A 501 (no browser to
   print with) offers the HTML instead. One request at a time: a change to the selection or the
   options aborts whatever is in flight, and answers to an older request are dropped. */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
  { key: "evidence", label: "Include masked evidence", hint: "each occurrence's evidence lines, as masked when they were saved" },
  { key: "low", label: "Include LOW and INFO findings", hint: "off: only CRITICAL, HIGH and MEDIUM" },
  { key: "appendix", label: "Include the appendix", hint: "tools, references and the saved copies' ids" },
];

const FETCH_TIMEOUT_MS = 15_000; // the HTML is built in milliseconds; the PDF gets the printer's own 90 s
const PDF_TIMEOUT_MS = 120_000;
const UNSUPPORTED = "PDF export needs a Chrome/Chromium browser on the dashboard machine (set RECONIX_CHROME). Download the HTML report instead and print it to PDF.";

/** Why a response was refused, from its JSON `detail` when it has one. */
async function describe(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    if (typeof body.detail === "string" && body.detail) return body.detail;
  } catch {
    /* not JSON */
  }
  return `The dashboard answered ${res.status}.`;
}

const fileNameOf = (disposition: string | null) => disposition?.match(/filename="([A-Za-z0-9._-]+)"/)?.[1] ?? null;

/** A fetch that gives up after `ms` (and when `signal` aborts). */
function fetchWithin(href: string, ms: number, signal: AbortSignal, accept: string): Promise<Response> {
  const timeout = AbortSignal.timeout(ms);
  return fetch(href, { credentials: "same-origin", headers: { accept }, signal: AbortSignal.any([signal, timeout]) });
}

export function ReportCombine({ runs }: { runs: ReportRunRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [options, setOptions] = useState<CombineOptions>(DEFAULT_COMBINE_OPTIONS);
  const [preview, setPreview] = useState<PreviewState>({ kind: "idle" });
  const [pdf, setPdf] = useState<PdfState>({ kind: "idle" });
  const inflight = useRef<AbortController | null>(null); // the one request allowed at a time
  const serial = useRef(0); // its number: answers to an older one are dropped
  const hintId = useId();

  const abortInflight = useCallback(() => {
    inflight.current?.abort();
    inflight.current = null;
    serial.current += 1;
  }, []);
  useEffect(() => abortInflight, [abortInflight]); // unmount

  /** A fresh request; `mine()` says whether it is still the current one. */
  const begin = () => {
    abortInflight();
    const controller = new AbortController();
    inflight.current = controller;
    const id = serial.current;
    return { signal: controller.signal, mine: () => serial.current === id && !controller.signal.aborted };
  };

  const chosen = useMemo(() => new Set(selected), [selected]);
  const uids = useMemo(() => [...selected].sort(), [selected]); // a,b and b,a are the same report
  const href = combinedHref(uids, "html", options);
  const previewed = preview.kind === "shown" && preview.href === href;
  const stale = preview.kind !== "idle" && preview.href !== href;
  const busy = preview.kind === "loading" || pdf.kind === "generating";

  /** The selection or the options changed: nothing in flight is wanted any more. */
  const changed = () => {
    abortInflight();
    setPreview((p) => (p.kind === "loading" ? { kind: "idle" } : p));
    setPdf({ kind: "idle" });
  };
  const toggle = useCallback(
    (uid: string) => {
      setSelected((list) => (list.includes(uid) ? list.filter((u) => u !== uid) : list.length < COMBINE_MAX ? [...list, uid] : list));
      changed();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `changed` only touches refs and setters
    [],
  );
  const setOption = (key: keyof CombineOptions, on: boolean) => {
    setOptions((o) => ({ ...o, [key]: on }));
    changed();
  };
  const clear = () => {
    setSelected([]);
    changed();
  };

  const showPreview = async () => {
    const { signal, mine } = begin();
    setPreview({ kind: "loading", href });
    try {
      const res = await fetchWithin(href, FETCH_TIMEOUT_MS, signal, "text/html");
      if (!mine()) return;
      if (!res.ok) {
        setPreview({ kind: "failed", href, message: await describe(res) });
        return;
      }
      const html = await res.text();
      if (!mine()) return;
      setPreview({ kind: "shown", href, html });
    } catch (error) {
      if (!mine()) return;
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      setPreview({ kind: "failed", href, message: timedOut ? "The dashboard took too long to build the report." : "The dashboard could not be reached." });
    } finally {
      if (mine()) inflight.current = null;
    }
  };

  const generatePdf = async () => {
    const { signal, mine } = begin();
    const pdfHref = combinedHref(uids, "pdf", options);
    setPdf({ kind: "generating" });
    try {
      const res = await fetchWithin(pdfHref, PDF_TIMEOUT_MS, signal, "application/pdf");
      if (!mine()) return;
      if (res.status === 501) {
        let body: { detail?: string; html?: string } = {};
        try {
          body = (await res.json()) as typeof body;
        } catch {
          /* not JSON: the fixed message and the HTML link still apply */
        }
        if (!mine()) return;
        setPdf({ kind: "unsupported", message: typeof body.detail === "string" && body.detail ? body.detail : UNSUPPORTED, html: typeof body.html === "string" ? body.html : href });
        return;
      }
      if (!res.ok) {
        const message = await describe(res);
        if (mine()) setPdf({ kind: "failed", message });
        return;
      }
      const blob = await res.blob();
      if (!mine()) return;
      const name = fileNameOf(res.headers.get("content-disposition")) ?? combinedFileName(uids.length, "pdf", new Date());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setPdf({ kind: "done", name });
    } catch (error) {
      if (!mine()) return;
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      setPdf({ kind: "failed", message: timedOut ? "the printer took too long" : "the dashboard could not be reached" });
    } finally {
      if (mine()) inflight.current = null;
    }
  };

  const none = selected.length === 0;
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
            <div key={o.key} className="rep-option">
              <Checkbox label={o.label} checked={options[o.key]} onChange={(e) => setOption(o.key, e.target.checked)} aria-describedby={`${hintId}-${o.key}`} />
              <span id={`${hintId}-${o.key}`} className="rep-hint">
                {o.hint}
              </span>
            </div>
          ))}
        </fieldset>
        <div className="rep-actions">
          <button type="button" onClick={showPreview} disabled={none || busy} className="rep-btn rep-btn-primary" aria-describedby="rep-preview-why">
            <Eye className="size-3.5" aria-hidden /> {preview.kind === "loading" ? "Loading preview…" : "Preview report"}
          </button>
          <button type="button" onClick={generatePdf} disabled={Boolean(pdfReason) || busy} className="rep-btn" aria-describedby="rep-pdf-why">
            <FileText className="size-3.5" aria-hidden /> {pdf.kind === "generating" ? "Generating…" : "Generate PDF"}
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
      {preview.kind !== "idle" && <ReportPreview state={preview} runs={selected.length} stale={stale} onRetry={showPreview} />}
    </>
  );
}

/** What the PDF is doing, with what to do next: a Retry on failure, the HTML on a 501. The
    region is always there (empty when idle), so a screen reader hears every change. */
function PdfStatus({ state, onRetry }: { state: PdfState; onRetry: () => void }) {
  const failed = state.kind === "failed" || state.kind === "unsupported";
  return (
    <p role="status" aria-live="polite" className={cn("rep-status", failed && "is-error")} data-pdf={state.kind}>
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
          The PDF could not be generated: {state.message}.{" "}
          <button type="button" onClick={onRetry} className="rep-link">
            Retry
          </button>
        </>
      )}
    </p>
  );
}
