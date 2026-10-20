"use client";

/* Audit log: every activity line of the run in order, with who wrote it, filterable by kind
   and author and searchable. Filters live in the address (`?kind=policy&who=AI&aq=blocked`),
   so the Overview's "Blocked by policy" count can open the matching lines. */
import { FilterChips, FilterSummary, SearchField } from "@/components/dashboard/filter-bar";
import { countBy, list, logMatches } from "@/components/dashboard/filters";
import { useQueryParams } from "@/components/dashboard/view-url";
import type { LogKind, LogLine } from "@/lib/data/view-types";

// Colour + label per log kind.
const KIND: Record<LogKind, { tone: string; label: string }> = {
  info: { tone: "muted-foreground", label: "info" },
  scope: { tone: "primary", label: "scope" },
  policy: { tone: "accent", label: "policy" },
  tool: { tone: "primary", label: "tool" },
  mask: { tone: "primary", label: "mask" },
  finding: { tone: "danger", label: "finding" },
  gate: { tone: "accent", label: "gate" },
  user: { tone: "success", label: "operator" },
};
const KIND_ORDER: LogKind[] = ["gate", "policy", "finding", "tool", "scope", "mask", "user", "info"];
// The TUI's activity-log authors (anything else is listed after them).
const WHO_ORDER = ["POLICY", "TOOL", "AI", "USER", "SYS"];
const KEYS = ["kind", "who", "aq"] as const;

export function AuditView({ log }: { log: LogLine[] }) {
  const [p, update] = useQueryParams(KEYS);
  const filter = { kinds: list(p.kind), whos: list(p.who), q: p.aq };
  const active = filter.kinds.length > 0 || filter.whos.length > 0 || p.aq.trim() !== "";
  const shown = log.filter((l) => logMatches(l, filter));
  const kindChips = countBy(log, (l) => l.kind, KIND_ORDER)
    .filter((c) => c.count > 0 || filter.kinds.includes(c.value))
    .map((c) => ({ ...c, label: KIND[c.value as LogKind]?.label ?? c.value, tone: KIND[c.value as LogKind]?.tone }));
  const whoChips = countBy(log, (l) => l.who, WHO_ORDER)
    .filter((c) => c.count > 0 || filter.whos.includes(c.value))
    .map((c) => ({ ...c, label: c.value }));

  return (
    <div className="dash-view max-w-4xl">
      <header className="mb-3">
        <h1 className="text-[20px] font-medium text-foreground">Audit log</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {log.length} events · every scope check, tool step, mask, gate and operator decision, in order.
        </p>
      </header>

      {log.length > 0 && (
        <div className="mb-3 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="w-full sm:w-[240px]">
              <SearchField label="Search the audit log" placeholder="Search text or time…" value={p.aq} onChange={(aq) => update({ aq })} />
            </div>
            <FilterChips label="Kind" multi options={kindChips} selected={filter.kinds} onChange={(next) => update({ kind: next.join(",") })} />
            <FilterChips label="By" multi options={whoChips} selected={filter.whos} onChange={(next) => update({ who: next.join(",") })} />
          </div>
          <FilterSummary shown={shown.length} total={log.length} noun="events" active={active} onClear={() => update({ kind: "", who: "", aq: "" })} />
        </div>
      )}

      {log.length > 0 && shown.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No event matches these filters.</p>
      )}

      <ol className="relative flex flex-col gap-0.5 border-l border-border pl-0">
        {shown.map((l, i) => {
          const k = KIND[l.kind];
          const isGate = l.kind === "gate";
          return (
            <li
              key={i}
              className="dash-log-row grid grid-cols-[64px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 rounded-lg px-3 py-2 sm:grid-cols-[72px_84px_56px_minmax(0,1fr)]"
              style={isGate ? { background: "color-mix(in oklab, var(--accent) 8%, transparent)" } : undefined}
            >
              <time className="font-mono text-[11px] tabnums text-muted-foreground">{l.t}</time>
              <span className="flex items-center gap-1.5 sm:contents">
                <span
                  className="dash-chip h-[18px] justify-center rounded-md px-1.5 text-[9px] uppercase"
                  style={{ background: `color-mix(in oklab, var(--${k.tone}) 14%, transparent)`, color: `var(--${k.tone})` }}
                >
                  {k.label}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">{l.who}</span>
              </span>
              <span className="col-span-2 min-w-0 text-sm text-foreground [overflow-wrap:anywhere] sm:col-span-1">{l.text}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
