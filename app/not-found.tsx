import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { Label } from "@/components/ui";

export const metadata: Metadata = {
  title: "Not found · VANAV",
  description:
    "The page you asked for does not exist. Here is the way back into the product.",
};

/**
 * The 404.
 *
 * Renders the site header rather than a bare centred message, because the only
 * useful thing this page can do is put someone back on a real surface — and a
 * lost visitor who has to hit the back button has already learned something
 * unflattering about how finished the product is.
 *
 * No numeral, no illustration, no joke. A 404 is a small administrative fact,
 * and dressing it up is the tell of a demo. It is set in the same measures and
 * rules as /pricing so it reads as the same site rather than a fallback.
 */

const WAYS_OUT = [
  {
    href: "/",
    label: "Home",
    why: "What VANAV does, why the role it derives is falsifiable, and who it is for.",
  },
  {
    href: "/manager",
    label: "Manager view",
    why: "What each new hire is stuck on, who can unblock them, and how many minutes it costs.",
  },
  {
    href: "/pricing",
    label: "Pricing",
    why: "Priced per hire onboarded, with the arithmetic behind the number printed in full.",
  },
];

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1100px] px-5 pb-20 sm:px-8">
        <section className="border-b border-line py-14 lg:py-20">
          <Label>Not found</Label>
          <h1 className="mt-5 max-w-[20ch] text-balance text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[44px]">
            This page doesn&rsquo;t exist.
          </h1>
          <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.6] text-muted">
            The address may be mistyped, or it may point at something that has
            since moved. Nothing is broken behind it, there is simply
            nothing here.
          </p>
        </section>

        <section className="py-12 lg:py-16">
          <Label>Where you probably meant to go</Label>
          <div className="mt-5 flex max-w-[62ch] flex-col divide-y divide-line border-y border-line">
            {WAYS_OUT.map((w) => (
              <Link key={w.href} href={w.href} className="group py-3.5">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[14px] font-medium underline-offset-4 group-hover:underline">
                    {w.label}
                  </span>
                  <span className="shrink-0 font-mono text-[12px] text-faint">
                    {w.href}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-[1.55] text-muted">
                  {w.why}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
