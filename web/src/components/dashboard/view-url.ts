/* Which viewer view is open, and its filters, kept in the address bar (`?view=findings&sev=HIGH`)
   so a reload, a live refresh or a link lands on the same place. Switching uses
   history.replaceState, which Next.js syncs with useSearchParams without a server round trip.
   Safe for the browser only (it touches window). */
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

// (no "audit": the Audit log view was removed; old ?view=audit links open the Overview)
export const VIEWS = ["overview", "assessments", "findings", "reports", "scope", "terminal", "assistant"] as const;
export type View = (typeof VIEWS)[number];

/** The Assessments view's own address parameters (its filters, its page). */
export const ASSESSMENT_KEYS = ["q", "status", "template", "page"] as const;
/** The Findings view's own address parameters (its filters, the selected finding, its page). */
export const FINDINGS_KEYS = ["sev", "val", "q", "finding", "page"] as const;

/** Each view's own filter parameters (cleared when a link opens that view with new ones). The
    one list per view: the views read their parameters from these same constants. */
export const VIEW_FILTERS: Partial<Record<View, readonly string[]>> = {
  assessments: ASSESSMENT_KEYS,
  findings: FINDINGS_KEYS,
};

export type ViewParams = Record<string, string | undefined>;

export const parseView = (value: string | null | undefined): View =>
  (VIEWS as readonly string[]).includes(value ?? "") ? (value as View) : "overview";

function write(params: URLSearchParams): void {
  const query = params.toString();
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
}

/** The address after opening `view` from the one `search` holds (pure; showView's rule). The
    chosen assessment stays. Changing view drops the view left behind's own filters (and the
    selected finding), so a `page` or `q` never leaks into another view that uses the same key.
    With `filters`, the opened view's old filters are replaced by these (a drill-down); without,
    they stay as they were (back to where you left). */
export function viewSearch(search: string, view: View, filters?: ViewParams): string {
  const params = new URLSearchParams(search);
  const from = parseView(params.get("view"));
  if (from !== view) {
    for (const key of VIEW_FILTERS[from] ?? []) params.delete(key);
    params.delete("finding");
  }
  if (view === "overview") params.delete("view");
  else params.set("view", view);
  if (filters) {
    for (const key of VIEW_FILTERS[view] ?? []) params.delete(key);
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  }
  return params.toString();
}

/** Open `view` (viewSearch) in place. */
export function showView(view: View, filters?: ViewParams): void {
  write(new URLSearchParams(viewSearch(window.location.search, view, filters)));
}

/** The current value of some query parameters, and a setter that changes only those. */
export function useQueryParams<K extends string>(keys: readonly K[]): [Record<K, string>, (patch: Partial<Record<K, string>>) => void] {
  const search = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, search.get(k) ?? ""])) as Record<K, string>;
  const update = useCallback((patch: Partial<Record<K, string>>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch) as [string, string | undefined][]) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    write(params);
  }, []);
  return [values, update];
}

/** The link that opens one saved run (`uid`), or every run (`null`), from the address `search`
    (pure): the open view and its filters stay, but not the selected finding or the page (they
    belong to the run left behind: another run has other findings and fewer or more pages). */
export function runHref(search: string, uid: string | null): string {
  const next = new URLSearchParams(search);
  if (uid) next.set("uid", uid);
  else next.delete("uid");
  next.delete("finding");
  next.delete("page");
  const query = next.toString();
  return query ? `/?${query}` : "/";
}

/** runHref from the current address. */
export function useRunHref(): (uid: string | null) => string {
  const search = useSearchParams();
  return (uid) => runHref(search.toString(), uid);
}

/** The Overview of one saved run, from anywhere (no filters carried). */
export const runOverviewHref = (uid: string): string => `/?uid=${encodeURIComponent(uid)}`;

/** One finding opened in its own run's Findings view. */
export const runFindingHref = (uid: string, findingId: string): string =>
  `/?uid=${encodeURIComponent(uid)}&view=findings&finding=${encodeURIComponent(findingId)}`;

// --- the AI Assistant's history entry ----------------------------------------------------
// Opening the assistant pushes one entry (Back returns to where you were); opening it while it
// is open adds nothing. Leaving through its own controls goes back that entry instead of adding
// another, then opens the wanted view in place.

let assistantPushed = false; // this page pushed the entry the assistant sits on
let ownEntryLength = -1; // history.length right after that push (Forward lands on it again)
let afterBack: View | null = null; // the view to open once that Back has landed

const viewNow = (): View => parseView(new URLSearchParams(window.location.search).get("view"));

export function openAssistant(): void {
  if (viewNow() === "assistant") return;
  const params = new URLSearchParams(window.location.search);
  params.set("view", "assistant");
  window.history.pushState(null, "", `?${params.toString()}`);
  assistantPushed = true;
  ownEntryLength = window.history.length;
}

/** Leave the assistant for `target`, or (no target) for wherever it was opened from. */
export function leaveAssistant(target?: View): void {
  if (viewNow() !== "assistant") return showView(target ?? "overview");
  if (assistantPushed) {
    assistantPushed = false;
    afterBack = target ?? null;
    window.history.back();
    return;
  }
  showView(target ?? "overview"); // opened directly (a link or a reload): nothing to go back to
}

/** Keeps the bookkeeping right when the browser moves through history (Back, Forward). */
export function watchHistory(): () => void {
  const onPop = () => {
    const now = viewNow();
    // Forward onto the entry this page pushed: leaving it may go Back again
    assistantPushed = now === "assistant" && window.history.length === ownEntryLength;
    const target = afterBack;
    afterBack = null;
    if (target && target !== now) showView(target);
  };
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}
