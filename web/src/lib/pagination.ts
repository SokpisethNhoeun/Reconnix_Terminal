/* Paging for the dashboard's lists: the page number comes from the URL, so every page of a
   list has a link and works without JavaScript. */

export const PAGE_SIZE = 10;

export interface Page<T> {
  items: T[];
  page: number; // 1-based, within 1…pages
  pages: number; // at least 1
  total: number;
  from: number; // 1-based position of the first item shown (0 when empty)
  to: number;
}

/** A page number from a search param: a whole number from 1, anything else is page 1. */
export function pageNumber(value: string): number {
  if (!/^\d{1,6}$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

/** One page of `items`. A page past the end shows the last page. */
export function paginate<T>(items: T[], page: number, size: number = PAGE_SIZE): Page<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const start = (current - 1) * size;
  const shown = items.slice(start, start + size);
  return { items: shown, page: current, pages, total, from: shown.length ? start + 1 : 0, to: start + shown.length };
}

/** The value to put in the URL for `page` (page 1 is the default, so it is left out). */
export const pageParam = (page: number): string | undefined => (page > 1 ? String(page) : undefined);
