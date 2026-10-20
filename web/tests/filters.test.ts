/* The Findings and Audit log filters (components/dashboard/filters.ts). */
import { describe, expect, it } from "vitest";

import { deriveDashboard } from "@/components/dashboard/derive";
import { countBy, findingMatches, list, reviewLabel, sortFindings, validationOf } from "@/components/dashboard/filters";
import { assessmentView } from "@/lib/data/adapt";

import { sampleAssessments } from "./fixtures";

const dashes = sampleAssessments().map((a) => deriveDashboard(assessmentView(a)));
const findings = dashes.flatMap((d) => d.findings);
const none = { sev: [], val: "", q: "" };

describe("findingMatches", () => {
  it("keeps everything with no filter", () => {
    expect(findings.every((f) => findingMatches(f, none))).toBe(true);
  });
  it("filters by severity, any of several", () => {
    const kept = findings.filter((f) => findingMatches(f, { ...none, sev: ["HIGH", "LOW"] }));
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.every((f) => f.severity === "HIGH" || f.severity === "LOW")).toBe(true);
  });
  it("filters by validation bucket, and ignores an unknown one", () => {
    expect(findings.filter((f) => findingMatches(f, { ...none, val: "confirmed" })).every((f) => f.confirmed)).toBe(true);
    expect(findings.filter((f) => findingMatches(f, { ...none, val: "review" })).every((f) => f.needsReview)).toBe(true);
    expect(findings.filter((f) => findingMatches(f, { ...none, val: "<script>" }))).toHaveLength(findings.length);
  });
  it("searches title, id, CWE and target, case-insensitively", () => {
    const f = findings[0];
    for (const q of [f.title.slice(0, 6).toUpperCase(), f.id, f.target.slice(0, 8)]) {
      expect(findings.filter((x) => findingMatches(x, { ...none, q })).map((x) => x.id)).toContain(f.id);
    }
    expect(findings.filter((x) => findingMatches(x, { ...none, q: "no-such-thing-zzz" }))).toHaveLength(0);
  });
  it("says why a closed finding is closed", () => {
    const open = findings.find((f) => f.needsReview)!;
    expect(reviewLabel(open)).toBe("Needs review");
    expect(reviewLabel({ ...open, needsReview: false, confirmed: false, status: "fixed" })).toBe("Fixed");
    expect(reviewLabel({ ...open, needsReview: false, confirmed: false, status: "accepted" })).toBe("Accepted");
    expect(reviewLabel({ ...open, needsReview: false, confirmed: false, falsePositive: true, status: "false-positive" })).toBe("False positive");
    expect(reviewLabel({ ...open, needsReview: false, confirmed: true })).toBe("Confirmed");
  });
  it("buckets every finding once", () => {
    expect(findings.every((f) => ["confirmed", "review", "closed"].includes(validationOf(f)))).toBe(true);
  });
});

describe("sortFindings", () => {
  it("puts the highest severity first, then the highest CVSS", () => {
    const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
    const sorted = sortFindings(findings);
    for (let i = 1; i < sorted.length; i++) {
      const [a, b] = [sorted[i - 1], sorted[i]];
      const d = order.indexOf(a.severity) - order.indexOf(b.severity);
      expect(d < 0 || (d === 0 && (a.score ?? 0) >= (b.score ?? 0))).toBe(true);
    }
  });
});

describe("helpers", () => {
  it("list() splits an address value and drops blanks", () => {
    expect(list("HIGH,,LOW, ")).toEqual(["HIGH", "LOW"]);
    expect(list("")).toEqual([]);
  });
  it("countBy() keeps the given order and adds unknown buckets after it", () => {
    expect(countBy(["b", "a", "b", "z"], (x) => x, ["a", "b", "c"])).toEqual([
      { value: "a", count: 1 },
      { value: "b", count: 2 },
      { value: "c", count: 0 },
      { value: "z", count: 1 },
    ]);
  });
});
