/* Runs the TUI is playing now (running, or waiting for the operator): phase, progress per
   stage and what a waiting run needs. The overview shows it only while a run is live. */
import Link from "next/link";

import type { Assessment } from "@/lib/data/schema";
import { plural } from "@/lib/format";

import { HBars } from "../charts/hbars";
import { StatusChip } from "../neu/chips";

function LiveRun({ assessment: a }: { assessment: Assessment }) {
  const stages = Object.entries(a.run.progress).map(([stage, percent]) => ({
    key: stage,
    label: stage,
    value: Math.round(percent),
    tip: `${stage}: ${Math.round(percent)}%`,
  }));
  return (
    <li className="well flex min-w-0 flex-col gap-3 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Link href={`/assessments/${a.uid}`} className="font-mono text-[13.5px] font-semibold">
          {a.label}
        </Link>
        <StatusChip status={a.status} />
      </div>
      <span className="text-[12.5px] text-muted [overflow-wrap:anywhere]">
        {a.target || "target not given yet"} · {a.template.name || "template not chosen"} · {a.run.phase} ·{" "}
        {plural(a.run.requests, "request")}
      </span>
      {stages.length > 0 && <HBars rows={stages} max={100} unit="%" label={`${a.label} progress`} />}
      {a.status === "Awaiting input" && (
        <p className="m-0 text-[12.5px]">
          <b className="font-semibold">Waits for:</b> {a.waiting_for || "a decision"}. Decide it in the terminal app.
        </p>
      )}
    </li>
  );
}

export function LiveRuns({ assessments, limit }: { assessments: Assessment[]; limit: number }) {
  const more = assessments.length - limit;
  return (
    <>
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
        {assessments.slice(0, limit).map((a) => (
          <LiveRun key={a.uid} assessment={a} />
        ))}
      </ul>
      {more > 0 && <p className="m-0 text-[12.5px] text-muted">and {more} more</p>}
    </>
  );
}
