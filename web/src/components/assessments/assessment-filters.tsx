/* Search, template, status and date-range filters for the assessments list. A plain GET
   form plus links, so every view has a URL. The controls are shadcn/ui (Input, Select,
   Button); the Selects carry a `name`, so they submit like native selects. */
import { Search } from "lucide-react";

import { STATUSES } from "@/lib/data/schema";
import type { AssessmentFilter } from "@/lib/data/stats";
import { query } from "@/lib/utils";

import { SegmentedLinks } from "../neu/segmented";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

export const RANGES = [
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "all", label: "All" },
] as const;

export function AssessmentFilters({ filter, templates }: { filter: AssessmentFilter; templates: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <form method="get" action="/assessments" className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <label htmlFor="assessment-search" className="sr-only-x">
            Search
          </label>
          <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input id="assessment-search" name="q" defaultValue={filter.q} placeholder="Search target or id" className="w-52 pl-9" />
        </div>

        <Select name="template" defaultValue={filter.template || "all"}>
          <SelectTrigger className="w-44" aria-label="Template">
            <SelectValue placeholder="All templates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All templates</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select name="status" defaultValue={filter.status || "all"}>
          <SelectTrigger className="w-44" aria-label="Status">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filter.range !== "all" && <input type="hidden" name="range" value={filter.range} />}
        <Button type="submit">Apply</Button>
      </form>
      <SegmentedLinks
        label="Date range"
        items={RANGES.map((r) => ({
          label: r.label,
          href: `/assessments${query({ ...filter, range: r.id })}`,
          current: (filter.range || "all") === r.id,
        }))}
      />
    </div>
  );
}
