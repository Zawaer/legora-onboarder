import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/**
 * Archivo for what is read, IBM Plex Mono for what is measured.
 *
 * Self-hosted by next/font at build time rather than linked to Google: no
 * third-party request on first paint, no layout shift, and the demo still
 * renders correctly on a conference network that cannot reach fonts.gstatic.
 */
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Vanav — onboarding for roles that have never existed",
  description:
    "Vanav derives a brand-new role from a company's real Slack, docs and tickets, then drives the new hire through their first two days of real work — escalating to a human only when it genuinely can't unblock them.",
};

export const viewport: Viewport = {
  themeColor: "#eceee4",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
