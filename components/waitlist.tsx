import {
  WAITLIST_BOOKING_URL,
  WAITLIST_COMPANIES,
  waitlistCountLabel,
} from "@/lib/waitlist";

/**
 * The waitlist band.
 *
 * Sits at the foot of the landing page rather than under the hero. The hero's
 * job is the demo — the thing that proves the product is real — and putting a
 * second primary action beside it makes both weaker. Someone who has read to
 * here is already convinced; this is the first moment where "what do I do
 * about it" is the reader's own question rather than ours.
 *
 * Styled as an instrument panel, not a marketing band: the same header strip,
 * hairline rules and mono label as the artefact previews elsewhere on the page,
 * so it reads as part of the product rather than an ad pasted onto it.
 *
 * No JavaScript. The count-up animation in the source widget would tick a real
 * number from 0 to itself, which is motion that says nothing.
 */
export default function Waitlist() {
  return (
    <section id="waitlist" className="border-t border-line py-14 lg:py-20">
      <div
        className="overflow-hidden rounded-xl border border-line-strong bg-surface"
        style={{ boxShadow: "var(--shadow)" }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-2/70 px-5 py-3">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
            Waitlist · onboarding slots
          </span>
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
            {waitlistCountLabel(WAITLIST_COMPANIES)}
          </span>
        </div>

        <div className="flex flex-col gap-7 px-5 py-6 sm:px-7 sm:py-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">
              Join the waitlist
            </h2>
            <p className="mt-2.5 max-w-[52ch] text-[14.5px] leading-[1.6] text-muted">
              We&rsquo;re rolling out to a limited number of fast-scaling
              companies first. Book a 20-minute call and we&rsquo;ll add your
              company to the list.
            </p>
          </div>

          <a
            href={WAITLIST_BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 shrink-0 items-center gap-2.5 self-start rounded-lg bg-ink px-6 text-[15px] font-medium text-paper transition-opacity hover:opacity-90 lg:self-auto"
          >
            Book your spot
            <span aria-hidden>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
