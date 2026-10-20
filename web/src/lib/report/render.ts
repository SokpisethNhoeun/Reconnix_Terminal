/* The JSON export's text: the saved assessment as it is (the PDF is printed from `html.ts` by
   `pdf.ts`, the DOCX is built by `docx.ts`). Server-only, like the other renderers. */
import "server-only";

import type { Assessment } from "@/lib/data/schema";

export function renderJson(assessment: Assessment): string {
  return `${JSON.stringify(assessment, null, 2)}\n`;
}
