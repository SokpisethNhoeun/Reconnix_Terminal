/* Findings per severity (all five levels, zeros included, at the analyst's severity), with a
   confirmed / for review meter ("for review": open and not confirmed). */
import { type Finding, SEVERITIES } from "@/lib/data/schema";
import { effectiveSeverity, isConfirmed, needsReview, severityCounts } from "@/lib/data/stats";
import { plural } from "@/lib/format";

import { Dot } from "../neu/chips";
import { HBars } from "./hbars";

export function SeverityBars({ findings, meter = true }: { findings: Finding[]; meter?: boolean }) {
  const counts = severityCounts(findings);
  const confirmed = findings.filter(isConfirmed).length;
  const review = findings.filter(needsReview).length;
  const rows = SEVERITIES.map((s) => {
    const sure = findings.filter((f) => effectiveSeverity(f) === s && isConfirmed(f)).length;
    return { key: s, label: s, value: counts[s], severity: s, tip: `${s}: ${plural(counts[s], "finding")}, ${sure} confirmed` };
  });
  return (
    <>
      <HBars rows={rows} label="Findings by severity" />
      {meter && findings.length > 0 && (
        <>
          <div className="meter" role="img" aria-label={`${confirmed} confirmed, ${review} for review`}>
            {confirmed > 0 && <span className="fill-tone tone-ok" style={{ width: `${(confirmed / findings.length) * 100}%` }} />}
            {review > 0 && <span className="fill-tone tone-warn opacity-55" style={{ width: `${(review / findings.length) * 100}%` }} />}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Dot tone="ok" />
              Confirmed {confirmed}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot tone="warn" />
              For review {review}
            </span>
          </div>
        </>
      )}
    </>
  );
}
