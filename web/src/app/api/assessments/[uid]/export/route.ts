/* Export one assessment (viewer role), generated from the saved, already-redacted data.
   `?format=` is one of lib/report/formats.ts (pdf, html, json, csv, sarif); the HTML is
   served inline, the PDF too with `inline=1` (the preview page frames it), everything else
   as a download. The PDF needs a headless Chrome on this machine: 501 with a hint otherwise. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { COOKIE, hasRole, launchToken, readRole } from "@/lib/auth/session";
import { loadAssessment } from "@/lib/data/store";
import { downloadHref, exportFileName, exportSpec, isExportFormat } from "@/lib/report/formats";
import { renderReportHtml } from "@/lib/report/html";
import { renderPdf } from "@/lib/report/pdf";
import { renderText } from "@/lib/report/render";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request, ctx: { params: Promise<{ uid: string }> }) {
  const token = launchToken();
  const role = token ? readRole((await cookies()).get(COOKIE)?.value, token) : null;
  if (!hasRole(role, "viewer")) return NextResponse.json({ detail: "Sign in first." }, { status: 401 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "";
  if (!isExportFormat(format)) return NextResponse.json({ detail: "Unknown export format." }, { status: 400 });

  const { uid } = await ctx.params;
  const assessment = await loadAssessment(uid);
  if (!assessment) return NextResponse.json({ detail: "No such assessment." }, { status: 404 });

  const spec = exportSpec(format);
  const inline = format === "html" || (format === "pdf" && url.searchParams.get("inline") === "1");
  const headers = {
    "Content-Type": spec.media,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${exportFileName(assessment.uid, format)}"`,
    ...NO_STORE,
  };

  if (format === "pdf") {
    const pdf = await renderPdf(renderReportHtml(assessment)).catch(() => null);
    if (!pdf) {
      return NextResponse.json(
        {
          detail:
            "PDF export needs a Chrome/Chromium browser on the dashboard machine (set RECONIX_CHROME). " +
            "Open the HTML report instead and print it to PDF.",
          html: downloadHref(assessment.uid, "html"),
        },
        { status: 501 },
      );
    }
    return new NextResponse(pdf, { headers });
  }
  return new NextResponse(renderText(format, assessment), { headers });
}
