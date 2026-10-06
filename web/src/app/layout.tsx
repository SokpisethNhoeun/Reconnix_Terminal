import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/layout/theme-provider";

import "./globals.css";

const ui = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-ui" });
const code = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-code" });

export const metadata: Metadata = {
  title: { default: "Reconix analysis", template: "%s · Reconix analysis" },
  description: "Read-only analysis of the assessments the Reconix terminal app saved on this computer.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning className={`${ui.variable} ${code.variable}`}>
      <body>
        <ThemeProvider nonce={nonce}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
