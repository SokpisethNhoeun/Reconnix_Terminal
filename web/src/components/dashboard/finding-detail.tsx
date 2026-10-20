"use client";

/* The chosen finding: its header (ID, severity, rating, CVSS, title, Previous / Next in the
   filtered order) and, under it, the facts, description, masked evidence (scrolls sideways
   inside), remediation and validation. On the fixed desktop frame the header stays put and only
   the body scrolls, and only when the finding is taller than the frame (styles/findings.css). */
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { forwardRef } from "react";

import type { FindingRow } from "@/components/dashboard/derive";
import { reviewLabel, validationOf } from "@/components/dashboard/filters";
import { IconButton } from "@/components/ui/icon-button";
import { SeverityBadge, StatusBadge } from "@/components/ui/status-badge";
import { FINDING_REVIEW } from "@/lib/status";
import { cn } from "@/lib/utils";

const WRAP = "[overflow-wrap:anywhere]"; // saved text may hold long unbroken tokens (URLs, payloads)
const LINK = "rounded-sm font-mono text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const EV_STYLE: Record<string, string> = {
  request: "text-muted-foreground",
  response: "text-foreground",
  masked: "text-info",
};

export interface FindingDetailProps {
  finding: FindingRow;
  position: { index: number; total: number }; // its place in the filtered order (0-based)
  prev: FindingRow | null;
  next: FindingRow | null;
  onSelect: (key: string) => void;
}

/** A link back to the run a finding came from (the list spans several runs). */
const runHref = (f: FindingRow) => (f.run ? `/?uid=${encodeURIComponent(f.run.uid)}&view=findings&finding=${encodeURIComponent(f.id)}` : "");

export const FindingDetail = forwardRef<HTMLElement, FindingDetailProps>(function FindingDetail({ finding: f, position, prev, next, onSelect }, ref) {
  return (
    <article ref={ref} className="dash-card dash-finding scroll-mt-4 p-4" aria-live="polite" aria-label={`Finding ${f.id}`}>
      <header className="dash-finding-head">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{f.id}</span>
          <SeverityBadge level={f.severity} />
          <span className="font-mono text-xs text-muted-foreground">{f.rating}</span>
          {f.score != null && <span className="ml-auto text-[26px] leading-none tabnums text-foreground">{f.score.toFixed(1)}</span>}
          <nav aria-label="Finding order" className={cn("flex items-center gap-0.5", f.score == null && "ml-auto")}>
            <IconButton label="Previous finding" className="size-7" disabled={!prev} onClick={() => prev && onSelect(prev.key)}>
              <ChevronLeft aria-hidden />
            </IconButton>
            <span className="min-w-[4.5em] text-center font-mono text-[11px] tabnums text-muted-foreground" aria-live="polite">
              {position.index + 1} of {position.total}
            </span>
            <IconButton label="Next finding" className="size-7" disabled={!next} onClick={() => next && onSelect(next.key)}>
              <ChevronRight aria-hidden />
            </IconButton>
          </nav>
        </div>
        <h2 className={cn("text-lg font-medium leading-snug text-foreground", WRAP)}>{f.title}</h2>
        {f.run && (
          <p className="text-xs text-muted-foreground">
            From{" "}
            <Link href={runHref(f)} className={LINK}>
              {f.run.label}
            </Link>
          </p>
        )}
      </header>

      <div className="dash-finding-body">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          {[
            ["Target", f.target],
            ["Tool", f.tool],
            ["Weakness", f.cwe],
            ["Category", f.category || "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate font-mono text-foreground">{v}</dd>
            </div>
          ))}
        </dl>

        {(f.description || f.impact) && (
          <section>
            <h3 className="mb-1 text-[13px] font-medium text-foreground">Description</h3>
            {f.description && <p className={cn("text-sm leading-relaxed text-muted-foreground", WRAP)}>{f.description}</p>}
            {f.impact && (
              <p className={cn("mt-2 text-sm leading-relaxed text-muted-foreground", WRAP)}>
                <span className="text-foreground">Impact · </span>
                {f.impact}
              </p>
            )}
          </section>
        )}

        {f.evidence.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-[13px] font-medium text-foreground">Evidence</h3>
            <div className="dash-tile overflow-x-auto rounded-lg p-3 font-mono text-[11px] leading-relaxed">
              {f.evidence.map((e, i) => (
                <div key={i} className={cn("whitespace-pre", EV_STYLE[e.tone])}>
                  {e.text}
                </div>
              ))}
            </div>
          </section>
        )}

        {f.remediation.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-[13px] font-medium text-foreground">Remediation</h3>
            <ul className={cn("list-disc space-y-1 pl-5 text-sm text-muted-foreground", WRAP)}>
              {f.remediation.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        )}

        <footer className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground">
            Validation <span className="text-foreground">{f.validation}</span>
          </span>
          <StatusBadge meaning={FINDING_REVIEW[validationOf(f)]} label={reviewLabel(f)} />
          {f.references.length > 0 && (
            <span className={cn("min-w-0 basis-full font-mono text-[11px] text-muted-foreground sm:ml-auto sm:basis-auto sm:text-right", WRAP)}>
              {f.references.join(" · ")}
            </span>
          )}
        </footer>
      </div>
    </article>
  );
});
