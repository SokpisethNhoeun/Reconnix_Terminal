"use client";

import { useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { FindingRow, Tone } from "@/components/dashboard/derive";
import { FilterChips, FilterSummary, SearchField } from "@/components/dashboard/filter-bar";
import { FINDING_ICON } from "@/components/dashboard/finding-icon";
import { SEVERITY_ORDER, VALIDATION, countBy, findingMatches, list, sortFindings, validationOf } from "@/components/dashboard/filters";
import { useQueryParams } from "@/components/dashboard/view-url";

const SEV_TONE: Record<string, string> = { CRITICAL: "danger", HIGH: "danger", MEDIUM: "accent", LOW: "success", INFO: "muted-foreground" };
const VAL_LABEL: Record<string, string> = { confirmed: "Confirmed", review: "Needs review", closed: "Closed" };
const KEYS = ["sev", "val", "q", "finding"] as const;
const WRAP = "[overflow-wrap:anywhere]"; // saved text may hold long unbroken tokens (URLs, payloads)

function SevBadge({ level, tone }: { level: string; tone: Tone }) {
  const color = tone === "dim" ? "muted-foreground" : tone;
  return (
    <span
      className="dash-chip h-[18px] rounded-md px-1.5 text-[9px] uppercase"
      style={{ background: `color-mix(in oklab, var(--${color}) 14%, transparent)`, color: `var(--${color})` }}
    >
      {level}
    </span>
  );
}

/** CONFIRMED (green), NEEDS_REVIEW (amber: open and not confirmed), else the triage status. */
function ValidationChip({ f }: { f: FindingRow }) {
  const [label, tone] = f.confirmed ? ["CONFIRMED", "success"] : f.needsReview ? ["NEEDS_REVIEW", "accent"] : [f.status.toUpperCase(), "muted-foreground"];
  return (
    <span
      className="dash-chip h-[20px] rounded-md px-2 text-[10px]"
      style={{ background: `color-mix(in oklab, var(--${tone}) 14%, transparent)`, color: `var(--${tone})` }}
    >
      {label}
    </span>
  );
}

const EV_STYLE: Record<string, string> = {
  request: "text-muted-foreground",
  response: "text-foreground",
  masked: "text-accent",
};

/**
 * Findings: search and filter chips (severity, validation) over the list, and the selected
 * finding's evidence and remediation. Filters and the selection live in the address
 * (`?sev=HIGH,LOW&val=review&q=sql&finding=F-001`), so the Overview can drill into them.
 * With `across` set the list holds every saved run's findings: each row names its run, and the
 * selection is the row's key (`<uid>~F-001`).
 */
export function FindingsView({ findings, across = null }: { findings: FindingRow[]; across?: number | null }) {
  const [p, update] = useQueryParams(KEYS);
  const detail = useRef<HTMLElement>(null);
  // On narrow screens the detail sits under the whole list: bring it into view on a pick.
  const open = (id: string) => {
    update({ finding: id });
    if (!window.matchMedia("(max-width: 1023.98px)").matches) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => detail.current?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" }));
  };
  const filter = { sev: list(p.sev).filter((s) => (SEVERITY_ORDER as readonly string[]).includes(s)), val: p.val, q: p.q };
  const active = filter.sev.length > 0 || (VALIDATION as readonly string[]).includes(p.val) || p.q.trim() !== "";
  const sorted = sortFindings(findings.filter((f) => findingMatches(f, filter)));
  const current = sorted.find((f) => f.key === p.finding) ?? sorted[0];
  const runHref = (f: FindingRow) => (f.run ? `/?uid=${encodeURIComponent(f.run.uid)}&view=findings&finding=${encodeURIComponent(f.id)}` : "");
  const sevChips = countBy(findings, (f) => f.severity, SEVERITY_ORDER)
    .filter((c) => c.count > 0 || filter.sev.includes(c.value))
    .map((c) => ({ ...c, label: c.value.toLowerCase(), tone: SEV_TONE[c.value] }));
  const valChips = countBy(findings, validationOf, VALIDATION).map((c) => ({ ...c, label: VAL_LABEL[c.value] }));

  return (
    <div className="dash-view">
      <header className="mb-3">
        <h1 className="text-[20px] font-medium text-foreground">Findings</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {findings.length
            ? `${findings.length} ${findings.length === 1 ? "finding" : "findings"}${across !== null ? ` across ${across} ${across === 1 ? "assessment" : "assessments"}` : ""} · select one to see its evidence and remediation.`
            : across !== null
              ? "No findings in any saved assessment yet."
              : "No findings in this assessment yet."}
        </p>
      </header>

      {findings.length > 0 && (
        <div className="mb-4 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="w-full sm:w-[260px]">
              <SearchField label="Search findings" placeholder="Search title, ID, CWE, target…" value={p.q} onChange={(q) => update({ q })} />
            </div>
            <FilterChips label="Severity" multi options={sevChips} selected={filter.sev} onChange={(next) => update({ sev: next.join(","), finding: "" })} />
            <FilterChips
              label="Validation"
              options={valChips}
              selected={filter.val ? [filter.val] : []}
              onChange={([next]) => update({ val: next === p.val ? "" : next, finding: "" })}
            />
          </div>
          <FilterSummary shown={sorted.length} total={findings.length} noun="findings" active={active} onClear={() => update({ sev: "", val: "", q: "", finding: "" })} />
        </div>
      )}

      {findings.length > 0 && !current && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No finding matches these filters.</p>
      )}

      {current && (
        <div className="dash-findings">
          {/* list */}
          <ul className="flex flex-col gap-2" role="listbox" aria-label="Findings">
            {sorted.map((f) => {
              const Icon = FINDING_ICON[f.icon];
              return (
                <li key={f.key} role="option" aria-selected={f.key === current.key}>
                  <button
                    type="button"
                    aria-current={f.key === current.key}
                    onClick={() => open(f.key)}
                    className="dash-finding-row flex items-start gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="dash-tile mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg">
                      <Icon className="size-4 text-muted-foreground" strokeWidth={1.6} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{f.id}</span>
                        <SevBadge level={f.severity} tone={f.tone} />
                        {f.score != null && <span className="ml-auto font-mono text-[11px] tabnums text-foreground">{f.score.toFixed(1)}</span>}
                      </span>
                      <span className="mt-1 block truncate text-sm text-foreground">{f.title}</span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">{f.target}</span>
                      {f.run && <span className="mt-0.5 block truncate font-mono text-[10px] text-primary">{f.run.label}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* detail */}
          <article ref={detail} className="dash-card flex scroll-mt-4 flex-col gap-4 p-4" aria-live="polite">
            <header className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{current.id}</span>
              <SevBadge level={current.severity} tone={current.tone} />
              <span className="font-mono text-xs text-muted-foreground">{current.rating}</span>
              {current.score != null && <span className="ml-auto text-[26px] leading-none tabnums text-foreground">{current.score.toFixed(1)}</span>}
            </header>
            <h2 className={cn("text-lg font-medium leading-snug text-foreground", WRAP)}>{current.title}</h2>
            {current.run && (
              <p className="-mt-2 text-xs text-muted-foreground">
                From{" "}
                <Link href={runHref(current)} className="rounded-sm font-mono text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {current.run.label}
                </Link>
              </p>
            )}

            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              {[
                ["Target", current.target],
                ["Tool", current.tool],
                ["Weakness", current.cwe],
                ["Category", current.category || "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="truncate font-mono text-foreground">{v}</dd>
                </div>
              ))}
            </dl>

            {(current.description || current.impact) && (
              <section>
                <h3 className="mb-1 text-[13px] font-medium text-foreground">Description</h3>
                {current.description && <p className={cn("text-sm leading-relaxed text-muted-foreground", WRAP)}>{current.description}</p>}
                {current.impact && (
                  <p className={cn("mt-2 text-sm leading-relaxed text-muted-foreground", WRAP)}>
                    <span className="text-foreground">Impact · </span>
                    {current.impact}
                  </p>
                )}
              </section>
            )}

            {current.evidence.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[13px] font-medium text-foreground">Evidence</h3>
                <div className="dash-tile overflow-x-auto rounded-lg p-3 font-mono text-[11px] leading-relaxed" data-lenis-prevent>
                  {current.evidence.map((e, i) => (
                    <div key={i} className={cn("whitespace-pre", EV_STYLE[e.tone])}>
                      {e.text}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {current.remediation.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[13px] font-medium text-foreground">Remediation</h3>
                <ul className={cn("list-disc space-y-1 pl-5 text-sm text-muted-foreground", WRAP)}>
                  {current.remediation.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </section>
            )}

            <footer className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs">
              <span className="text-muted-foreground">
                Validation <span className="text-foreground">{current.validation}</span>
              </span>
              <ValidationChip f={current} />
              {current.references.length > 0 && (
                <span className={cn("min-w-0 basis-full font-mono text-[11px] text-muted-foreground sm:ml-auto sm:basis-auto sm:text-right", WRAP)}>
                  {current.references.join(" · ")}
                </span>
              )}
            </footer>
          </article>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        See{" "}
        <Link href="/docs/reference/findings" className="rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          the findings format
        </Link>{" "}
        for how severity, validation and evidence are recorded.
      </p>
    </div>
  );
}
