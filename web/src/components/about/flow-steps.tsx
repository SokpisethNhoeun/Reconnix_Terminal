/* The eight screens of an assessment as numbered step cards. Steps where a person decides
   say so; the approval gate is amber, as on the landing site. */
import { cn } from "@/lib/utils";

import { FLOW_STEPS } from "./content";

export function FlowSteps() {
  return (
    <ol className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4" aria-label="Assessment steps">
      {FLOW_STEPS.map(({ key, name, icon: Icon, body, you, gate }, i) => (
        <li key={key} className={cn("step", gate && "tone-warn")} data-gate={gate ? "" : undefined}>
          <span className="flex items-center gap-2.5">
            <span className="step-num" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <Icon size={17} aria-hidden className="step-icon" />
            <b className="font-display text-[15px] font-semibold">{name}</b>
            {gate && <span className="ml-auto font-mono text-[10.5px] tracking-[0.14em] text-tone uppercase">gate</span>}
          </span>
          <span className="text-[13px] text-muted">{body}</span>
          {you && (
            <span className="mt-auto flex gap-2 border-t border-line pt-2.5 text-[12.5px]">
              <span className="font-mono text-[10.5px] leading-[1.9] tracking-[0.14em] text-warn uppercase">you</span>
              <span>{you}</span>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
