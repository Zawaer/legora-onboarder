import Link from "next/link";
import { LoiForm } from "@/components/loi-form";
import { normaliseSource } from "@/lib/source";
import { PRODUCT } from "@/lib/product";

export const dynamic = "force-dynamic";

type Params = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Hand them the phone on this page. Fill in their details yourself if it is
 * quicker — every extra step loses people, and the window is about ninety
 * seconds wide, starting the moment they say something positive.
 *
 * The instant they press Sign, the form swaps to the signed statement with a
 * server timestamp on it: screenshot that immediately, before the phone goes
 * back. That screenshot is the proof artefact for the submission form.
 */
export default async function LoiPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const source = normaliseSource(params.source, "room");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-8 px-6 py-16">
      {/* Linked from the site header, so it needs a way back. Kept to one line:
          the phone is usually in someone else's hand on this screen. */}
      <Link
        href="/"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
      >
        &larr; Onboarder
      </Link>

      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Would you put this in front of your next cohort?
        </h1>
        <p className="text-pretty text-neutral-600 dark:text-neutral-400">
          If you would pay for {PRODUCT} but not today, say so here. It takes a
          minute, and the “…once” line tells us exactly what to build next.
        </p>
      </div>

      <LoiForm product={PRODUCT} source={source} />
    </main>
  );
}
