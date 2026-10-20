/* What the Scope view draws (ScopeCards), for one run or for every saved run (derive-scope.ts):
   the summary strip, the boundary (one run's target, ports and exclusions, or every target
   tested), the approval requests, the permitted actions and tools, and the limits. Types only. */
import type { Meaning } from "@/lib/status";
import type { Status } from "@/lib/data/view-types";

import type { Chip, RunLink, Stat } from "./stat-types";

export interface ApprovalRow {
  key: string;
  action: string;
  target: string; // masked
  risk: Meaning;
  state: Meaning;
  run: RunLink | null; // the run it belongs to, when the list spans several
}

/** Every run that tested one target. */
export interface TargetRow {
  target: string; // masked
  runs: number;
  ports: string[];
  excluded: number; // distinct excluded paths across those runs
  scope: Meaning; // approved in every run, in some, or in none
  latest: RunLink & { status: Status };
}

export type Boundary =
  | { mode: "run"; target: string; state: Meaning; ports: string[]; exclude: string[] }
  | { mode: "all"; targets: TargetRow[]; summary: string };

export interface ScopeCards {
  mode: "run" | "all";
  tag: string; // beside the title: "RCX-DEMO-001 · 1.1.1.1", "All 27 runs"
  about: string;
  /** One run with no Scope Manifest yet: why (nothing else is drawn). */
  empty: string | null;
  stats: Stat[];
  boundary: Boundary;
  approvals: { rows: ApprovalRow[]; more: number; meta: string; empty: string };
  permitted: { actions: Chip[]; tools: Chip[] };
  limits: {
    rows: { label: string; chips: Chip[] }[];
    usage: { frac: number; over: boolean; caption: string } | null; // one run's time used
  };
}
