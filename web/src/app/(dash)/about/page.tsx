/* Documentation: how to use Reconix, in four short sections with a sub-nav. Reads no saved
   data, but needs the viewer role like every page (the proxy checks first; this is the
   second lock). The route stays /about so existing links keep working. */
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DocsNav } from "@/components/docs/docs-nav";
import { SECTIONS } from "@/components/docs/sections";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { requireViewer } from "@/lib/auth/guard";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Documentation" };

export default async function DocumentationPage(props: PageProps<"/about">) {
  await requireViewer();
  const sp = await props.searchParams;
  const id = SECTIONS.some((s) => s.id === param(sp.s)) ? param(sp.s) : "overview";
  const index = SECTIONS.findIndex((s) => s.id === id);
  const section = SECTIONS[index];
  const prev = SECTIONS[index - 1];
  const next = SECTIONS[index + 1];
  const href = (sid: string) => `/about${sid === "overview" ? "" : `?s=${sid}`}`;

  const search = (
    <div className="relative max-[820px]:hidden">
      <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <Input placeholder="Search the docs" className="w-56 pl-9" aria-label="Search the docs" disabled />
    </div>
  );

  return (
    <>
      <PageHeader title="Documentation" sub="How to use Reconix · works offline" live={false} actions={search} />

      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <DocsNav current={id} />

        <article className="flex min-w-0 flex-col gap-4">
          <div>
            <h2 className="text-[24px] font-semibold">{section.title}</h2>
            <p className="mt-1 text-[14px] text-muted">{section.lede}</p>
          </div>

          <section.Body />

          <footer className="mt-4 flex flex-wrap justify-between gap-3 border-t border-line pt-5">
            {prev ? (
              <Link href={href(prev.id)} className="btn flex-col items-start !gap-0.5 py-2.5 text-left">
                <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
                  <ArrowLeft size={13} aria-hidden /> Previous
                </span>
                <span className="font-semibold">{prev.label}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={href(next.id)} className="btn flex-col items-end !gap-0.5 py-2.5 text-right">
                <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
                  Next <ArrowRight size={13} aria-hidden />
                </span>
                <span className="font-semibold">{next.label}</span>
              </Link>
            )}
          </footer>
        </article>
      </div>
    </>
  );
}
