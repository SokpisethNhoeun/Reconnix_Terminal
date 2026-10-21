/* Export one assessment (viewer role), generated from the saved, already-redacted data, masked
   once more at this boundary (lib/report/mask.ts) before any format is built. `?format=` is
   one of lib/report/formats.ts (pdf, html, json, csv, sarif); the HTML is served inline, the
   PDF too with `inline=1`, everything else as a download. The PDF needs a headless Chrome on
   this machine: 501 with a hint otherwise. Every answer is no-store. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { COOKIE, hasRole, launchToken, readRole } from "@/lib/auth/session";
import { loadAssessment } from "@/lib/data/store";
import { downloadHref, exportFileName, exportSpec, isExportFormat, NO_PRINTER } from "@/lib/report/formats";
import { renderReportHtml } from "@/lib/report/html";
import { maskAssessment } from "@/lib/report/mask";
import { renderPdf } from "@/lib/report/pdf";
import { renderText } from "@/lib/report/render";

const NO_STORE = { "Cache-Control": "no-store" };
const refuse = (detail: string, status: number) => NextResponse.json({ detail }, { status, headers: NO_STORE });

export async function GET(request: Request, ctx: { params: Promise<{ uid: string }> }) {
  const token = launchToken();
  const role = token ? readRole((await cookies()).get(COOKIE)?.value, token) : null;
  if (!hasRole(role, "viewer")) return refuse("Sign in first.", 401);

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "";
  if (!isExportFormat(format)) return refuse("Unknown export format.", 400);

  const { uid } = await ctx.params;
  const saved = await loadAssessment(uid);
  if (!saved) return refuse("No such assessment.", 404);
  const assessment = maskAssessment(saved);

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
          detail: NO_PRINTER,
          html: downloadHref(assessment.uid, "html"),
        },
        { status: 501, headers: NO_STORE },
      );
    }
    return new NextResponse(pdf, { headers });
  }
  return new NextResponse(renderText(format, assessment), { headers });
}
