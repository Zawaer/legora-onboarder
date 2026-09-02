import Link from "next/link";
import SiteHeader from "@/components/site-header";
import RoiCalculator from "@/components/roi-calculator";
import { Label } from "@/components/ui";
import { WAITLIST_BOOKING_URL } from "@/lib/waitlist";

export const metadata = {
  title: "Pricing · VANAV",
  description:
    "Priced per hire onboarded, because that is the number that grows when a company is scaling.",
};

/**
 * The pricing page. PARKED — not routed, not reachable.
 *
 * It lives in app/_pricing rather than app/pricing: the leading underscore is
 * a Next private folder, so no URL resolves here and /pricing returns the 404.
 * The page is kept whole because the argument in it is worth more than the
 * half hour it would take to rebuild, and it is one `git mv` from being live
 * again. If it is restored, restore it into the nav and footer too, or it will
 * be a page nobody can find.
 *
 * Deliberately separate from /pay, which is the Stripe checkout inherited from
 * an earlier product and still on the old palette. Rewiring a working payment
 * path to make a page prettier is a bad trade; this page argues the model and
 * hands off to that one.
 *
 * Two things came off it. The comparison table against established vendors
 * claimed a seat at a table we have not been offered: a product at waitlist
 * stage that prices itself against incumbents is telling the reader it has a
 * market position, and the reader will check. The calculator moved behind a
 * disclosure for the opposite reason. It is the strongest thing here and it
 * was spending that strength on people who had not yet been given a reason to
 * care. One sentence states the return; the arithmetic is one click away for
 * anyone who wants to take it apart, and it agrees with the sentence at the
 * calculator's own defaults.
 */

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader
        right={
          <Link
            href="/#waitlist"
            className="text-[13px] text-muted hover:text-ink"
          >
            Join the waitlist
          </Link>
        }
      />

      <main className="mx-auto w-full max-w-[1100px] px-5 pb-20 sm:px-8">
        <section className="border-b border-line py-14 lg:py-20">
          <h1 className="max-w-[20ch] text-balance text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[44px]">
            Priced per hire, not per seat.
          </h1>
          <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.6] text-muted">
            A seat licence bills you for the fourteen hundred people who already
            know how the company works. We bill for the ones who don&rsquo;t
            yet, so the price moves with the problem, and every figure behind it
            is printed below rather than implied.
          </p>
        </section>

        <section className="border-b border-line py-12 lg:py-16">
          <Label>The return</Label>
          <p className="mt-4 max-w-[46ch] text-balance text-[22px] leading-[1.4] font-medium tracking-[-0.02em] sm:text-[26px]">
            A company hiring 60 people a year recovers the cost in under 7
            months of saved onboarding time.
          </p>
          <div className="mt-7">
            <RoiCalculator />
          </div>
        </section>

        <section className="border-b border-line py-12 lg:py-16">
          <Label>Plans</Label>
          <div className="mt-6 grid gap-6 sm:grid-cols-3 sm:gap-8">
            <div className="border-l-2 border-line-strong pl-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">Pilot</span>
                <span className="font-mono text-[13px] text-faint">€900 once</span>
              </div>
              <p className="mt-1.5 text-[14px] leading-[1.6] text-muted">
                One team, 30 days. Credited against year one.
              </p>
            </div>
            <div className="border-l-2 border-accent pl-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">Team</span>
                <span className="font-mono text-[13px] text-accent-ink">€1,600 / mo</span>
              </div>
              <p className="mt-1.5 text-[14px] leading-[1.6] text-muted">
                12 onboardings included, then €500 each.
              </p>
            </div>
            <div className="border-l-2 border-line-strong pl-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">Scale</span>
                <span className="font-mono text-[13px] text-faint">€3,200 / mo</span>
              </div>
              <p className="mt-1.5 text-[14px] leading-[1.6] text-muted">
                40 onboardings included, then €300 each. SSO and compliance
                review.
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
            <a
              href={WAITLIST_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 text-[14px] font-medium text-paper transition-opacity hover:opacity-90"
            >
              Book 20 minutes
              <span aria-hidden>→</span>
            </a>
            <span className="text-faint">
              We are onboarding companies in order.
            </span>
          </div>
        </section>

        <section className="py-12 lg:py-16">
          <Label>The honest part</Label>
          <p className="mt-4 max-w-[70ch] text-[15px] leading-[1.65] text-muted">
            Of the two savings in the calculator, only one is measured. The
            product counts every question it resolves without interrupting a
            colleague and reports it at{" "}
            <code className="font-mono text-[13.5px] text-accent-ink">
              /api/resolutions
            </code>
            , so that line is evidence. The ramp-time line is a model, and we
            have labelled it as one. We would rather show you a smaller number
            you can check than a larger one you have to take on faith, which is
            also the whole design principle of the product it is describing.
          </p>
        </section>
      </main>
    </div>
  );
}
