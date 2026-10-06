/* Files in the data folder that could not be used (wrong format, too big, unreadable). */
import { FileWarning } from "lucide-react";

import type { Problem } from "@/lib/data/store";
import { plural } from "@/lib/format";

import { Notice } from "../neu/notice";

export function SkippedFiles({ problems }: { problems: Problem[] }) {
  if (!problems.length) return null;
  return (
    <Notice icon={<FileWarning size={18} />} tone="warn">
      <b className="font-semibold">{plural(problems.length, "file")} skipped.</b>{" "}
      <span className="text-muted">
        {problems
          .slice(0, 3)
          .map((p) => `${p.file} (${p.reason})`)
          .join(", ")}
        {problems.length > 3 ? ", …" : ""}
      </span>
    </Notice>
  );
}
