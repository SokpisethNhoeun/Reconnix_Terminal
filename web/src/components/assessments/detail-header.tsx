/* The head of one assessment: id, status, the Export menu, facts, the waiting/stopped notice
   and the tabs. */
import { ArrowLeft, CircleSlash, SquareTerminal, TriangleAlert } from "lucide-react";
import Link from "next/link";

import type { Assessment } from "@/lib/data/schema";
import { durationMs } from "@/lib/data/stats";
import { formatDateTime, formatDuration } from "@/lib/format";

import { StatusChip } from "../neu/chips";
import { Notice } from "../neu/notice";
import { type Segment, SegmentedLinks } from "../neu/segmented";
import { ExportMenu } from "./export-menu";

const LOGIN: Record<string, string> = {
  "": "none needed",
  cookie: "session cookie (not saved)",
  password: "email + password (not saved)",
  otp: "one-time code (never stored)",
  "password+otp": "password + one-time code (not saved)",
};

export function DetailHeader({ assessment: a, tabs }: { assessment: Assessment; tabs: Segment[] }) {
  const facts: [string, string, boolean?][] = [
    ["Target", a.target || "—", true],
    ["Template", a.template.name || "not chosen"],
    ["Started", formatDateTime(a.created_at)],
    ["Duration", formatDuration(durationMs(a))],
    ["Operator", a.operator],
    ["Target login", a.login.kind ? (a.login.provided ? LOGIN[a.login.kind] ?? a.login.kind : "asked, not given yet") : LOGIN[""]],
  ];
  if (a.client) facts.push(["Client", a.client]);
  if (a.mode) facts.push(["Engagement", a.mode]);
  if (a.methodology.length) facts.push(["Standards", a.methodology.join(" · ")]);
  if (a.run.report_path) facts.push(["Report", a.run.report_path, true]);

  return (
    <section className="card">
      <Link href="/assessments" className="link w-fit">
        <ArrowLeft size={16} aria-hidden />
        All assessments
      </Link>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3.5">
        <h2 className="font-mono text-[22px] font-semibold tracking-wide">{a.label}</h2>
        <StatusChip status={a.status} />
        <div className="ml-auto">
          <ExportMenu uid={a.uid} />
        </div>
        <dl className="m-0 flex basis-full flex-wrap gap-x-[18px] gap-y-1.5 text-[13px] text-muted">
          {facts.map(([label, value, mono]) => (
            <div key={label} className="flex gap-1.5">
              <dt>{label}</dt>
              <dd className={mono ? "m-0 font-mono font-medium text-text" : "m-0 font-medium text-text"}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {a.status === "Awaiting input" && (
        <Notice icon={<SquareTerminal size={18} />} tone="warn">
          <b className="font-semibold">Waiting in the terminal app:</b> {a.waiting_for || "a decision"}. Decide it there; this
          page updates by itself.
        </Notice>
      )}
      {a.status === "Stopped" && (
        <Notice icon={<TriangleAlert size={18} />} tone="bad">
          <b className="font-semibold">Stopped:</b> {a.stopped_reason || "the run ended early"}. Nothing ran after that.
        </Notice>
      )}
      {a.status === "Interrupted" && (
        <Notice icon={<CircleSlash size={18} />} tone="faint">
          <b className="font-semibold">Interrupted:</b> the terminal app closed before this run finished. It cannot continue;
          start a new assessment in the TUI.
        </Notice>
      )}
      <div className="self-start">
        <SegmentedLinks label="Assessment sections" items={tabs} />
      </div>
    </section>
  );
}
