/* The Scope Manifest card in the transcript: what Reconix is allowed to do on this target,
   locked once the operator approves it. Read from the assessment's approved scope. */
import { Check, SquareCheck } from "lucide-react";

import type { Assessment } from "@/lib/data/schema";

function kindWord(kind: string): string {
  const k = kind.toLowerCase();
  if (k.includes("web")) return "a web application";
  if (k.includes("api")) return "an API";
  if (k.includes("network")) return "a network range";
  if (k.includes("code") || k.includes("source")) return "a source repository";
  return "the target";
}

export function ScopeManifest({ assessment: a }: { assessment: Assessment }) {
  const scope = a.scope;
  if (!scope) return null;
  const approved = scope.status === "APPROVED";
  const may = scope.allowed_actions.length ? scope.allowed_actions : ["Discover pages and endpoints", "Scan for known vulnerabilities"];

  return (
    <section className="card ring-accent gap-4">
      <header className="flex items-center justify-between gap-3">
        <span className="eyebrow flex items-center gap-2">
          <SquareCheck size={14} aria-hidden />
          Scope manifest
        </span>
        <span className="font-mono text-[11.5px] text-ok">{approved ? "approved · locked" : "draft · not approved"}</span>
      </header>

      <p className="text-[14px] font-semibold [overflow-wrap:anywhere]">
        Reconix will test {scope.target_url || a.target} as {kindWord(a.target_kind || a.template.name)}.
      </p>

      <div>
        <p className="mb-2 text-[12px] text-muted">What it may do</p>
        <ul className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-1.5 p-0 text-[13px] sm:grid-cols-2">
          {may.map((action) => (
            <li key={action} className="flex items-center gap-2">
              <Check size={14} aria-hidden className="flex-none text-ok" />
              {action}
            </li>
          ))}
        </ul>
      </div>

      <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
        <div>
          <dt className="text-[12px] text-muted">Never touch</dt>
          <dd className="m-0 font-mono text-[12.5px] text-bad">{scope.excluded_paths.join(" · ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Tools</dt>
          <dd className="m-0 text-[13px]">{scope.tools.join(", ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Test account</dt>
          <dd className="m-0 text-[13px]">{a.login.kind ? (a.login.provided ? "provided (hidden)" : "asked, not given") : "optional"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5">
        <span className="flex items-center gap-2.5 text-[13px]">
          <span className="grid size-5 flex-none place-items-center rounded-[6px] bg-accent text-accent-ink" aria-hidden>
            <Check size={13} />
          </span>
          I own this target or have written permission
        </span>
        <span className="text-[12px] text-muted">Agent can only act inside this scope</span>
      </div>
    </section>
  );
}
