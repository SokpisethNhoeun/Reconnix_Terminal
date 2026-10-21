/* Every target the saved runs tested: the ports their scopes allowed and the paths they excluded,
   how many runs, whether the scopes were approved, and the newest run (it opens that run's
   Scope). */
import { DashCard } from "@/components/dashboard/dash-card";
import { RunLinkTo } from "@/components/dashboard/run-link";
import type { Boundary, TargetRow } from "@/components/dashboard/scope-types";
import { StatusBadge } from "@/components/ui/status-badge";
import { RUN_STATUS } from "@/lib/status";
import { DOCS } from "@/lib/docs-nav";

const MAX_PORTS = 4;

function reach(t: TargetRow): string {
  const ports = t.ports.length
    ? `ports ${t.ports.slice(0, MAX_PORTS).join(", ")}${t.ports.length > MAX_PORTS ? ` +${t.ports.length - MAX_PORTS}` : ""}`
    : "default ports";
  return t.excluded ? `${ports} · ${t.excluded} excluded` : ports;
}

export function ScopeTargets({ data }: { data: Extract<Boundary, { mode: "all" }> }) {
  return (
    <DashCard id="scope-targets" title="Targets" docsHref={DOCS.scope} meta={data.summary} className="dash-panel">
      <div className="dash-table-scroll">
        <table aria-label="Targets tested" className="dash-table">
          <thead>
            <tr>
              <th scope="col">Target</th>
              <th scope="col" className="text-right">Runs</th>
              <th scope="col">Scope</th>
              <th scope="col">Newest run</th>
            </tr>
          </thead>
          <tbody>
            {data.targets.map((t) => (
              <tr key={t.target}>
                <th scope="row" className="min-w-[170px] font-normal">
                  <span className="block font-mono text-foreground [overflow-wrap:anywhere]">{t.target}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground" title={t.ports.join(", ") || undefined}>
                    {reach(t)}
                  </span>
                </th>
                <td className="text-right tabnums text-foreground">{t.runs}</td>
                <td>
                  <StatusBadge meaning={t.scope} />
                </td>
                <td>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <RunLinkTo uid={t.latest.uid} label={`Open the scope of ${t.latest.label}`} className="whitespace-nowrap font-mono text-primary underline-offset-2 hover:underline">
                      {t.latest.label}
                    </RunLinkTo>
                    <StatusBadge meaning={RUN_STATUS[t.latest.status]} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashCard>
  );
}
