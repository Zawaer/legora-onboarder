import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Reveal from "@/components/reveal";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
  title: "VANAV · onboarding for the job no one has written down yet",
  description:
    "Some roles were never written down; the rest quietly stopped being true. VANAV derives the real role from a company's own Slack, docs and tickets, drives the new hire through their first two days of real work, and flags the onboarding material that has gone out of date.",
};

export const viewport: Viewport = {
  themeColor: "#f8f7f4",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning because the script below deliberately adds
    // `js-reveal` to this element before React hydrates, so the server HTML and
    // the client DOM differ here by design. Scoped to this element's own
    // attributes, so a real mismatch anywhere inside the tree still reports.
    <html
      lang="en"
      className={`${archivo.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Runs before first paint, so the hidden state is in place from the
          start and nothing flashes in and back out. Only opts in when the
          browser lacks native scroll-driven animations AND the reader has not
          asked for reduced motion — Chrome and Edge take the CSS path in
          globals.css instead and never see this class.

          Setting the class here rather than in the component is what removes
          the flicker; undoing it is components/reveal.tsx's job, and both ship
          in the same bundle.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(!(window.CSS&&CSS.supports&&CSS.supports('animation-timeline','view()'))" +
              "&&!matchMedia('(prefers-reduced-motion: reduce)').matches)" +
              "document.documentElement.classList.add('js-reveal')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Reveal />
        {/*
          Vercel Analytics, deliberately not Google Analytics.

          We tell customers in writing that we are careful about where their
          data goes — Apukuski and Fermion both have data handling in their
          blocker (docs/contacts.md). Several EU supervisory authorities have
          found Google Analytics' transfers unlawful, so shipping GA while
          making that claim is the first contradiction a security reviewer
          would find. Analytics choice is part of the compliance story, not
          separate from it.

          This is cookieless and needs no consent banner. Vercel is already a
          sub-processor as our host; it belongs on the list either way
          (docs/security.md §2 item 2).
        */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
