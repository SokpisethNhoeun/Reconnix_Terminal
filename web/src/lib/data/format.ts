/* Text formats for times and durations. Used on the server only (the page derives every
   label before it reaches a client component), so the server's local time zone applies,
   which is the operator's own computer for a local run. */

const pad = (n: number) => String(n).padStart(2, "0");

/** "14:03:09" */
export function clock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** "14:03" */
export function hourMinute(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "5 Oct 2026" */
export function day(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "5 Oct" */
export function shortDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "18m 27s" (minutes keep counting past the hour, which the count-up animation parses). */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
}

/** A scope time limit: "30 min", "2 h", "1 h 30 min". */
export function minutesLimit(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** An ISO time as epoch ms, or null when it is missing or unreadable. */
export function parseTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}
