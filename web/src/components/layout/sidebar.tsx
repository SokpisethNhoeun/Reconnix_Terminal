/* The raised sidebar: brand, navigation, and a pinned Settings link at the foot. Where the
   data is read from now lives on the Settings page. */
import { NavLinks } from "./nav-links";
import { Wordmark } from "./wordmark";

interface SidebarProps {
  counts: { assessments: number; findings: number };
  terminal: boolean; // the AI Assistant (Terminal) page is open to this user
}

export function Sidebar({ counts, terminal }: SidebarProps) {
  return (
    <aside className="side">
      <Wordmark sub="analysis · v0.4.0" className="px-2 text-base" />
      <NavLinks counts={counts} terminal={terminal} />
      <div className="mt-auto">
        <NavLinks counts={counts} terminal={terminal} slot="bottom" />
      </div>
    </aside>
  );
}
