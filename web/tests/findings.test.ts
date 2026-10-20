/* The Findings view's page and selection rules (components/dashboard/filters.ts): which page is
   shown, which row is selected, and what paging, a filter change and Previous / Next change in
   the address. Pure, over the derived sample findings. */
import { describe, expect, it } from "vitest";

import { deriveDashboard, findingRow } from "@/components/dashboard/derive";
import { filterActive, filterPatch, neighbours, pagePatch, pageParam, parseFindingFilter, resolveFindingsPage, sortFindings } from "@/components/dashboard/filters";
import { assessmentView } from "@/lib/data/adapt";
import { PER_PAGE } from "@/lib/paging";

import { sampleAssessments } from "./fixtures";

const dashes = sampleAssessments().map((a) => deriveDashboard(assessmentView(a)));
const one = dashes[0].findings;
/** Thirty findings keyed by run, as the every-run list is (three pages). */
const many = sortFindings(
  Array.from({ length: 30 }, (_, i) => {
    const f = one[i % one.length];
    return findingRow({ ...f, id: `F-${String(i + 1).padStart(3, "0")}` }, { uid: `run-${Math.floor(i / 10)}`, label: `RUN ${Math.floor(i / 10)}` });
  }),
);
const key = (i: number) => many[i].key;

describe("resolveFindingsPage", () => {
  it("shows the first page and selects its first row when the address names nothing", () => {
    const page = resolveFindingsPage(many, many, "", "");
    expect(page.paging).toMatchObject({ page: 1, pages: 3, total: 30 });
    expect(page.rows).toHaveLength(PER_PAGE);
    expect(page.current).toBe(many[0]);
    expect(page).toMatchObject({ index: 0, explicit: false, missing: "" });
  });

  it("selects the first row of the page the address names", () => {
    const page = resolveFindingsPage(many, many, "", "3");
    expect(page.paging.page).toBe(3);
    expect(page.rows).toEqual(many.slice(20, 30));
    expect(page.current).toBe(many[20]);
    expect(page.index).toBe(20);
  });

  it("opens the page that holds a named finding, whatever page the address says", () => {
    const page = resolveFindingsPage(many, many, key(15), "1");
    expect(page.paging.page).toBe(2);
    expect(page.current).toBe(many[15]);
    expect(page).toMatchObject({ index: 15, explicit: true, missing: "" });
    expect(page.rows.map((f) => f.key)).toContain(key(15));
  });

  it("falls back to the page's first row and says why when the named finding is not in the list", () => {
    const filtered = many.filter((f) => f.key !== key(2));
    const hidden = resolveFindingsPage(filtered, many, key(2), "");
    expect(hidden.current).toBe(filtered[0]);
    expect(hidden).toMatchObject({ explicit: false, missing: "filtered" });
    const unknown = resolveFindingsPage(many, many, "<script>no-such", "2");
    expect(unknown.current).toBe(many[10]);
    expect(unknown).toMatchObject({ explicit: false, missing: "unknown", index: 10 });
  });

  it("has nothing selected only when the list is empty", () => {
    const page = resolveFindingsPage([], many, key(0), "4");
    expect(page.current).toBeNull();
    expect(page).toMatchObject({ index: -1, missing: "filtered" });
    expect(page.paging).toMatchObject({ page: 1, pages: 1, total: 0 });
  });
});

describe("pagePatch", () => {
  it("keeps the selection when its row is on the new page, else lets the page's first row take over", () => {
    expect(pagePatch(many, 2, key(12))).toEqual({ page: "2", finding: key(12) });
    expect(pagePatch(many, 2, key(3))).toEqual({ page: "2", finding: "" });
    expect(pagePatch(many, 1, key(3))).toEqual({ page: "", finding: key(3) }); // the first page is the plain address
  });
  it("clamps a page out of range", () => {
    expect(pagePatch(many, 9, "")).toEqual({ page: "3", finding: "" });
    expect(pagePatch(many, 0, "")).toEqual({ page: "", finding: "" });
  });
  it("writes the first page as no page at all", () => {
    expect(pageParam(1)).toBe("");
    expect(pageParam(2)).toBe("2");
  });
});

describe("filterPatch", () => {
  const none = parseFindingFilter({ sev: "", val: "", q: "" });
  it("goes back to the first page and keeps a selection only while it still matches", () => {
    const f = many[0];
    const same = parseFindingFilter({ sev: f.severity, val: "", q: "" });
    expect(filterPatch(many, same, f.key)).toEqual({ page: "", finding: f.key });
    const other = parseFindingFilter({ sev: "", val: "", q: "no-such-thing-zzz" });
    expect(filterPatch(many, other, f.key)).toEqual({ page: "", finding: "" });
    expect(filterPatch(many, none, "")).toEqual({ page: "", finding: "" });
    expect(filterPatch(many, none, "unknown-key")).toEqual({ page: "", finding: "" });
  });
});

describe("parseFindingFilter", () => {
  it("drops unknown severities and validation buckets from the address", () => {
    expect(parseFindingFilter({ sev: "HIGH,<script>,LOW", val: "review", q: " x " })).toEqual({ sev: ["HIGH", "LOW"], val: "review", q: " x " });
    expect(parseFindingFilter({ sev: "", val: "nope", q: "" })).toEqual({ sev: [], val: "", q: "" });
  });
  it("knows when a filter is on", () => {
    expect(filterActive(parseFindingFilter({ sev: "", val: "", q: "  " }))).toBe(false);
    expect(filterActive(parseFindingFilter({ sev: "HIGH", val: "", q: "" }))).toBe(true);
    expect(filterActive(parseFindingFilter({ sev: "", val: "closed", q: "" }))).toBe(true);
    expect(filterActive(parseFindingFilter({ sev: "", val: "", q: "sql" }))).toBe(true);
  });
});

describe("neighbours", () => {
  it("walks the filtered order across page ends", () => {
    expect(neighbours(many, 0)).toEqual({ prev: null, next: many[1] });
    expect(neighbours(many, 9)).toEqual({ prev: many[8], next: many[10] }); // page 1 → page 2
    expect(neighbours(many, 29)).toEqual({ prev: many[28], next: null });
    expect(neighbours(many, -1)).toEqual({ prev: null, next: null });
  });
});
