/* One report that combines 1–5 saved runs (viewer role), built in memory from the saved,
   already-redacted files, masked once more at this boundary (lib/report/mask.ts), and streamed back: `?uids=a,b&format=html|pdf&evidence=1&low=1&appendix=1`.
   The HTML is served inline (the Report view's preview fetches it), the PDF as a download printed
   by the same headless Chrome the single export uses (501 with the HTML link without one).
   Nothing is written, started or shelled out with anything the request said: the query is
   validated first (lib/report/combined/query.ts), and the printer only ever gets a temp file. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { COOKIE, hasRole, launchToken, readRole } from "@/lib/auth/session";
import { loadLibrary } from "@/lib/data/store";
import { renderCombinedHtml } from "@/lib/report/combined/html";
import { maskAssessment } from "@/lib/report/mask";
import { combinedFileName, combinedHref } from "@/lib/report/combined/options";
import { NO_PRINTER } from "@/lib/report/formats";
import { parseCombinedQuery } from "@/lib/report/combined/query";
import { combineAssessments } from "@/lib/report/combined/select";
import { renderPdf } from "@/lib/report/pdf";

const NO_STORE = { "Cache-Control": "no-store" };
const refuse = (detail: string, status: number) => NextResponse.json({ detail }, { status, headers: NO_STORE });

export async function GET(request: Request) {
  const token = launchToken();
  const role = token ? readRole((await cookies()).get(COOKIE)?.value, token) : null;
  if (!hasRole(role, "viewer")) return refuse("Sign in first.", 401);

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
  const html = renderCombinedHtml(combineAssessments(picked, options), now);
  const name = combinedFileName(uids.length, format, now);

  if (format === "pdf") {
    const pdf = await renderPdf(html).catch(() => null);
    if (!pdf) {
      return NextResponse.json(
        {
          detail: NO_PRINTER,
          html: combinedHref(uids, "html", options),
        },
        { status: 501, headers: NO_STORE },
      );
    }
    return new NextResponse(pdf, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, ...NO_STORE },
    });
  }
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `inline; filename="${name}"`, ...NO_STORE },
  });
}
