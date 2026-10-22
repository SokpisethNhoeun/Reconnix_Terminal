"use client";

/* Combining saved runs into one report, in the Report view's all-runs mode: the Selection
   panel (the count, the options, Preview report, Generate PDF, Generate DOCX, Clear selection),
   the runs table with a checkbox per run (ReportRuns), and the preview frame (ReportPreview). The
   selection lives here, in state — never in the address — so it survives paging and searching
   the table.

   Preview fetches the HTML once and hands it to a fully sandboxed frame as `srcDoc` (so a
   refused or failed request shows as an error with Retry, and the report is built once).
   Generate PDF and Generate DOCX (report-file.tsx) are enabled once the preview of this exact
   selection and options was shown — both files hold what the preview shows, so it is seen before
   either is saved; each fetches its file, waits for the whole of it, then downloads that one
   blob. A 501 on the PDF (no browser to print with) offers the Word document instead; a 413 on
   the DOCX (DOCX_TOO_LARGE) says why. One request at a time: a change to the selection or the
   options aborts whatever is in flight, and answers to an older request are dropped. */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Eye, X } from "lucide-react";

import { DashCard } from "@/components/dashboard/dash-card";
import { COMBINED_FILES, FileStatus, type FileState, GenerateButton } from "@/components/dashboard/report-file";
import { ReportPreview, type PreviewState } from "@/components/dashboard/report-preview";
import { ReportRuns } from "@/components/dashboard/report-runs";
import type { ReportRunRow } from "@/components/dashboard/report-types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DOCS } from "@/lib/docs-nav";
import {
  COMBINE_MAX,
  COMBINE_OPTION_META,
  type CombinedFile,
  type CombineOptions,
  combinedFileName,
  combinedHref,
  DEFAULT_COMBINE_OPTIONS,
} from "@/lib/report/combined/options";
import { DOCX_TOO_LARGE, NO_PRINTER } from "@/lib/report/formats";

const FETCH_TIMEOUT_MS = 15_000; // the HTML is built in milliseconds

/** A refused response's JSON `detail`, when it has one. */
async function detailOf(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail) return body.detail;
  } catch {
    /* not JSON */
  }
  return null;
}

/** Why a response was refused, from its JSON `detail` when it has one. */
async function describe(res: Response): Promise<string> {
  return (await detailOf(res)) ?? `The dashboard answered ${res.status}.`;
}

/** Save a fetched file under `name` (one click on a temporary link to the blob). */
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
  const [file, setFile] = useState<FileState>({ kind: "idle" });
  const inflight = useRef<AbortController | null>(null); // the one request allowed at a time
  const serial = useRef(0); // its number: answers to an older one are dropped
  const hintId = useId();
  const whyId = useId(); // why Preview / Generate can't act yet (each button's description)

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
  const href = combinedHref(uids, "preview", options);
  const previewed = preview.kind === "shown" && preview.href === href;
  const stale = preview.kind !== "idle" && preview.href !== href;
  const busy = preview.kind === "loading" || file.kind === "generating";

  /** The selection or the options changed: nothing in flight is wanted any more. */
  const changed = () => {
    abortInflight();
    setPreview((p) => (p.kind === "loading" ? { kind: "idle" } : p));
    setFile({ kind: "idle" });
  };
  const toggle = (uid: string) => {
    setSelected((list) => (list.includes(uid) ? list.filter((u) => u !== uid) : list.length < COMBINE_MAX ? [...list, uid] : list));
    changed();
  };
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

  const generate = async (format: CombinedFile) => {
    const { signal, mine } = begin();
    const spec = COMBINED_FILES[format];
    setFile({ kind: "generating", format });
    try {
      const res = await fetchWithin(combinedHref(uids, format, options), spec.timeoutMs, signal, spec.accept);
      if (!mine()) return;
      if (res.status === 501 || res.status === 413) {
        // the message comes from the route (the fixed one when it has none); the DOCX link is ours
        const detail = await detailOf(res);
        if (!mine()) return;
        if (res.status === 501) setFile({ kind: "unsupported", format, message: detail ?? NO_PRINTER, docx: combinedHref(uids, "docx", options) });
        else setFile({ kind: "refused", format, message: detail ?? DOCX_TOO_LARGE });
        return;
      }
      if (!res.ok) {
        const message = await describe(res);
        if (mine()) setFile({ kind: "failed", format, message });
        return;
      }
      const blob = await res.blob();
      if (!mine()) return;
      const name = fileNameOf(res.headers.get("content-disposition")) ?? combinedFileName(uids.length, format, new Date());
      saveBlob(blob, name);
      setFile({ kind: "done", format, name });
    } catch (error) {
      if (!mine()) return;
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      setFile({ kind: "failed", format, message: timedOut ? (format === "pdf" ? "the printer took too long" : "the dashboard took too long") : "the dashboard could not be reached" });
    } finally {
      if (mine()) inflight.current = null;
    }
  };

  const none = selected.length === 0;
  const fileReason = none ? "Pick at least one run" : !previewed ? "Preview the report first" : null;
  // The buttons stay focusable while they can't act (aria-disabled), so focus is never dropped
  // when a click empties the selection or starts a request; the handlers check themselves.
  const previewBlocked = none || busy;
  const fileBlocked = Boolean(fileReason) || busy;

  return (
    <>
      <DashCard
        id="report-combine"
        title="Combine runs"
        docsHref={DOCS.exporting}
        meta={
          <span aria-live="polite">
            {selected.length} of {COMBINE_MAX} selected
          </span>
        }
        className="is-wide"
        bodyClassName="rep-select"
      >
        <p className="rep-help">
          Tick up to {COMBINE_MAX} runs in the table below, choose what to include, preview the report, then generate one PDF or one Word document (DOCX)
          with every run in it. A finding seen in several runs is counted once, with each run as an occurrence.
        </p>
        <fieldset className="rep-options">
          <legend className="rep-legend">Options</legend>
          {COMBINE_OPTION_META.map((o) => (
            <div key={o.key} className="rep-option">
              <Checkbox label={o.label} checked={options[o.key]} onChange={(e) => setOption(o.key, e.target.checked)} aria-describedby={`${hintId}-${o.key}`} />
              <span id={`${hintId}-${o.key}`} className="rep-hint">
                {o.hint}
              </span>
            </div>
          ))}
        </fieldset>
        <div className="rep-actions">
          <Button onClick={() => !previewBlocked && showPreview()} aria-disabled={previewBlocked || undefined} aria-describedby={`${whyId}-preview`}>
            <Eye className="size-3.5" aria-hidden /> {preview.kind === "loading" ? "Loading preview…" : "Preview report"}
          </Button>
          {(Object.keys(COMBINED_FILES) as CombinedFile[]).map((format) => (
            <GenerateButton key={format} format={format} state={file} blocked={fileBlocked} describedBy={`${whyId}-file`} onGenerate={generate} />
          ))}
          <Button variant="quiet" onClick={() => !none && clear()} aria-disabled={none || undefined}>
            <X className="size-3.5" aria-hidden /> Clear selection
          </Button>
          <span id={`${whyId}-preview`} className="rep-reason">
            {none ? "Pick at least one run." : ""}
          </span>
          <span id={`${whyId}-file`} className="rep-reason">
            {fileReason && !none ? `${fileReason}.` : ""}
          </span>
        </div>
        <FileStatus state={file} onRetry={generate} />
      </DashCard>
      <ReportRuns runs={runs} selection={{ chosen, max: COMBINE_MAX, onToggle: toggle }} />
      {preview.kind !== "idle" && <ReportPreview state={preview} runs={selected.length} stale={stale} onRetry={showPreview} />}
    </>
  );
}
