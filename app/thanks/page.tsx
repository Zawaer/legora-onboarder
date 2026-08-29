import Link from "next/link";
import { PRODUCT } from "@/lib/product";

/**
 * Where every payment lands, one-off and subscription alike. Nobody has an
 * account, and bouncing a stranger into a login wall one second after they
 * paid is how a customer becomes a refund.
 */
export default function ThanksPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-balance text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        Paid. Thank you — genuinely.
      </h1>
      <p className="text-pretty text-neutral-600 dark:text-neutral-400">
        A receipt is on its way from Stripe. We will email you within the day to
        book the kickoff and point {PRODUCT} at your first role.
      </p>
      {/* TODO(team): swap for the real handoff once onboarding intake exists —
          a scheduling link beats a promise in an email every time. */}
      <Link
        href="/"
        className="rounded-lg border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-50 dark:hover:bg-neutral-900"
      >
        Back to the site
      </Link>
    </main>
  );
}
