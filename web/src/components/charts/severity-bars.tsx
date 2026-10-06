/* Findings per severity (all five levels, zeros included), with a confirmed/review meter. */
import { type Finding, SEVERITIES } from "@/lib/data/schema";
import { isConfirmed, severityCounts } from "@/lib/data/stats";
import { plural } from "@/lib/format";

import { Dot } from "../neu/chips";
import { HBars } from "./hbars";

export function SeverityBars({ findings, meter = true }: { findings: Finding[]; meter?: boolean }) {
  const counts = severityCounts(findings);
  const confirmed = findings.filter(isConfirmed).length;
  const review = findings.length - confirmed;
  const rows = SEVERITIES.map((s) => {
    const sure = findings.filter((f) => f.severity === s && isConfirmed(f)).length;
    return { key: s, label: s, value: counts[s], severity: s, tip: `${s}: ${plural(counts[s], "finding")}, ${sure} confirmed` };
  });
  return (
    <>
      <HBars rows={rows} label="Findings by severity" />
      {meter && findings.length > 0 && (
        <>
          <div className="meter" role="img" aria-label={`${confirmed} confirmed, ${review} for review`}>
            {confirmed > 0 && <span className="fill-tone tone-ok" style={{ width: `${(confirmed / findings.length) * 100}%` }} />}
            {review > 0 && <span className="fill-tone tone-warn flex-1 opacity-55" />}
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
