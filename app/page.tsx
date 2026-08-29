import Link from "next/link";
import SiteHeader from "@/components/site-header";
import StartDemo, { type FeedItem } from "@/components/start-demo";
import { Label, Wordmark } from "@/components/ui";
import Waitlist from "@/components/waitlist";

export const dynamic = "force-dynamic";

/**
 * Real lines from the seeded corpus, shown while the derivation runs.
 *
 * A two-minute spinner is dead air; a two-minute feed of the actual messages
 * being read is the argument. Loaded lazily so a broken seed degrades the
 * waiting state rather than the page.
 */
async function corpusFeed(): Promise<FeedItem[]> {
  try {
    const { getCompany, DEFAULT_COMPANY_SLUG } = await import("@/lib/seed");
    const company = getCompany(DEFAULT_COMPANY_SLUG);
    const artifacts = company?.artifacts ?? [];
    if (artifacts.length === 0) return [];

    // Spread across the corpus rather than taking the first N, so the feed
    // reads like a sweep of the whole company and not one channel.
    const step = Math.max(1, Math.floor(artifacts.length / 24));
    return artifacts
      .filter((_, i) => i % step === 0)
      .slice(0, 24)
      .map((a) => ({
        kind: a.kind,
        source:
          a.channel ??
          (a.title ? a.title.slice(0, 26) : a.kind),
        author: a.author,
        snippet: a.text.replace(/\s+/g, " ").trim().slice(0, 120),
      }));
  } catch {
    return [];
  }
}

export default async function Home() {
  const feed = await corpusFeed();

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-[1180px] px-5 sm:px-8 lg:px-12">
        {/* hero */}
        <section data-reveal className="grid gap-12 border-b border-line py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16 lg:py-24">
          <div data-stagger className="flex flex-col gap-7">
            <h1 className="max-w-[20ch] text-[40px] leading-[1.03] font-semibold tracking-[-0.03em] text-balance sm:text-[54px] lg:text-[62px]">
              Onboarding for the job no one has written down yet
            </h1>
            <p className="max-w-[58ch] text-[17px] leading-[1.6] text-muted sm:text-[18.5px]">
              When you hire someone into a role that doesn&rsquo;t exist yet,
              you decide what that role actually is. VANAV doesn&rsquo;t guess
              it for you. What VANAV does: it reads your company&rsquo;s Slack,
              docs and tickets, and builds onboarding for the exact role
              you&rsquo;ve already defined. The new hire gets a link with their
              name and role on it, and is doing real work within the hour, not
              reading a stale wiki.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/#waitlist"
                className="inline-flex h-12 items-center gap-2.5 rounded-lg bg-ink px-6 text-[15px] font-medium text-paper transition-opacity hover:opacity-90"
              >
                Join the waitlist
                <span aria-hidden>→</span>
              </Link>
              <StartDemo feed={feed} secondary />
            </div>
          </div>

          {/* The visualiser. Plays the argument rather than describing it:
              a real quote out of the corpus lands, the agent says it is
              reading, and then the plan writes itself a line at a time.
              Someone who watches one loop and reads nothing has still seen
              what this does.

              CSS-only and infinite. It is the first thing on the page, so it
              must not wait on a script, and an infinite loop has no end state
              to get stuck in. Everything is legible with the animation off;
              only the "deriving" line hides, because it describes work that
              is not happening. */}
          <aside data-reveal="right" data-parallax className="viz lg:pt-2">
            <div
              className="viz-card overflow-hidden rounded-xl border border-line bg-surface"
              style={{ boxShadow: "var(--shadow)" }}
            >
              <div className="flex items-center gap-2 border-b border-line bg-surface-2/70 px-4 py-2.5">
                <span className="h-2 w-2 rounded-full bg-line-strong" />
                <span className="h-2 w-2 rounded-full bg-line-strong" />
                <span className="h-2 w-2 rounded-full bg-line-strong" />
                <span className="ml-2 truncate font-mono text-[11px] text-faint">
                  derived-role · legal-engineer
                </span>
              </div>

              <div className="flex flex-col gap-4 px-5 py-5">
                <div data-viz="evidence">
                  <Label>Evidence</Label>
                  <blockquote className="mt-2.5 border-l-2 border-accent pl-3.5 text-[14.5px] leading-[1.55] font-medium">
                    &ldquo;the person starting sept 1 is ex-M&amp;A, 6 years,
                    london… no coding at all… what i genuinely dont have is
                    anything to hand them on day one&rdquo;
                  </blockquote>
                  <p className="mt-2.5 font-mono text-[11.5px] text-accent-ink">
                    #legal-eng · Elin Sandberg · 27 Aug
                  </p>
                </div>

                {/* Absolutely positioned so its exit does not move the card:
                    a panel that changes height every eleven seconds is the
                    thing you notice instead of the content. */}
                <div className="relative min-h-[18px]">
                  <p
                    data-viz="status"
                    className="absolute inset-0 flex items-center gap-2 font-mono text-[11.5px] text-faint"
                  >
                    <span
                      data-viz="dot"
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    />
                    deriving role from Slack, docs, tickets…
                  </p>
                </div>

                <div data-viz="output" className="border-t border-line pt-4">
                  <div data-viz="l1">
                    <Label>Day 1 · first task</Label>
                  </div>
                  <p
                    data-viz="l2"
                    className="mt-2 text-[14.5px] leading-snug font-medium"
                  >
                    Write the list of every place we are wrong on three Nordkap
                    SPAs
                  </p>
                  <p
                    data-viz="l3"
                    className="mt-2 border-l-2 border-ok/50 pl-3 text-[13px] leading-[1.55] text-muted"
                  >
                    <span className="text-ink">Done when</span> a doc exists in
                    the Legal Engineering space with one numbered row per
                    divergence, each citing the clause it came from.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* how questions get handled. The waitlist band below brings its own
            top rule, so this section drops its bottom one. */}
        <section data-reveal className="py-14 lg:py-20">
          <h2 className="max-w-[20ch] text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[38px]">
            How questions get handled
          </h2>
          <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.65] text-muted">
            Questions get answered on the spot: company-specific ones with a
            source message, general ones with a web search. If no answer exists,
            the question goes straight to the right person, without interrupting
            a colleague on a guess. And every answer is saved, so the tenth
            person to onboard won&rsquo;t ask anything the first nine
            didn&rsquo;t already get answered.
          </p>
        </section>

        <div className="border-b border-line">
          <Waitlist />
        </div>

        <section data-reveal className="py-14 lg:py-20">
          <p className="max-w-[62ch] text-[15px] leading-[1.65] text-muted">
            No productivity scoring, no made-up answers. Every answer points to
            its source or says it couldn&rsquo;t find one.
          </p>
        </section>
      </main>

      <footer className="border-t border-line bg-surface-2/40">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:px-8 lg:px-12">
          <Wordmark muted />
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] sm:ml-auto">
            <Link href="/#waitlist" className="text-muted hover:text-ink">
              Join the waitlist
            </Link>
            <Link href="/manager" className="text-muted hover:text-ink">
              Manager view
            </Link>
            {/* The evidence board. It is the page that has to be findable
                without being told about it: a claim nobody can reach is
                indistinguishable from one we did not make. */}
            <Link href="/loi" className="text-muted hover:text-ink">
              Letter of intent
            </Link>
            <Link href="/pricing" className="text-muted hover:text-ink">
              Pricing
            </Link>
            <Link href="/privacy" className="text-muted hover:text-ink">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
