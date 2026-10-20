import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ScrollProgress } from "@/components/scroll-progress";
import { requireViewer } from "@/lib/auth/guard";

/**
 * Chrome for every /docs/** route (the dashboard at / has its own). The viewer check is the
 * second lock behind src/proxy.ts, and it makes the docs render per request, so they carry
 * the proxy's CSP nonce like every other page. Server component.
 */
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  await requireViewer();
  return (
    <>
      <ScrollProgress />
      <SiteNav />
      {children}
      <SiteFooter />
    </>
  );
}
