import Link from "next/link";
import SiteHeader from "@/components/site-header";
import RoiCalculator from "@/components/roi-calculator";
import { Label } from "@/components/ui";
import { WAITLIST_BOOKING_URL } from "@/lib/waitlist";

export const metadata = {
  title: "Pricing · VANAV",
  description:
    "Priced per hire onboarded, because that is the number that is growing at our customers.",
};

/**
 * The pricing page.
 *
 * Deliberately separate from /pay, which is the Stripe checkout inherited from
 * an earlier product and still on the old palette. Rewiring a working payment
 * path to make a page prettier is a bad trade; this page argues the model and
 * hands off to that one.
 */

const COMPETITORS = [
  {
    name: "Enboarder",
    model: "~$4–8 per employee / month",
    why: "Charges for the 1,400 people who already work there and do not need us.",
  },
  {
    name: "Trainual",
    model: "$99–249 / month flat",
    why: "A flat fee ignores that our cost and our value both scale with hires.",
  },
  {
    name: "Rippling · BambooHR",
    model: "$8–25 per employee / month",
    why: "HR admin priced by headcount, a different product for a different buyer.",
  },
];

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
            Priced against the time it gives back.
          </h1>
          <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.6] text-muted">
            Not per seat. A seat licence bills you for the fourteen hundred
            people who already know how the company works. We bill against the
            people who don&rsquo;t yet — so the price moves with the problem,
            and every figure behind it is printed below rather than implied.
          </p>
        </section>

        <section className="border-b border-line py-12 lg:py-16">
          <RoiCalculator />
        </section>

        <section className="grid gap-10 border-b border-line py-12 lg:grid-cols-2 lg:gap-16 lg:py-16">
          <div>
            <Label>Plans</Label>
            <div className="mt-5 flex flex-col gap-5">
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
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
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
          </div>

          <div>
            <Label>Why not price like everyone else</Label>
            <div className="mt-5 flex flex-col divide-y divide-line border-y border-line">
              {COMPETITORS.map((c) => (
                <div key={c.name} className="py-3.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[14px] font-medium">{c.name}</span>
                    <span className="shrink-0 font-mono text-[12px] text-faint">
                      {c.model}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-[1.55] text-muted">
                    {c.why}
                  </p>
                </div>
              ))}
            </div>
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
            you can check than a larger one you have to take on faith — which is
            also the whole design principle of the product it is describing.
          </p>
        </section>
      </main>
    </div>
  );
}
