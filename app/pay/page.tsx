import Link from "next/link";
import QRCode from "qrcode";
import { describePlan, PLAN_IDS, type PlanId } from "@/lib/stripe";
import { normaliseSource } from "@/lib/source";
import { PITCH, PRODUCT } from "@/lib/product";

// Prices are read from Stripe on every load, and the source comes off the URL.
export const dynamic = "force-dynamic";

type Params = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * The selling screen. Turn the laptop round, they scan, they pay — the whole
 * transaction is about forty seconds and never touches a landing page.
 *
 * Face-to-face is the only channel that reliably produces a payment on a
 * 36-hour clock: three customers is roughly twenty conversations, versus
 * roughly three hundred cold visitors.
 *
 *   /pay                        → the one-off, attributed to `room`
 *   /pay?plan=pro&source=legora → the subscription, attributed differently
 */
export default async function PayPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;

  const requested = Array.isArray(params.plan) ? params.plan[0] : params.plan;
  const plan: PlanId = (PLAN_IDS as readonly string[]).includes(requested ?? "")
    ? (requested as PlanId)
    : "once";
  const source = normaliseSource(params.source, "room");

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const target = `${origin}/buy?plan=${plan}&source=${source}`;
  const unreachable = /localhost|127\.0\.0\.1/.test(origin);

  /**
   * Encoded here on the server, inline into the page as SVG. It was briefly a
   * hosted QR image and that was a bad idea: we sell in a venue, on venue
   * wifi, and a third-party image that fails to load means we cannot even show
   * the code to someone standing in front of us. Nothing outside this response
   * has to work for the QR to render.
   */
  // Name the variable that is actually missing. "Price unavailable" sends you
  // reading Vercel's env list one row at a time; this points at the row.
  // Names only, never values — this page is public.
  const unset = [
    "STRIPE_SECRET_KEY",
    plan === "once" ? "STRIPE_PRICE_ONCE" : "STRIPE_PRICE_PRO",
  ].filter((name) => !process.env[name]);

  // Concurrent: the QR is local work and the price is a Stripe round-trip, and
  // this page renders while someone waits with their phone already out.
  const [svg, price] = await Promise.all([
    QRCode.toString(target, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
    }),
    unset.length ? null : describePlan(plan).catch(() => null),
  ]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-10 p-8">
      {/* "Pricing" in the site header lands here, so a visitor who was not
          handed the laptop needs a way back out. Absolutely positioned so it
          costs the QR nothing. */}
      <Link
        href="/"
        className="absolute left-6 top-6 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
      >
        &larr; Onboarder
      </Link>

      <div className="flex flex-col items-center gap-3 text-center">
        <span className="font-mono text-sm uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
          {PRODUCT}
        </span>
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl dark:text-neutral-50">
          {PITCH}
        </h1>
        {price?.label ? (
          <p className="text-2xl font-medium tabular-nums text-neutral-900 dark:text-neutral-50">
            {price.label}
          </p>
        ) : unset.length ? (
          <p className="max-w-md text-sm text-red-600 dark:text-red-400">
            Not set in this environment:{" "}
            <code className="font-mono">{unset.join(", ")}</code>. Add it in
            Vercel → Environment Variables, then redeploy.
          </p>
        ) : (
          <p className="max-w-md text-sm text-red-600 dark:text-red-400">
            Stripe rejected the request — the key is wrong for this mode, or the
            price id belongs to a different account.
          </p>
        )}
      </div>

      {/* Always black on white regardless of theme: a dark-mode QR with a
          transparent background is the classic phone-will-not-scan-it bug. */}
      <div className="rounded-2xl bg-white p-5 shadow-lg">
        <div
          className="size-64 sm:size-80 [&>svg]:size-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Point your camera here.
        </p>
        {/* Typeable fallback — cameras fail, and a QR nobody can scan is a
            conversation that ends in an apology. */}
        <p className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
          {target.replace(/^https?:\/\//, "")}
        </p>
      </div>

      {unreachable ? (
        <p className="max-w-md text-center text-sm text-red-600 dark:text-red-400">
          This QR points at <code className="font-mono">{origin}</code>, which a
          phone cannot reach. Set{" "}
          <code className="font-mono">NEXT_PUBLIC_SITE_URL</code> to the
          production domain before selling.
        </p>
      ) : null}
    </main>
  );
}
