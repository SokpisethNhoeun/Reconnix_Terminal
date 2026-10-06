/* "● 1 H  ● 1 M  ● 2 L" — how many findings of each severity, compact (full words on hover). */
import type { Finding } from "@/lib/data/schema";
import { severityCounts } from "@/lib/data/stats";

import { Dot } from "../neu/chips";

export function SeverityMix({ findings }: { findings: Finding[] }) {
  const counts = Object.entries(severityCounts(findings)).filter(([, n]) => n > 0) as [Finding["severity"], number][];
  if (!counts.length) return <span className="text-faint">none yet</span>;
  return (
    <span className="inline-flex gap-2 whitespace-nowrap font-mono text-xs text-muted" title={counts.map(([s, n]) => `${n} ${s.toLowerCase()}`).join(" · ")}>
      {counts.map(([severity, n]) => (
        <span key={severity} className="inline-flex items-center gap-1">
          <Dot severity={severity} />
          {n} {severity[0]}
        </span>
      ))}
    </span>
  );
}
