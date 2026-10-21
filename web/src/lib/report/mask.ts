/* Masking a saved assessment once more, at the boundary, before a report is built from it:
   every string leaf goes through lib/assistant/redact.ts (the TUI's own patterns), so no field a
   report prints can escape it. Enums, uids and timestamps pass through unchanged, since no
   pattern matches them. Lists of strings are masked as one text (joined by newlines, then split
   back), so a private key spread over several evidence lines is caught as one block. Pure. */
import { redact } from "@/lib/assistant/redact";
import type { Assessment } from "@/lib/data/schema";

const isStrings = (value: unknown[]): value is string[] => value.length > 0 && value.every((v) => typeof v === "string"); // [] stays []

/** `value` with every string inside it masked (arrays and plain objects are walked). */
export function maskDeep<T>(value: T): T {
  if (typeof value === "string") return redact(value) as T;
  if (Array.isArray(value)) {
    if (isStrings(value)) return redact(value.join("\n")).split("\n") as T;
    return value.map(maskDeep) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, maskDeep(v)])) as T;
  }
  return value;
}

/** The assessment as a report may read it: masked again, field for field. */
export const maskAssessment = (a: Assessment): Assessment => maskDeep(a);
