import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import IngestForm from "@/components/ingest-form";
import { Label } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your own data · VANAV",
  description:
    "Point VANAV at your own Slack, docs or tickets. It parses the corpus, shows you exactly what it understood, and only then derives the role.",
};

/**
 * The page that makes this a product rather than a demo.
 *
 * Everything else in the app runs on a corpus we wrote and can therefore
 * guarantee. This one runs on a corpus a stranger hands us thirty seconds
 * before a call, which is why the copy below leads with what we accept and
 * what we cap — the failure this page exists to avoid is someone concluding
 * "it doesn't work on our data" when what actually happened was a silent
 * parse failure.
 */
const FORMATS = [
  {
    k: "Slack export",
    d: "The real JSON: an array of message objects with user / user_profile.real_name, text and a unix ts. The { \"messages\": [...] } wrapper and per-channel files both work.",
  },
  {
    k: "Pasted log",
    d: "Select a channel, copy, paste. #channel  Name  10:32  message, or Name: message, or [10:32] Name: message — mixed together is fine.",
  },
  {
    k: "CSV",
    d: "A header row, then rows. Columns named author / user / name, text / message / body, date / ts / timestamp, and channel are picked up automatically.",
  },
];

export default function IngestPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto flex max-w-[1000px] flex-col gap-10 px-5 py-12 sm:px-8 sm:py-16">
        <header className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Bring your own corpus
            </span>
            <Link href="/" className="text-[12px] text-faint hover:text-muted">
              or watch it on the Lexhav corpus first
            </Link>
          </div>

          <h1 className="max-w-[20ch] text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-[44px]">
            Run it on your company, not ours.
          </h1>

          <p className="max-w-[62ch] text-[16px] leading-[1.6] text-muted sm:text-[17px]">
            Drop in a Slack export, a CSV, or a few hundred lines pasted straight
            out of a channel. VANAV reads it into the same shape the demo
            uses, shows you what it understood, and waits for you to say go before
            it derives anything.
          </p>
        </header>

        <IngestForm />

        <section className="flex flex-col gap-4 border-t border-line pt-8">
          <Label>What it accepts</Label>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-3">
            {FORMATS.map((format) => (
              <div key={format.k} className="flex flex-col gap-1.5">
                <dt className="text-[13.5px] font-medium text-ink">{format.k}</dt>
                <dd className="text-[12.5px] leading-[1.6] text-muted">{format.d}</dd>
              </div>
            ))}
          </dl>

          <p className="max-w-[80ch] text-[12.5px] leading-[1.6] text-faint">
            Join and leave events, bot bookkeeping and duplicate messages are
            dropped. Anything the parser cannot read is reported as a warning
            rather than an error — a partial corpus you were told about is more
            useful than a failed upload. The corpus is capped at 1,500 messages
            or 200,000 characters: the whole thing goes to the model in one
            prompt, with no retrieval step, so size is literally cost. Over the
            cap we keep the most recent slice and say so.
          </p>
        </section>
      </main>
    </div>
  );
}
