import Link from "next/link";
import SiteHeader from "@/components/site-header";
import StartDemo, { type FeedItem } from "@/components/start-demo";
import { Label, Wordmark } from "@/components/ui";

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

const BEATS = [
  {
    n: "01",
    stat: "700 → 1,500",
    statNote: "people this year",
    head: "Hiring outruns documentation.",
    body: "The handbook describes a company a third the size, and the people who could update it are the ones shipping the product.",
  },
  {
    n: "02",
    stat: "0",
    statNote: "playbooks that exist",
    head: "The role has never existed.",
    body: "“Legal Engineer” was invented a week before the req opened. Nobody has written it down, because nobody has done it yet.",
  },
  {
    n: "03",
    stat: "Day 1",
    statNote: "independent, or not at all",
    head: "Nobody has time to supervise.",
    body: "Everyone senior enough to onboard this hire is the reason the company is growing.",
  },
];

const STEPS = [
  {
    k: "Ingest",
    d: "Reads the company's actual Slack, docs and tickets. It is never given a job description, because at a company inventing roles as it hires for them, none exists.",
  },
  {
    k: "Derive",
    d: "Reconstructs what the role really is, out of verbatim quotes it has verified against the source — each with its channel, its author and the date it was written.",
  },
  {
    k: "Ramp",
    d: "Writes two days of real work: why each task matters here, the context to do it unsupervised, what done looks like, and who to ask.",
  },
  {
    k: "Escalate",
    d: "Answers from company context all day. Raises a human only when it genuinely cannot proceed — with who to ask and an honest minutes-to-unblock.",
  },
];

const REFUSALS = [
  {
    h: "No productivity score.",
    d: "The manager screen shows blockers and nothing else. A surveillance dashboard gets killed by the culture it is sold into.",
  },
  {
    h: "No invented answers.",
    d: "What the company hasn't decided is shown as undecided. Confident filler is the failure a hiring manager catches in ten seconds.",
  },
  {
    h: "No unsourced quotes.",
    d: "Every quote is checked as a literal substring of the message it cites, and the ones that are not there are dropped rather than shown. The reading is the agent's; the evidence under it is the company's own, and you can open it and check.",
  },
];

export default async function Home() {
  const feed = await corpusFeed();

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-[1400px] px-5 sm:px-8">
        {/* ── hero ── */}
        <section className="grid gap-12 border-b border-line py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16 lg:py-24">
          <div className="flex flex-col gap-7">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                Live demo · Legora, Stockholm
              </span>
              <span className="text-[12px] text-faint">
                ~100 new starts a month
              </span>
            </div>

            <h1 className="max-w-[19ch] text-[40px] leading-[1.03] font-semibold tracking-[-0.03em] text-balance sm:text-[54px] lg:text-[62px]">
              Onboarding for a job that has never existed.
            </h1>

            <p className="max-w-[58ch] text-[17px] leading-[1.6] text-muted sm:text-[18.5px]">
              It reads a company&rsquo;s real Slack, docs and tickets, works out
              what a brand-new role actually is, and drives the new hire through
              their first two days of real work.
            </p>

            <StartDemo feed={feed} />

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
              <Link
                href="/manager"
                className="inline-flex items-center gap-1.5 font-medium text-accent-ink underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
              >
                See what the manager sees
                <span aria-hidden>→</span>
              </Link>
              <span className="hidden h-3 w-px bg-line sm:block" />
              <Link href="/loi" className="text-muted hover:text-ink">
                Sign a letter of intent
              </Link>
              <Link href="/pay" className="text-muted hover:text-ink">
                Pricing
              </Link>
            </div>
          </div>

          {/* the artefact preview — sets expectations for what the CTA produces */}
          <aside className="lg:pt-2">
            <div
              className="overflow-hidden rounded-xl border border-line bg-surface"
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
                <div>
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
                <div className="border-t border-line pt-4">
                  <Label>Day 1 · first task</Label>
                  <p className="mt-2 text-[14.5px] leading-snug font-medium">
                    Write the list of every place we are wrong on three Nordkap
                    SPAs
                  </p>
                  <p className="mt-2 border-l-2 border-ok/50 pl-3 text-[13px] leading-[1.55] text-muted">
                    <span className="text-ink">Done when</span> a doc exists in
                    the Legal Engineering space with one numbered row per
                    divergence, each citing the clause it came from.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* ── the three facts ── */}
        <section className="border-b border-line py-14 lg:py-20">
          <Label>Why this happens</Label>
          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-3">
            {BEATS.map((b) => (
              <article key={b.n} className="flex flex-col gap-4 bg-surface p-6 lg:p-8">
                <span className="tnum font-mono text-[11px] text-faint">
                  {b.n}
                </span>
                <div>
                  <div className="tnum text-[30px] leading-none font-semibold tracking-[-0.03em]">
                    {b.stat}
                  </div>
                  <div className="mt-1.5 text-[12px] text-faint">
                    {b.statNote}
                  </div>
                </div>
                <h2 className="text-[18px] leading-[1.25] font-semibold tracking-[-0.015em] text-balance">
                  {b.head}
                </h2>
                <p className="text-[14px] leading-[1.62] text-muted">{b.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── the conclusion ── */}
        <section className="border-b border-line py-14 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <div className="flex flex-col gap-5">
              <Label>So what&rsquo;s left</Label>
              <h2 className="max-w-[16ch] text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[38px]">
                Two obvious fixes. Neither one works.
              </h2>
              <p className="max-w-[46ch] text-[15px] leading-[1.65] text-muted">
                Every company in this position tries both, in this order, and
                then quietly gives up and lets new hires figure it out.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-line bg-surface p-6">
                <div className="flex items-baseline gap-3">
                  <span className="text-[15px] font-semibold">
                    Documentation can&rsquo;t fix it.
                  </span>
                </div>
                <p className="mt-2.5 text-[14px] leading-[1.62] text-muted">
                  A handbook is stale the day it merges. At this pace it is
                  stale <em>before</em> it merges, and the roles it would need to
                  describe are invented faster than anyone can write them down.
                </p>
              </div>

              <div className="rounded-xl border border-line bg-surface p-6">
                <div className="flex items-baseline gap-3">
                  <span className="text-[15px] font-semibold">
                    A human can&rsquo;t fix it.
                  </span>
                </div>
                <p className="mt-2.5 text-[14px] leading-[1.62] text-muted">
                  The only people who know how the role works are the bottleneck
                  that made the role necessary. Every hour they spend onboarding
                  is an hour of the thing you hired them to do.
                </p>
              </div>

              <div className="rounded-xl border border-accent/25 bg-accent-soft p-6">
                <div className="flex items-center gap-2.5">
                  <Wordmark />
                </div>
                <p className="mt-2.5 text-[15px] leading-[1.6] text-ink">
                  So the onboarding has to derive the role itself — from the
                  evidence the company has already produced — run the first two
                  days of real work, and interrupt a human only when it truly
                  cannot proceed.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── how it works ── */}
        <section className="border-b border-line py-14 lg:py-20">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Label>How it works</Label>
            <span className="text-[12.5px] text-faint">
              four steps, no human in the loop until step four
            </span>
          </div>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.k} className="flex flex-col gap-3 bg-surface p-6">
                <span className="tnum font-mono text-[11px] text-faint">
                  0{i + 1}
                </span>
                <h3 className="text-[16px] font-semibold tracking-[-0.01em]">
                  {s.k}
                </h3>
                <p className="text-[13.5px] leading-[1.6] text-muted">{s.d}</p>
              </li>
            ))}
          </ol>

          {/* The two entry points that used to be two-word labels in the
              header. A stranger cannot decode "Your own data" or "JD check";
              they can decode a sentence about what happens when they click.
              These are the only inbound links to /ingest and /jd, so they are
              in the body rather than the footer. */}
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[13.5px]">
            <Link
              href="/ingest"
              className="inline-flex items-center gap-1.5 font-medium text-accent-ink underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
            >
              Run it on your own Slack
              <span aria-hidden>&rarr;</span>
            </Link>
            <span className="hidden h-3 w-px bg-line sm:block" />
            <Link
              href="/jd"
              className="inline-flex items-center gap-1.5 text-muted hover:text-ink"
            >
              Check a job ad against your team&rsquo;s messages
              <span aria-hidden>&rarr;</span>
            </Link>
          </div>
        </section>

        {/* ── what it refuses to do ── */}
        <section className="py-14 lg:py-20">
          <Label>What it deliberately refuses to do</Label>
          <div className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
            {REFUSALS.map((r) => (
              <div key={r.h} className="flex gap-3.5">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className="mt-1 h-4 w-4 shrink-0 text-muted"
                  aria-hidden
                >
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
                  <path
                    d="M5.4 5.4 10.6 10.6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <div>
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
                    {r.h}
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">
                    {r.d}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface-2/40">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:px-8">
          <Wordmark muted />
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] sm:ml-auto">
            <Link href="/manager" className="text-muted hover:text-ink">
              Manager view
            </Link>
            {/* The evidence board. It is the page that has to be findable
                without being told about it — a claim nobody can reach is
                indistinguishable from one we did not make. */}
            <Link href="/pitch" className="text-muted hover:text-ink">
              Traction
            </Link>
            <Link href="/loi" className="text-muted hover:text-ink">
              Letter of intent
            </Link>
            <Link href="/pay" className="text-muted hover:text-ink">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
