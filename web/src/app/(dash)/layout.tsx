/* Every signed-in page: the sidebar and the working area. */
import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { loadLibrary, shownDir } from "@/lib/data/store";

export default async function DashLayout({ children }: { children: ReactNode }) {
  const { dir, assessments } = await loadLibrary();
  const findings = assessments.reduce((n, a) => n + a.findings.length, 0);
  return (
    <div className="shell">
      <Sidebar dir={shownDir(dir)} counts={{ assessments: assessments.length, findings }} />
      <main className="flex min-w-0 flex-col gap-6">{children}</main>
    </div>
  );
}
