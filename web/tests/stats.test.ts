/* The counts every page shows, checked against the sample data by independent arithmetic. */
import { describe, expect, it } from "vitest";

import {
  ATTENTION,
  allFindings,
  approvalRows,
  attentionItems,
  byTemplate,
  categoryCounts,
  cvssSummary,
  durationMs,
  filterAssessments,
  labelTimeline,
  overview,
  perDay,
  severityCounts,
  topReferences,
  waitingApproval,
} from "@/lib/data/stats";
import { readFileSync } from "node:fs";
import path from "node:path";

import { AssessmentSchema, type TimelineEntry } from "@/lib/data/schema";

import { SAMPLE_DIR, sampleAssessments } from "./fixtures";

const list = sampleAssessments();
const findings = list.flatMap((a) => a.findings);

describe("overview", () => {
  const stats = overview(list);

  it("counts assessments, findings and policy checks", () => {
    expect(stats.assessments).toBe(list.length);
    expect(stats.findings).toBe(findings.length);
    expect(stats.confirmed + stats.review).toBe(findings.length);
    expect(stats.confirmed).toBe(findings.filter((f) => f.validation === "CONFIRMED").length);
    expect(stats.checks).toBe(list.reduce((n, a) => n + a.verdicts.length, 0));
    expect(stats.blocked).toBe(list.flatMap((a) => a.verdicts).filter((v) => !v.allowed).length);
    expect(stats.requests).toBe(list.reduce((n, a) => n + a.run.requests, 0));
  });

  it("counts approvals: decided ones plus the one a run waits on", () => {
    const decisions = list.flatMap((a) => a.decisions);
    expect(stats.granted).toBe(decisions.filter((d) => d.decision === "APPROVED").length);
    expect(stats.rejected).toBe(decisions.filter((d) => d.decision === "REJECTED").length);
    expect(stats.pending).toBe(list.filter((a) => a.status === "Awaiting input" && a.waiting_for.includes("approval")).length);
  });

  it("counts statuses", () => {
    expect(Object.values(stats.byStatus).reduce((a, b) => a + b, 0)).toBe(list.length);
  });
});

describe("approvals", () => {
  it("finds the approval a waiting run is stopped at", () => {
    const waiting = list.find((a) => a.status === "Awaiting input")!;
    const approval = waitingApproval(waiting)!;
    expect(waiting.waiting_for).toBe(`${approval.risk} approval for ${approval.action}`);
    expect(approvalRows([waiting]).find((r) => r.state === "PENDING")?.approval.request_id).toBe(approval.request_id);
  });

  it("leaves out requests the run never reached", () => {
    const stopped = list.find((a) => a.status === "Stopped")!;
    const rows = approvalRows([stopped]);
    expect(rows.every((r) => r.decision !== null)).toBe(true);
  });
});

describe("findings", () => {
  it("lists every finding once, most severe first, with a unique key", () => {
    const rows = allFindings(list);
    expect(rows).toHaveLength(findings.length);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
    expect(rows.map((r) => order.indexOf(r.severity))).toEqual([...rows.map((r) => order.indexOf(r.severity))].sort((a, b) => a - b));
  });

  it("counts severities and references", () => {
    const counts = severityCounts(findings);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(findings.length);
    const top = topReferences(findings, 3);
    expect(top).toHaveLength(3);
    expect(top[0].count).toBeGreaterThanOrEqual(top[1].count);
    expect(top[0].count).toBe(findings.filter((f) => f.references.includes(top[0].ref)).length);
  });

  it("groups by template", () => {
    const groups = byTemplate(list);
    expect(groups.reduce((n, g) => n + g.findings, 0)).toBe(findings.length);
    expect(groups.reduce((n, g) => n + g.assessments, 0)).toBe(list.length);
  });
});

describe("time", () => {
  it("buckets findings per local day", () => {
    const days = perDay(list, 8, new Date(2026, 9, 5, 18));
    expect(days).toHaveLength(8);
    expect(days.reduce((n, d) => n + d.assessments, 0)).toBeLessThanOrEqual(list.length);
    expect(days.at(-1)!.day).toBe("2026-10-05");
  });

  it("measures testing time from scope approval", () => {
    const done = list.find((a) => a.status === "Completed")!;
    expect(durationMs(done)).toBe(Date.parse(done.run.finished_at!) - Date.parse(done.run.started_at!));
  });

  it("filters by text, template, status and age", () => {
    const now = Date.parse("2026-10-05T23:00:00Z");
    expect(filterAssessments(list, { q: "", template: "all", status: "all", range: "all" }, now)).toHaveLength(list.length);
    expect(filterAssessments(list, { q: "staging", template: "", status: "", range: "all" }, now).every((a) => a.target.includes("staging"))).toBe(true);
    expect(filterAssessments(list, { q: "", template: "API", status: "", range: "all" }, now).every((a) => a.template.name === "API")).toBe(true);
    expect(filterAssessments(list, { q: "", template: "", status: "Stopped", range: "all" }, now)).toHaveLength(1);
    const week = filterAssessments(list, { q: "", template: "", status: "", range: "7" }, now);
    expect(week.every((a) => now - Date.parse(a.created_at) <= 7 * 86_400_000)).toBe(true);
  });

  it("filters to the runs that need attention", () => {
    const shown = filterAssessments(list, { q: "", template: "", status: ATTENTION, range: "all" });
    expect(shown.map((a) => a.status).sort()).toEqual(["Awaiting input", "Stopped"]);
  });
});

describe("attentionItems", () => {
  const run = (base: (typeof list)[number], uid: string, status: (typeof list)[number]["status"]) => ({ ...base, uid, status });
  const base = list[0];

  it("puts one of each kind first, then the rest", () => {
    const many = [
      run(base, "w1", "Awaiting input"),
      run(base, "w2", "Awaiting input"),
      run(base, "w3", "Awaiting input"),
      run(base, "s1", "Stopped"),
      run(base, "i1", "Interrupted"),
      run(base, "c1", "Completed"),
    ];
    const { items, runs } = attentionItems(many);
    const review = many.flatMap((a) => a.findings).filter((f) => f.validation !== "CONFIRMED").length;
    expect(runs).toBe(5);
    const order = items.map((i) => (i.kind === "review" ? "review" : i.assessment.uid));
    expect(order).toEqual(review ? ["w1", "review", "s1", "i1", "w2", "w3"] : ["w1", "s1", "i1", "w2", "w3"]);
  });

  it("counts the findings still for review", () => {
    const item = attentionItems(list).items.find((i) => i.kind === "review");
    const review = findings.filter((f) => f.validation !== "CONFIRMED");
    if (!review.length) expect(item).toBeUndefined();
    else expect(item).toMatchObject({ kind: "review", count: review.length });
  });

  it("is empty when nothing needs attention", () => {
    const calm = list.map((a) => ({ ...a, status: "Completed" as const, findings: a.findings.filter((f) => f.validation === "CONFIRMED") }));
    expect(attentionItems(calm)).toEqual({ items: [], runs: 0 });
  });
});

describe("interrupted runs", () => {
  it("reads a run the TUI quit during as interrupted, not waiting", () => {
    const waiting = list.find((a) => a.status === "Awaiting input")!;
    const raw = JSON.parse(readFileSync(path.join(SAMPLE_DIR, `${waiting.uid}.json`), "utf8"));
    const closed = AssessmentSchema.parse({ ...raw, session_closed: true });
    expect(closed.status).toBe("Interrupted");
    expect(closed.waiting_request_id).toBe("");
    expect(waitingApproval(closed)).toBeNull();
    expect(approvalRows([closed]).some((r) => r.state === "PENDING")).toBe(false);
  });

  it("keeps finished runs as they were", () => {
    const done = list.find((a) => a.status === "Completed")!;
    const raw = JSON.parse(readFileSync(path.join(SAMPLE_DIR, `${done.uid}.json`), "utf8"));
    expect(AssessmentSchema.parse({ ...raw, session_closed: true }).status).toBe("Completed");
  });
});

describe("timeline labels", () => {
  const entry = (type: "chat" | "activity", who: string, seq: number): TimelineEntry => ({
    seq, at: null, type, who, kind: "text", text: "", tone: "default", rows: [],
  });

  it("puts chat speakers and activity sources on one scale", () => {
    const labels = labelTimeline([
      entry("chat", "you", 1),
      entry("chat", "reconix", 2),
      entry("chat", "", 3), // continues the line above
      entry("activity", "USER", 4),
      entry("activity", "TOOL", 5),
      entry("chat", "policy", 6),
    ]).map((r) => r.who);
    expect(labels).toEqual(["YOU", "AI", "AI", "YOU", "TOOL", "POLICY"]);
  });
});

describe("weakness categories and CVSS", () => {
  it("categoryCounts partitions every finding, most common first", () => {
    const cats = categoryCounts(findings);
    expect(cats.reduce((n, c) => n + c.count, 0)).toBe(findings.length);
    for (let i = 1; i < cats.length; i += 1) expect(cats[i - 1].count).toBeGreaterThanOrEqual(cats[i].count);
  });

  it("cvssSummary counts only findings that carry a score", () => {
    const scored = findings.filter((f) => f.cvss_score > 0);
    const summary = cvssSummary(findings);
    expect(summary.scored).toBe(scored.length);
    if (scored.length) {
      expect(summary.max).toBe(Math.max(...scored.map((f) => f.cvss_score)));
    } else {
      expect(summary).toEqual({ max: 0, avg: 0, scored: 0 });
    }
  });
});
