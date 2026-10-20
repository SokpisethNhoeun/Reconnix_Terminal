/* One report that combines 1–5 saved runs (viewer role), built in memory from the saved,
   already-redacted files and streamed back: `?uids=a,b&format=html|pdf&evidence=1&low=1&appendix=1`.
   The HTML is served inline (the Report view's preview frames it), the PDF as a download printed
   by the same headless Chrome the single export uses (501 with the HTML link without one).
   Nothing is written, started or shelled out with anything the request said: the query is
   validated first (lib/report/combined/query.ts), and the printer only ever gets a temp file. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { COOKIE, hasRole, launchToken, readRole } from "@/lib/auth/session";
import type { Assessment } from "@/lib/data/schema";
import { loadAssessment } from "@/lib/data/store";
import { renderCombinedHtml } from "@/lib/report/combined/html";
import { combinedFileName, combinedHref } from "@/lib/report/combined/options";
import { parseCombinedQuery } from "@/lib/report/combined/query";
import { combineAssessments } from "@/lib/report/combined/select";
import { renderPdf } from "@/lib/report/pdf";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const token = launchToken();
  const role = token ? readRole((await cookies()).get(COOKIE)?.value, token) : null;
  if (!hasRole(role, "viewer")) return NextResponse.json({ detail: "Sign in first." }, { status: 401 });

  const parsed = parseCombinedQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ detail: `Bad request — ${parsed.error}.` }, { status: 400 });
  const { uids, format, options } = parsed.query;

  const assessments: Assessment[] = [];
  for (const uid of uids) {
    const assessment = await loadAssessment(uid);
    if (!assessment) return NextResponse.json({ detail: `No such assessment: ${uid}.` }, { status: 404 });
    assessments.push(assessment);
  }

  const now = new Date();
  const html = renderCombinedHtml(combineAssessments(assessments, options), now);
  const name = combinedFileName(uids.length, format, now);

  if (format === "pdf") {
    const pdf = await renderPdf(html).catch(() => null);
    if (!pdf) {
      return NextResponse.json(
        {
          detail:
            "PDF export needs a Chrome/Chromium browser on the dashboard machine (set RECONIX_CHROME). " +
            "Download the HTML report instead and print it to PDF.",
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
