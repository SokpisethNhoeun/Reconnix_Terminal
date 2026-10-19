/* Settings: the AI models the AI Assistant can use. A visual mock — there is no backend for
   model keys in this version, so nothing is stored. The theme switch lives in the header on
   every page. Needs the viewer role like every page (a second lock behind the proxy). */
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { AiModels } from "@/components/settings/ai-models";
import { requireViewer } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireViewer();
  return (
    <>
      <PageHeader title="Settings" sub="AI models" live={false} />
      <AiModels />
    </>
  );
}
