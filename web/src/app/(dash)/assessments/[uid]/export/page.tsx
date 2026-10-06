/* Export one assessment: pick a format, check the preview, then download. The download
   itself is the API route; this page only shows what it will send. */
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExportPreview } from "@/components/exports/export-preview";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/neu/card";
import { SegmentedLinks } from "@/components/neu/segmented";
import { Button, buttonVariants } from "@/components/ui/button";
import { loadAssessment } from "@/lib/data/store";
import { formatBytes, plural } from "@/lib/format";
import {
  DEFAULT_EXPORT,
  EXPORT_FORMATS,
  downloadHref,
  exportFileName,
  exportSpec,
  isExportFormat,
  openHref,
  previewHref,
} from "@/lib/report/formats";
import { chromeBinary } from "@/lib/report/pdf";
import { renderText } from "@/lib/report/render";
import { param } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/assessments/[uid]/export">): Promise<Metadata> {
  const assessment = await loadAssessment((await props.params).uid);
  return { title: assessment ? `Export ${assessment.label}` : "Not found" };
}

export default async function ExportPage(props: PageProps<"/assessments/[uid]/export">) {
  const { uid } = await props.params;
  const sp = await props.searchParams;
  const a = await loadAssessment(uid);
  if (!a) notFound();

  const requested = param(sp.format);
  const format = isExportFormat(requested) ? requested : DEFAULT_EXPORT;
  const spec = exportSpec(format);
  const pdfReady = chromeBinary() !== null;
  const text = format === "pdf" ? null : renderText(format, a);
  const fileName = exportFileName(a.uid, format);
  const canDownload = format !== "pdf" || pdfReady;
  const facts: [string, string][] = [
    ["File", fileName],
    ["Type", spec.media.split(";")[0]],
    ["Size", text === null ? (pdfReady ? "A4 · made when you download" : "—") : formatBytes(Buffer.byteLength(text, "utf8"))],
    ["Findings", plural(a.findings.length, "finding")],
  ];

  return (
    <>
      <PageHeader title={`Export ${a.label}`} sub={`${a.target || "target not set"} · pick a format, check the preview, then download`} />
      <section className="card">
        <Link href={`/assessments/${a.uid}`} className="link w-fit">
          <ArrowLeft size={16} aria-hidden />
          Back to {a.label}
        </Link>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3.5">
          <SegmentedLinks
            label="Export format"
            items={EXPORT_FORMATS.map((f) => ({ label: f.label, href: previewHref(a.uid, f.id), current: f.id === format }))}
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {spec.preview === "frame" && canDownload && (
              <a className={buttonVariants({ size: "sm" })} href={openHref(a.uid, format)} target="_blank" rel="noopener">
                <ExternalLink aria-hidden />
                Open in new tab
              </a>
            )}
            {canDownload ? (
              <a className={buttonVariants({ size: "sm", variant: "accent" })} href={downloadHref(a.uid, format)} download={fileName}>
                <Download aria-hidden />
                Download {spec.label}
              </a>
            ) : (
              <Button size="sm" variant="accent" disabled title="No Chrome/Chromium on this computer">
                <Download aria-hidden />
                Download {spec.label}
              </Button>
            )}
          </div>
        </div>
        <p className="m-0 text-[13.5px] text-muted">{spec.blurb}</p>
        <dl className="m-0 flex flex-wrap gap-x-[18px] gap-y-1.5 text-[13px] text-muted">
          {facts.map(([label, value]) => (
            <div key={label} className="flex gap-1.5">
              <dt>{label}</dt>
              <dd className={label === "File" ? "m-0 font-mono font-medium text-text" : "m-0 font-medium text-text"}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <Card title={`${spec.title} preview`} hint={`contains ${spec.contents}`}>
        <ExportPreview assessment={a} format={format} text={text} pdfReady={pdfReady} />
      </Card>
    </>
  );
}
