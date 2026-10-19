/* One finding on its own page. The key is "<assessment uid>~<finding id>"; an unknown one is
   a 404, like an unknown assessment. Needs the viewer role (a second lock behind the proxy). */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FindingView } from "@/components/findings/finding-view";
import { currentRole, requireViewer } from "@/lib/auth/guard";
import { mayUseTerminal } from "@/lib/auth/session";
import { allFindings } from "@/lib/data/stats";
import { loadLibrary } from "@/lib/data/store";

async function load(key: string) {
  const { assessments } = await loadLibrary();
  return allFindings(assessments).find((f) => f.key === decodeURIComponent(key)) ?? null;
}

export async function generateMetadata(props: PageProps<"/findings/[key]">): Promise<Metadata> {
  const { key } = await props.params;
  const finding = await load(key);
  return { title: finding ? finding.title : "Finding" };
}

export default async function FindingPage(props: PageProps<"/findings/[key]">) {
  await requireViewer();
  const { key } = await props.params;
  const [finding, role] = await Promise.all([load(key), currentRole()]);
  if (!finding) notFound();
  return <FindingView finding={finding} operator={mayUseTerminal(role)} />;
}
