import SiteHeader from "@/components/site-header";
import { LoiForm } from "@/components/loi-form";
import { normaliseSource } from "@/lib/source";
import { PRODUCT } from "@/lib/product";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Letter of intent · ${PRODUCT}`,
  description:
    "A one-minute statement of intent: what you would use it for, and the one thing that has to be true first. Not a binding contract.",
};

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
    // The site header is the way back — this page used to carry its own
    // one-line "← VANAV" link because it had no header at all, and two home
    // links stacked twenty pixels apart read as an unfinished page rather than
    // a considerate one.
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 py-14 sm:py-20">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Would you put this in front of your next cohort?
          </h1>
          <p className="text-pretty text-muted">
            If you would pay for {PRODUCT} but not today, say so here. It takes a
            minute, and the “…once” line tells us exactly what to build next.
          </p>
        </div>

        <LoiForm product={PRODUCT} source={source} />
      </main>
    </div>
  );
}
