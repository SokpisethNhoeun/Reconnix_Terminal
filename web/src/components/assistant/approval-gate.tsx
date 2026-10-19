/* The approval gate in the transcript: a risky action the agent wants to run, waiting for
   the operator. A visual mock of the real terminal gate; the buttons do not act here. */
import { Diamond } from "lucide-react";

import type { Approval } from "@/lib/data/schema";
import { cn } from "@/lib/utils";

import { Badge } from "../neu/chips";

const RISK_TONE: Record<string, "bad" | "warn" | "ok"> = { HIGH: "bad", MEDIUM: "warn", LOW: "ok" };

export function ApprovalGate({ approval: p }: { approval: Approval }) {
  const facts: [string, string, boolean?][] = [
    ["Action", p.action],
    ["Target", `${p.method} ${p.path}`, true],
    ["Purpose", p.purpose],
    ["Impact", p.impact],
  ];
  return (
    <section className="card hazard gap-4">
      <header className="flex items-center justify-between gap-3">
        <span className="eyebrow flex items-center gap-2 text-warn">
          <Diamond size={13} aria-hidden />
          Human approval required
        </span>
        <Badge tone={RISK_TONE[p.risk] ?? "warn"} solid>
          {p.risk} risk
        </Badge>
      </header>

      <dl className="m-0 grid grid-cols-1 gap-x-5 gap-y-2.5 text-[13px] sm:grid-cols-[88px_minmax(0,1fr)]">
        {facts.map(([label, value, mono]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className={cn("m-0 [overflow-wrap:anywhere]", mono ? "font-mono text-[12.5px] text-ok" : "font-medium")}>{value}</dd>
          </div>
        ))}
      </dl>

      {p.command && <pre className="evidence">$ {p.command}</pre>}

      <p className="text-[13.5px] font-semibold">Run {p.action.toLowerCase()} on {p.target}?</p>

      <div className="flex flex-wrap gap-2.5">
        <button type="button" className="btn !bg-accent !text-accent-ink font-semibold">
          Approve &amp; run
        </button>
        <button type="button" className="btn !text-bad">
          Reject
        </button>
        <button type="button" className="btn">
          View details
        </button>
        <button type="button" className="btn">
          Edit params
        </button>
        <button type="button" className="btn">
          Chat about this
        </button>
      </div>
    </section>
  );
}
