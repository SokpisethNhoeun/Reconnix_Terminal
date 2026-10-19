/* One summary card per assessment type — Web, API, Code, Network, always in that order: how
   many assessments ran on it, how many findings they turned up, and the worst severity among
   them. Each card filters the list below to that type. */
import { Code2, Globe, type LucideIcon, Network, Webhook } from "lucide-react";
import Link from "next/link";

import { type Assessment, SEVERITIES } from "@/lib/data/schema";
import { effectiveSeverity, isFalsePositive } from "@/lib/data/stats";
import { plural } from "@/lib/format";
import { TEMPLATE_TYPES } from "@/lib/templates";
import { query } from "@/lib/utils";

const ICON: Record<string, LucideIcon> = { Web: Globe, API: Webhook, Code: Code2, Network: Network };

export function TemplateCards({ assessments }: { assessments: Assessment[] }) {
  return (
    <section className="grid grid-cols-2 gap-[14px] xl:grid-cols-4" aria-label="Assessment types">
      {TEMPLATE_TYPES.map((type) => {
        const list = assessments.filter((a) => type.match.test(a.template.name));
        const real = list.flatMap((a) => a.findings).filter((f) => !isFalsePositive(f));
        const top = SEVERITIES.find((s) => real.some((f) => effectiveSeverity(f) === s)) ?? null;
        const Icon = ICON[type.label];
        return (
          <Link
            key={type.label}
            href={`/assessments${query({ template: type.label })}`}
            className="sev-card !flex-col !items-stretch !justify-start gap-3"
          >
            <span className="flex items-center gap-2.5 text-[14px] font-semibold">
              <Icon size={17} aria-hidden className="text-accent" />
              {type.label}
            </span>
            <span className="text-[13px] text-muted">
              <b className="font-display text-[20px] font-semibold text-text tabular-nums">{list.length}</b>{" "}
              {list.length === 1 ? "assessment" : "assessments"}
            </span>
            <span className="text-[12.5px] text-muted">
              {plural(real.length, "finding")}
              {top && (
                <>
                  {" · highest "}
                  <b className={`font-semibold text-tone sev-${top}`}>{top[0] + top.slice(1).toLowerCase()}</b>
                </>
              )}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
