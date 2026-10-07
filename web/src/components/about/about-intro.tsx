/* The top of the About page, in plain words: what Reconix is, its three parts, where to
   look in this dashboard, and links down to the rest of the page. */
import Link from "next/link";

import { navPages } from "@/components/layout/nav-data";
import { Dot } from "@/components/neu/chips";

import { FACTS, PARTS, SUMMARY, TAGLINE } from "./content";

const JUMPS = [
  { href: "#workflow", label: "Workflow" },
  { href: "#guardrails", label: "Safety gates" },
  { href: "#architecture", label: "How it fits" },
  { href: "#developers", label: "For developers" },
  { href: "#glossary", label: "Glossary" },
];

export function AboutIntro({ operator }: { operator: boolean }) {
  const pages = navPages(operator).filter((p) => p.href !== "/about");
  return (
    <>
      <section className="card hero gap-5 px-6 py-7 sm:px-8 sm:py-8" aria-labelledby="about-title">
        <p className="eyebrow">About this project</p>
        <h2 id="about-title" className="max-w-3xl text-[26px] leading-tight font-semibold text-balance sm:text-[30px]">
          {TAGLINE}
        </h2>
        <div className="flex max-w-3xl flex-col gap-3 text-[14px] text-muted">
          {SUMMARY.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="At a glance">
          {FACTS.map((f) => (
            <li key={f.label} className="pill gap-1.5 uppercase tracking-[0.12em] text-[11px]">
              <span>{f.label}</span>
              <span aria-hidden className="text-faint">
                ▸
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-text normal-case tracking-normal">
                <Dot tone={f.tone} />
                {f.value}
              </span>
            </li>
          ))}
        </ul>
        <nav aria-label="On this page" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
          <span className="text-muted">Jump to</span>
          {JUMPS.map((j) => (
            <a key={j.href} href={j.href} className="link">
              {j.label}
            </a>
          ))}
        </nav>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="card" aria-labelledby="parts-title">
          <h2 id="parts-title" className="text-[15.5px] leading-tight font-semibold">
            Three parts
          </h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {PARTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="grid grid-cols-[34px_minmax(0,1fr)] items-start gap-3">
                <span className="icon-tile" aria-hidden>
                  <Icon size={17} />
                </span>
                <span>
                  <b className="block text-[13.5px] font-semibold">{title}</b>
                  <span className="text-[13px] text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-labelledby="look-title">
          <h2 id="look-title" className="text-[15.5px] leading-tight font-semibold">
            Where to look in this dashboard
          </h2>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {pages.map(({ href, label, icon: Icon, about }) => (
              <li key={href}>
                <Link href={href} className="page-row">
                  <Icon size={17} aria-hidden />
                  <span className="min-w-0">
                    <b className="block text-[13.5px] font-semibold">{label}</b>
                    <span className="text-[12.5px] text-muted">{about}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
