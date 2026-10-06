/* Display formats. Used on the server only, so times read in the local time zone of the
   machine that runs both the TUI and this dashboard. */

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dayMonthTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const numbers = new Intl.NumberFormat("en-US");

const valid = (iso: string | null | undefined): iso is string => !!iso && Number.isFinite(Date.parse(iso));

/** "5 Oct 2026, 14:03" */
export const formatDateTime = (iso: string | null | undefined) => (valid(iso) ? dateTime.format(new Date(iso)) : "—");

/** "5 Oct, 14:03" */
export const formatShort = (iso: string | null | undefined) => (valid(iso) ? dayMonthTime.format(new Date(iso)) : "—");

/** "5 Oct 2026" */
export const formatDay = (iso: string | null | undefined) => (valid(iso) ? dayMonth.format(new Date(iso)) : "—");

/** "14:03:11" */
export const formatClock = (iso: string | Date | null | undefined) =>
  iso instanceof Date ? clock.format(iso) : valid(iso) ? clock.format(new Date(iso)) : "—";

export const formatNumber = (n: number) => numbers.format(n);

/** "12m 31s", "1h 04m", "45s" */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;

/** A byte count for humans: "812 B", "24.1 KB", "1.3 MB". */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
