/* The safety model in short: the rules every run keeps (teal rails) and the risk policy
   (each level named next to its color). Amber backdrop, like the landing's guardrails. */
import { Dot } from "@/components/neu/chips";

import { GUARDS, RISK_RULES } from "./content";

export function SafetyGates() {
  return (
    <div className="card hazard grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <ul className="m-0 grid list-none gap-x-8 gap-y-6 p-0 sm:grid-cols-2">
        {GUARDS.map((g) => (
          <li key={g.title} className="rail">
            <h3 className="text-[14.5px] font-semibold">{g.title}</h3>
            <p className="text-[13px] text-muted">{g.body}</p>
          </li>
        ))}
      </ul>
      <section className="well flex flex-col gap-4 self-start p-5" aria-labelledby="risk-title">
        <h3 id="risk-title" className="eyebrow text-muted">
          Risk policy
        </h3>
        <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
          {RISK_RULES.map((r) => (
            <li key={r.level} className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3">
              <span className="chip justify-self-start">
                <Dot tone={r.tone} />
                {r.level}
              </span>
              <span className="text-[13px] text-muted">{r.rule}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
