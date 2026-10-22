/* The Model menu form's model names, before the server checks them again: whether a typed name
   can join the list, and the names a Save (or a test) uses, counting a name still typed in the
   field but not yet added with Enter or Add, so it is never dropped silently. Pure: browser and
   tests. */
import { MAX_MODELS, MODEL_NAME } from "@/lib/assistant/models/schema";

/** Why `name` (trimmed) can't join `list`, or null. */
export function nameProblem(name: string, list: readonly string[]): string | null {
  if (!MODEL_NAME.test(name)) return "A model name uses letters, digits and . _ : / @ + - only (at most 128).";
  if (list.includes(name)) return "That model is listed already.";
  if (list.length >= MAX_MODELS) return `At most ${MAX_MODELS} models.`;
  return null;
}

/** The names to save: `list`, with the name still typed in the field added when there is one
    (already listed: nothing to add). A typed name that can't be added stops the save instead. */
export function namesToSave(list: readonly string[], typed: string): { ok: true; names: string[] } | { ok: false; problem: string } {
  const name = typed.trim();
  if (!name || list.includes(name)) return { ok: true, names: [...list] };
  const problem = nameProblem(name, list);
  if (problem) return { ok: false, problem: `The model name you typed isn't in the list yet: ${problem} Correct it or clear the field.` };
  return { ok: true, names: [...list, name] };
}
