/* Every saved assessment, newest first: the template summary cards, the filters, then the
   table, 10 to a page. A run waiting for the operator is called out at the top. */
import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AssessmentFilters } from "@/components/assessments/assessment-filters";
import { AssessmentTable } from "@/components/assessments/assessment-table";
import { TemplateCards } from "@/components/assessments/template-cards";
import { WaitingBanner } from "@/components/assessments/waiting-banner";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/neu/card";
import { Pager } from "@/components/neu/pager";
import { SegmentedLinks } from "@/components/neu/segmented";
import { buttonVariants } from "@/components/ui/button";
import { currentRole } from "@/lib/auth/guard";
import { mayUseTerminal } from "@/lib/auth/session";
import { type AssessmentFilter, filterAssessments } from "@/lib/data/stats";
import { loadLibrary } from "@/lib/data/store";
import { plural } from "@/lib/format";
import { TEMPLATE_TYPES } from "@/lib/templates";
import { TERMINAL_PAGE } from "@/lib/terminal/paths";
import { pageNumber, pageParam, paginate } from "@/lib/pagination";
import { cn, param, query } from "@/lib/utils";

export const metadata: Metadata = { title: "Assessments" };

export default async function AssessmentsPage(props: PageProps<"/assessments">) {
  const sp = await props.searchParams;
  const filter: AssessmentFilter = {
    q: param(sp.q).slice(0, 100),
    template: param(sp.template),
    status: param(sp.status),
    range: param(sp.range) || "all",
  };
  const [{ assessments }, role] = await Promise.all([loadLibrary(), currentRole()]);
  const operator = mayUseTerminal(role);
  const shown = filterAssessments(assessments, filter);
  const page = paginate(shown, pageNumber(param(sp.page)));
  const typeCounts = TEMPLATE_TYPES.map((t) => ({ label: t.label, count: assessments.filter((a) => t.match.test(a.template.name)).length }));
  const templates = TEMPLATE_TYPES.map((t) => t.label);
  const waiting = assessments.find((a) => a.status === "Awaiting input");
  const activeTemplate = filter.template && filter.template !== "all" ? filter.template : "all";

  const newAssessment = operator ? (
    <Link href={TERMINAL_PAGE} className={cn(buttonVariants({ variant: "accent", size: "sm" }))}>
      <Sparkles size={15} aria-hidden />
      New assessment in AI Assistant
    </Link>
  ) : undefined;

  return (
    <>
      <PageHeader
        title="Assessments"
        sub={
          shown.length === assessments.length
            ? `${plural(assessments.length, "assessment")} · newest first`
            : `${shown.length} of ${plural(assessments.length, "assessment")}`
        }
        actions={newAssessment}
      />

      {waiting && <WaitingBanner assessment={waiting} operator={operator} context="list" />}

      <TemplateCards assessments={assessments} />

      <Card>
        <AssessmentFilters filter={filter} templates={templates} />
        <SegmentedLinks
          label="Template"
          items={[
            { label: `All ${assessments.length}`, href: `/assessments${query({ ...filter, template: undefined, page: undefined })}`, current: activeTemplate === "all" },
            ...typeCounts.map((t) => ({
              label: `${t.label} ${t.count}`,
              href: `/assessments${query({ ...filter, template: t.label, page: undefined })}`,
              current: activeTemplate === t.label,
            })),
          ]}
        />
        <AssessmentTable assessments={page.items} />
        <Pager page={page} label="Assessment pages" hrefFor={(n) => `/assessments${query({ ...filter, page: pageParam(n) })}`} />
        <p className="text-[12.5px] text-muted">
          Showing {page.items.length} of {plural(shown.length, "assessment")} · click a row to open details · all actions happen in the AI Assistant
        </p>
      </Card>
    </>
  );
}
