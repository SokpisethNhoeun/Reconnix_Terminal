import type { NextConfig } from "next";

import { ALL_DOCS_REDIRECTS } from "./src/lib/docs-redirects";

/* The dashboard is local and read-only, but it shows security findings, so it ships the
   usual hardening headers. The Content-Security-Policy (with a per-request script nonce)
   is set in src/proxy.ts. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  /* The documentation's old addresses (src/lib/docs-redirects.ts: the v2 pages, then every
     page's own address → its anchor on its group's page): permanent, so the browser and search
     engines learn the new address. The specific rules come first (the first match wins). */
  async redirects() {
    return ALL_DOCS_REDIRECTS.map((r) => ({ ...r, permanent: true }));
  },
};

export default nextConfig;
