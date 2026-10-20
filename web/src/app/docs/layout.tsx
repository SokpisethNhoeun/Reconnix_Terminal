import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ScrollProgress } from "@/components/scroll-progress";
import { SmoothScroll } from "@/components/smooth-scroll";
import { requireViewer } from "@/lib/auth/guard";

/**
 * Chrome for every /docs/** route (the dashboard at / has its own). The viewer check is the
 * second lock behind src/proxy.ts, and it makes the docs render per request, so they carry
 * the proxy's CSP nonce like every other page. Server component.
 *
 * Smooth scrolling (Lenis) lives here and nowhere else: the docs scroll the window, which is
 * what Lenis drives. It is created when a docs page mounts and destroyed when the reader goes
 * back to the dashboard, which scrolls natively.
 */
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  await requireViewer();
  return (
    <>
      <SmoothScroll />
      <ScrollProgress />
      <SiteNav />
      {children}
      <SiteFooter />
    </>
  );
}
