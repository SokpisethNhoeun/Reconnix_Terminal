"use client";

/* The assessment's Export ▾ menu: one entry per format, each opening the preview page
   where the file is checked before it is downloaded. */
import { Braces, ChevronDown, Download, FileCode2, FileText, Globe, type LucideIcon, Table2 } from "lucide-react";
import Link from "next/link";

import { EXPORT_FORMATS, type ExportFormat, previewHref } from "@/lib/report/formats";

import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export const FORMAT_ICONS: Record<ExportFormat, LucideIcon> = {
  pdf: FileText,
  html: Globe,
  json: Braces,
  csv: Table2,
  sarif: FileCode2,
};

export function ExportMenu({ uid }: { uid: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="accent" aria-label="Export this assessment">
          <Download aria-hidden />
          Export
          <ChevronDown aria-hidden className="text-muted" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Preview, then download</DropdownMenuLabel>
        {EXPORT_FORMATS.map((f) => {
          const Icon = FORMAT_ICONS[f.id];
          return (
            <DropdownMenuItem key={f.id} asChild>
              <Link href={previewHref(uid, f.id)}>
                <Icon aria-hidden />
                <span>{f.title}</span>
                <DropdownMenuShortcut>.{f.ext}</DropdownMenuShortcut>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
