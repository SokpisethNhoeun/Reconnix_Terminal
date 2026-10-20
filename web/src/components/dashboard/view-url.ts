/* Which viewer view is open, and its filters, kept in the address bar (`?view=findings&sev=HIGH`)
   so a reload, a live refresh or a link lands on the same place. Switching uses
   history.replaceState, which Next.js syncs with useSearchParams without a server round trip.
   Safe for the browser only (it touches window). */
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

export const VIEWS = ["overview", "findings", "audit", "reports", "scope", "terminal", "assistant"] as const;
export type View = (typeof VIEWS)[number];

/** Each view's own filter parameters (cleared when a link opens that view with new ones). */
export const VIEW_FILTERS: Partial<Record<View, readonly string[]>> = {
  findings: ["sev", "val", "q", "finding"],
  audit: ["kind", "who", "aq"],
};

export type ViewParams = Record<string, string | undefined>;

export const parseView = (value: string | null | undefined): View =>
  (VIEWS as readonly string[]).includes(value ?? "") ? (value as View) : "overview";

function write(params: URLSearchParams): void {
  const query = params.toString();
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
}

/** Open `view`, keeping the chosen assessment. With `filters`, the view's old filters are
    replaced by these (a drill-down); without, they stay as they were (back to where you left). */
export function showView(view: View, filters?: ViewParams): void {
  const params = new URLSearchParams(window.location.search);
  if (view === "overview") params.delete("view");
  else params.set("view", view);
  if (filters) {
    for (const key of VIEW_FILTERS[view] ?? []) params.delete(key);
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  }
  write(params);
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

/** Links that open one saved run (`uid`), or every run (`null`), keeping the open view and its
    filters but not the selected finding (it belongs to the run left behind). */
export function useRunHref(): (uid: string | null) => string {
  const search = useSearchParams();
  return (uid) => {
    const next = new URLSearchParams(search.toString());
    if (uid) next.set("uid", uid);
    else next.delete("uid");
    next.delete("finding");
    const query = next.toString();
    return query ? `/?${query}` : "/";
  };
}

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
