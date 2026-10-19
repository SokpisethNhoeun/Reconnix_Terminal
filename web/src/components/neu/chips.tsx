/* State chips: a colored dot carries the state, the label stays in text color (so meaning
   never depends on color alone). */
import type { ReactNode } from "react";

import type { Severity, Status } from "@/lib/data/schema";
import type { DecisionState } from "@/lib/data/stats";
import { cn } from "@/lib/utils";

export type Tone = "ok" | "warn" | "bad" | "accent" | "faint";

export const STATUS_TONE: Record<Status, Tone> = {
  Completed: "ok",
  Stopped: "bad",
  "Awaiting input": "warn",
  Running: "accent",
  New: "faint",
  Interrupted: "faint",
};

export function Dot({ tone, severity, className }: { tone?: Tone; severity?: Severity; className?: string }) {
  return <i aria-hidden className={cn("dot", tone && `tone-${tone}`, severity && `sev-${severity}`, className)} />;
}

/** A small uppercase tag carrying a tone or severity color: soft-filled, or `solid` for the
    high-contrast chips in the attention feed. */
export function Badge({
  tone,
  severity,
  solid,
  children,
}: {
  tone?: Tone;
  severity?: Severity;
  solid?: boolean;
  children: ReactNode;
}) {
  return <span className={cn("badge", solid && "badge-solid", tone && `tone-${tone}`, severity && `sev-${severity}`)}>{children}</span>;
}

export function Chip({ tone, severity, children }: { tone?: Tone; severity?: Severity; children: ReactNode }) {
  return (
    <span className="chip">
      {(tone || severity) && <Dot tone={tone} severity={severity} />}
      {children}
    </span>
  );
}

export const StatusChip = ({ status }: { status: Status }) => <Chip tone={STATUS_TONE[status]}>{status}</Chip>;

export const SeverityChip = ({ severity }: { severity: Severity }) => <Chip severity={severity}>{severity}</Chip>;

export function ValidationChip({ validation }: { validation: string }) {
  if (validation === "CONFIRMED") return <Chip tone="ok">CONFIRMED</Chip>;
  return (
    <span className="inline-flex flex-col items-start">
      <Chip tone="warn">REVIEW</Chip>
      <span className="cell-sub">{validation.toLowerCase()}</span>
    </span>
  );
}

export const TRIAGE_TONE: Record<string, Tone> = {
  open: "faint",
  fixed: "ok",
  accepted: "warn",
  "false-positive": "bad",
};
const TRIAGE_LABEL: Record<string, string> = {
  open: "Open",
  fixed: "Fixed",
  accepted: "Accepted",
  "false-positive": "False+",
};

/** A finding's triage status (open / fixed / accepted / false-positive). */
export const TriageChip = ({ status }: { status: string }) => (
  <Chip tone={TRIAGE_TONE[status] ?? "faint"}>{TRIAGE_LABEL[status] ?? status}</Chip>
);

/** One line for where a finding stands: its triage (fixed / accepted / false positive) when
    it has left the open set, otherwise whether a person has confirmed it. */
export function FindingStatus({ status, validation }: { status: string; validation: string }) {
  if (status === "false-positive") return <Chip tone="faint">False positive</Chip>;
  if (status === "fixed") return <Chip tone="ok">Fixed</Chip>;
  if (status === "accepted") return <Chip tone="warn">Accepted</Chip>;
  if (validation === "CONFIRMED") return <Chip tone="ok">Confirmed</Chip>;
  return <Chip tone="warn">Need review</Chip>;
}

/** A CVSS base score, or an em dash when the finding is not scored. */
export function Cvss({ score }: { score: number }) {
  if (!score) return <span className="text-faint">—</span>;
  return <span className="font-mono tabular-nums">{score.toFixed(1)}</span>;
}

const DECISION_TONE: Record<DecisionState, Tone> = { APPROVED: "ok", REJECTED: "bad", PENDING: "warn" };

export const DecisionChip = ({ state }: { state: DecisionState }) => <Chip tone={DECISION_TONE[state]}>{state}</Chip>;

export const VerdictChip = ({ allowed }: { allowed: boolean }) =>
  allowed ? <Chip tone="ok">ALLOWED</Chip> : <Chip tone="bad">BLOCKED</Chip>;
