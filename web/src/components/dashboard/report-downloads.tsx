/* One run's report in every export format (lib/report/formats.ts), served by
   /api/assessments/[uid]/export; each link says what the file is for. */
import { Download } from "lucide-react";
import { EXPORT_FORMATS, downloadHref } from "@/lib/report/formats";

export function ReportDownloads({ uid }: { uid: string }) {
  return (
    <nav aria-label="Download the report" className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="mr-0.5 inline-flex items-center gap-1 text-muted-foreground">
        <Download className="size-3.5" aria-hidden /> Download
      </span>
      {EXPORT_FORMATS.map((f) => (
        <a
          key={f.id}
          href={downloadHref(uid, f.id)}
          download
          title={f.blurb}
          className="dash-chip h-[28px] border border-border px-3 text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {f.label}
        </a>
      ))}
    </nav>
  );
}
