/* Every saved assessment, newest first, with filters, 10 to a page. */
import type { Metadata } from "next";

import { AssessmentFilters } from "@/components/assessments/assessment-filters";
import { AssessmentTable } from "@/components/assessments/assessment-table";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/neu/card";
import { Pager } from "@/components/neu/pager";
import { type AssessmentFilter, filterAssessments } from "@/lib/data/stats";
import { loadLibrary } from "@/lib/data/store";
import { plural } from "@/lib/format";
import { pageNumber, pageParam, paginate } from "@/lib/pagination";
import { param, query } from "@/lib/utils";

export const metadata: Metadata = { title: "Assessments" };

export default async function AssessmentsPage(props: PageProps<"/assessments">) {
  const sp = await props.searchParams;
  const filter: AssessmentFilter = {
    q: param(sp.q).slice(0, 100),
    template: param(sp.template),
    status: param(sp.status),
    range: param(sp.range) || "all",
  };
  const { assessments } = await loadLibrary();
  const shown = filterAssessments(assessments, filter);
  const page = paginate(shown, pageNumber(param(sp.page)));
  const templates = [...new Set(assessments.map((a) => a.template.name).filter(Boolean))].sort();

  return (
    <>
      <PageHeader
        title="Assessments"
        sub={
          shown.length === assessments.length
            ? `${plural(assessments.length, "saved assessment")} · newest first`
            : `${shown.length} of ${plural(assessments.length, "saved assessment")}`
        }
      />
      <Card>
        <AssessmentFilters filter={filter} templates={templates} />
        <AssessmentTable assessments={page.items} />
        <Pager page={page} label="Assessment pages" hrefFor={(n) => `/assessments${query({ ...filter, page: pageParam(n) })}`} />
      </Card>
    </>
  );
}
