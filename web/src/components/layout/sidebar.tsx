/* The raised sidebar: brand, navigation, and where the data comes from. */
import { Eye, Folder } from "lucide-react";

import { NavLinks } from "./nav-links";

export function Sidebar({ dir, counts }: { dir: string; counts: { assessments: number; findings: number } }) {
  return (
    <aside className="side">
      <div className="flex items-center gap-2.5 px-2">
        <span className="brand-mark" aria-hidden>
          ◆
        </span>
        <span>
          <b className="font-mono text-[15px] font-bold tracking-[0.18em]">RECONIX</b>
          <small className="block font-mono text-[11px] text-muted">analysis · v0.4.0</small>
        </span>
      </div>
      <NavLinks counts={counts} />
      <div className="well mt-auto flex flex-col gap-2.5 p-3.5 text-xs text-muted max-[820px]:hidden">
        <span className="flex items-center gap-2">
          <Folder size={16} aria-hidden />
          Reading from
        </span>
        <code className="font-mono text-[11.5px] text-text [overflow-wrap:anywhere]">{dir}</code>
        <span className="flex items-center gap-2">
          <Eye size={16} aria-hidden className="flex-none" />
          Read-only. Run assessments in the terminal app.
        </span>
      </div>
    </aside>
  );
}
