/* Every saved assessment, newest first, with filters. */
import type { Metadata } from "next";

import { AssessmentFilters } from "@/components/assessments/assessment-filters";
import { AssessmentTable } from "@/components/assessments/assessment-table";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/neu/card";
import { type AssessmentFilter, filterAssessments } from "@/lib/data/stats";
import { loadLibrary } from "@/lib/data/store";
import { plural } from "@/lib/format";
import { param } from "@/lib/utils";

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
        <AssessmentTable assessments={shown} />
      </Card>
    </>
  );
}
