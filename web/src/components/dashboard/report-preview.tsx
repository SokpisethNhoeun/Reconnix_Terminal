"use client";

/* The combined report's preview: the HTML the route serves, framed in a fully sandboxed
   <iframe> (no scripts, an opaque origin) that scrolls inside itself. A loading state while the
   report is fetched and the frame loads, an error state with Retry when the fetch fails, and a
   note when the selection or options changed since this preview was shown. */
import { RefreshCw, TriangleAlert } from "lucide-react";

import { DashCard } from "@/components/dashboard/dash-card";

export type PreviewState =
  | { kind: "idle" }
  | { kind: "loading"; href: string; stage: "fetch" | "frame" }
  | { kind: "shown"; href: string }
  | { kind: "failed"; href: string; message: string };

export function ReportPreview({
  state,
  runs,
  stale,
  onLoaded,
  onRetry,
}: {
  state: Exclude<PreviewState, { kind: "idle" }>;
  runs: number;
  stale: boolean;
  onLoaded: () => void;
  onRetry: () => void;
}) {
  const loading = state.kind === "loading";
  const framed = state.kind === "shown" || (state.kind === "loading" && state.stage === "frame");
  return (
    <DashCard id="report-preview" title="Preview" docsHref="/docs/reference/reports" meta={`${runs} ${runs === 1 ? "run" : "runs"} · the same HTML the PDF prints`} className="is-wide">
      {state.kind === "failed" ? (
        <div role="alert" className="rep-error">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          <span>The preview could not be loaded: {state.message}</span>
          <button type="button" onClick={onRetry} className="rep-btn rep-btn-small">
            <RefreshCw className="size-3.5" aria-hidden /> Retry
          </button>
        </div>
      ) : (
        <div className="rep-frame-wrap" aria-busy={loading}>
          {framed && <iframe title="Combined report preview" sandbox="" src={state.href} onLoad={onLoaded} className="rep-frame" data-stage={state.kind} />}
          {loading && (
            <div role="status" className="rep-frame-note">
              Loading the preview…
            </div>
          )}
        </div>
      )}
      {stale && state.kind !== "failed" && (
        <p className="rep-note" role="status">
          The selection or the options changed since this preview. Preview again before generating the PDF.
        </p>
      )}
    </DashCard>
  );
}
