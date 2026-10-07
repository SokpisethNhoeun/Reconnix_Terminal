/* The Terminal page: the Reconix terminal app in this browser tab (operators only). The
   session itself is the layout's TerminalDock, so it keeps running while you look at the
   other pages; this page gives it its header. */
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { requireTerminalAccess } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "Terminal" };

export default async function TerminalPage() {
  await requireTerminalAccess();
  return (
    <PageHeader
      title="Terminal"
      sub="The Reconix terminal app on this computer, with the same gates and approvals. What you run here shows up on the other pages."
      live={false}
    />
  );
}
