/* Download one saved assessment as JSON (viewer role; the file was validated on load). */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { COOKIE, hasRole, launchToken, readRole } from "@/lib/auth/session";
import { loadAssessment } from "@/lib/data/store";

export async function GET(_request: Request, ctx: RouteContext<"/api/assessments/[uid]">) {
  const token = launchToken();
  const role = token ? readRole((await cookies()).get(COOKIE)?.value, token) : null;
  if (!hasRole(role, "viewer")) return NextResponse.json({ detail: "Sign in first." }, { status: 401 });

  const { uid } = await ctx.params;
  const assessment = await loadAssessment(uid);
  if (!assessment) return NextResponse.json({ detail: "No such assessment." }, { status: 404 });

  return new NextResponse(JSON.stringify(assessment, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${assessment.uid}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
