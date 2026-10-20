import Link from "next/link";
import { Check, SquareArrowOutUpRight, X } from "lucide-react";
import type { Dashboard } from "@/components/dashboard/derive";
import { StatusBadge } from "@/components/ui/status-badge";
import { APPROVAL_STATE, type Meaning, type Tone } from "@/lib/status";

/** An approval's risk, coloured as the TUI does (LOW green, MEDIUM amber, HIGH red). Risk is not
    a status, so its meaning is defined here. */
const RISK_TONE: Record<string, Tone> = { LOW: "success", MEDIUM: "warning", HIGH: "danger" };
function riskMeaning(risk: string): Meaning {
  const name = risk ? `${risk[0]}${risk.slice(1).toLowerCase()}` : "Unknown";
  return {
    label: `${name} risk`,
    tone: RISK_TONE[risk] ?? "info",
    icon: "severity",
    hint: risk === "HIGH" ? "High risk: approved only after a double check in the TUI." : `${name} risk: needs the operator's approval in the TUI.`,
  };
}

export function ScopeView({ dash }: { dash: Dashboard }) {
  const { scope, approvals, assessment } = dash;
  return (
    <div className="dash-view max-w-3xl">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-medium text-foreground">Scope</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {scope?.approved ? (
              <>
                The approved boundary · operator <span className="font-mono text-foreground">{assessment.operator}</span>.
              </>
            ) : scope ? (
              <>The Scope Manifest is {scope.status.toLowerCase()}; testing waits until it is approved.</>
            ) : (
              <>No Scope Manifest yet: the TUI drafts one after the target and template are set.</>
            )}
          </p>
        </div>
        <Link
          href="/docs/configuration/scope-manifest"
          className="dash-card-open inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Scope Manifest <SquareArrowOutUpRight className="size-3.5" aria-hidden />
        </Link>
      </header>

      {scope && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <section className="dash-card p-4">
              <h2 className="mb-2 text-[13px] font-medium text-foreground">In scope</h2>
              <ul className="space-y-1.5">
                {scope.include.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="size-3.5 shrink-0 text-success" aria-hidden />
                    <span className="truncate font-mono text-xs text-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="dash-card p-4">
              <h2 className="mb-2 text-[13px] font-medium text-foreground">Excluded</h2>
              {scope.exclude.length ? (
                <ul className="space-y-1.5">
                  {scope.exclude.map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <X className="size-3.5 shrink-0 text-danger" aria-hidden />
                      <span className="truncate font-mono text-xs text-foreground">{t}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Nothing excluded.</p>
              )}
            </section>
          </div>

          <section className="dash-card mt-3 p-4">
            <h2 className="mb-3 text-[13px] font-medium text-foreground">Permitted actions</h2>
            <ul className="flex flex-wrap gap-2">
              {scope.actions.map((a) => (
                <li key={a} className="dash-chip h-[26px] border border-border px-2.5 text-xs text-foreground">
                  {a}
                </li>
              ))}
            </ul>
            {scope.tools.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Tools · <span className="font-mono text-foreground">{scope.tools.join(", ")}</span>
              </p>
            )}
          </section>

          {approvals.length > 0 && (
            <section className="dash-card mt-3 p-4">
              <h2 className="mb-3 text-[13px] font-medium text-foreground">Approval requests</h2>
              <ul className="space-y-2">
                {approvals.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                    <span className="min-w-0 flex-1 basis-[200px]">
                      <span className="block truncate text-foreground">{a.action}</span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">{a.target}</span>
                    </span>
                    <StatusBadge meaning={riskMeaning(a.risk)} />
                    <StatusBadge meaning={APPROVAL_STATE[a.state]} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="dash-card mt-3 p-4">
            <h2 className="mb-3 text-[13px] font-medium text-foreground">Limits</h2>
            <dl className="grid grid-cols-3 gap-4">
              {scope.limits.map((l) => (
                <div key={l.label} className="flex flex-col gap-0.5">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{l.label}</dt>
                  <dd className="font-mono text-[15px] text-foreground">{l.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
