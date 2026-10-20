import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocPageCards } from "@/components/docs-cards";
import { DocsLayout, DocSection, Mono } from "@/components/docs-layout";
import { COMMAND_GROUPS, DOCS_NAV, commandHref } from "@/lib/docs-nav";

// only the groups listed in DOCS_NAV exist
export const dynamicParams = false;

const groupsWithPages = DOCS_NAV.filter((g) => g.pages.length > 0);

export function generateStaticParams() {
  return groupsWithPages.map((g) => ({ group: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ group: string }> }): Promise<Metadata> {
  const { group } = await params;
  const g = groupsWithPages.find((x) => x.id === group);
  return { title: g ? `${g.title} · Reconix docs` : "Reconix docs" };
}

/** The Commands landing: the generated reference, one row per command, by area. */
function CommandIndex() {
  return (
    <>
      <DocSection title="How to read this reference">
        <p>
          Type <Mono>/</Mono> in the terminal, keep typing to filter, <Mono>↑</Mono>/<Mono>↓</Mono> to pick, <Mono>Tab</Mono> to
          complete and <Mono>Enter</Mono> to run (see <Link href="/docs/terminal-guide/command-bar" className="text-primary underline-offset-4 hover:underline">The command bar</Link>).
          Every page below describes one command: its purpose, when to use it, its syntax, an example, what happens and
          the messages it can show. The list itself is generated from the terminal&apos;s command registry, so it always
          matches the commands you can type.
        </p>
      </DocSection>
      {COMMAND_GROUPS.map((g) => (
        <DocSection key={g.id} title={g.title}>
          <ul className="!ml-0 space-y-2 [&>li]:!ml-0 [&>li]:!list-none">
            {g.commands.map((c) => (
              <li key={c.name} className="docs-command-row rounded-lg border border-border bg-card/60 px-4 py-3">
                <Link href={commandHref(c.name)} className="font-mono text-sm font-medium text-primary underline-offset-4 hover:underline">
                  /{c.name}
                </Link>
                <span className="text-sm">
                  {c.description}
                  {c.aliases.length > 0 && (
                    <span className="text-muted-foreground"> · alias{c.aliases.length > 1 ? "es" : ""} {c.aliases.map((a) => `/${a}`).join(", ")}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </DocSection>
      ))}
    </>
  );
}

/** Group landing: the group's description and a card per page (the Commands group lists its reference). */
export default async function DocGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const g = groupsWithPages.find((x) => x.id === group);
  if (!g) notFound();
  return (
    <DocsLayout href={g.href} lede={g.description}>
      {g.id === "commands" ? (
        <CommandIndex />
      ) : (
        <DocSection title="In this section">
          <DocPageCards pages={g.pages} />
        </DocSection>
      )}
    </DocsLayout>
  );
}
