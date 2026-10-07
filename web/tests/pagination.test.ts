/* Paging the dashboard's lists: page numbers from the URL, and the slice each page shows. */
import { describe, expect, it } from "vitest";

import { PAGE_SIZE, pageNumber, pageParam, paginate } from "@/lib/pagination";

const items = Array.from({ length: 23 }, (_, i) => i + 1);

describe("pageNumber", () => {
  it.each([
    ["2", 2],
    ["1", 1],
    ["", 1],
    ["0", 1],
    ["-3", 1],
    ["2.5", 1],
    ["abc", 1],
    ["1e3", 1],
    ["9999999", 1],
  ])("reads %j as page %i", (value, page) => {
    expect(pageNumber(value)).toBe(page);
  });
});

describe("paginate", () => {
  it("shows 10 a page", () => {
    expect(PAGE_SIZE).toBe(10);
    const first = paginate(items, 1);
    expect(first).toMatchObject({ page: 1, pages: 3, total: 23, from: 1, to: 10 });
    expect(first.items).toEqual(items.slice(0, 10));
    expect(paginate(items, 3)).toMatchObject({ items: [21, 22, 23], from: 21, to: 23 });
  });

  it("shows the last page for a page past the end", () => {
    expect(paginate(items, 99)).toMatchObject({ page: 3, from: 21, to: 23 });
  });

  it("has one empty page for an empty list", () => {
    expect(paginate([], 4)).toMatchObject({ items: [], page: 1, pages: 1, total: 0, from: 0, to: 0 });
  });

  it("fills exactly whole pages", () => {
    expect(paginate(items.slice(0, 20), 2)).toMatchObject({ pages: 2, from: 11, to: 20 });
  });
});

describe("pageParam", () => {
  it("leaves page 1 out of the URL", () => {
    expect(pageParam(1)).toBeUndefined();
    expect(pageParam(2)).toBe("2");
  });
});
