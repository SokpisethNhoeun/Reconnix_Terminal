/* One report that combines 1–5 saved runs (signed in), built in memory from the saved,
   already-redacted files, masked once more at this boundary (lib/report/mask.ts), and streamed back: `?uids=a,b&format=preview|pdf|docx&evidence=1&low=1&appendix=1`.
   `preview` is the report's HTML, served inline for the Report view's sandboxed frame (it is never
   offered as a download); the PDF is a download printed by the same headless Chrome the single
   export uses (501 with the Word document's link without one); `docx` is the Word document (413,
   DOCX_TOO_LARGE, past DOCX_MAX_MIB of text).
   Nothing is written, started or shelled out with anything the request said: the query is
   validated first (lib/report/combined/query.ts), and the printer only ever gets a temp file. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { COOKIE, launchToken, readSession } from "@/lib/auth/session";
import { loadLibrary } from "@/lib/data/store";
import { renderCombinedDocx } from "@/lib/report/docx/combined";
import { DocxTooLarge } from "@/lib/report/docx/ooxml";
import { renderCombinedHtml } from "@/lib/report/combined/html";
import { maskAssessment } from "@/lib/report/mask";
import { combinedFileName, combinedHref } from "@/lib/report/combined/options";
import { DOCX_MEDIA, DOCX_TOO_LARGE, NO_PRINTER } from "@/lib/report/formats";
import { parseCombinedQuery } from "@/lib/report/combined/query";
import { combineAssessments } from "@/lib/report/combined/select";
import { renderPdf } from "@/lib/report/pdf";

const NO_STORE = { "Cache-Control": "no-store" };
const refuse = (detail: string, status: number) => NextResponse.json({ detail }, { status, headers: NO_STORE });

export async function GET(request: Request) {
  const token = launchToken();
  if (!token || !readSession((await cookies()).get(COOKIE)?.value, token)) return refuse("Sign in first.", 401);

  const parsed = parseCombinedQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return refuse(`Bad request — ${parsed.error}.`, 400);
  const { uids, format, options } = parsed.query;

  // one read of the folder, so the runs come from the same moment
  const library = await loadLibrary();
  const assessments = uids.map((uid) => library.assessments.find((a) => a.uid === uid) ?? uid);
  const absent = assessments.find((a): a is string => typeof a === "string");
  if (absent !== undefined) return refuse(`No such assessment: ${absent}.`, 404);

  const now = new Date();
  const picked = assessments.filter((a) => typeof a !== "string").map(maskAssessment);
  const report = combineAssessments(picked, options);

  if (format === "docx") {
    let docx: Uint8Array<ArrayBuffer>;
    try {
      docx = renderCombinedDocx(report, now);
    } catch (error) {
      if (error instanceof DocxTooLarge) return refuse(DOCX_TOO_LARGE, 413);
      throw error;
    }
    return new NextResponse(docx, {
      headers: { "Content-Type": DOCX_MEDIA, "Content-Disposition": `attachment; filename="${combinedFileName(uids.length, "docx", now)}"`, ...NO_STORE },
    });
  }
  const html = renderCombinedHtml(report, now);
  if (format === "pdf") {
    const pdf = await renderPdf(html).catch(() => null);
    if (!pdf) {
      return NextResponse.json(
        {
          detail: NO_PRINTER,
          docx: combinedHref(uids, "docx", options),
        },
        { status: 501, headers: NO_STORE },
      );
    }
    return new NextResponse(pdf, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${combinedFileName(uids.length, "pdf", now)}"`, ...NO_STORE },
    });
  }
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": "inline", ...NO_STORE } });
}
