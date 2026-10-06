/* A segmented control made of links, so filters and tabs work without JavaScript and
   every view has a URL. */
import Link from "next/link";

export interface Segment {
  label: string;
  href: string;
  current: boolean;
}

export function SegmentedLinks({ label, items }: { label: string; items: Segment[] }) {
  return (
    <nav className="seg" aria-label={label}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.current ? "true" : undefined} scroll={false}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
