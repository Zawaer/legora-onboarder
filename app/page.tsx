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
    k: "Monday, 9am",
    d: "They open one link. Their name, their role, and what the job actually is here, worked out from what the team has been writing to each other. Nobody had to write it down first.",
  },
  {
    k: "The first hour",
    d: "Real work, not a reading list. A live task with a real deadline: why it matters, what finished looks like, and the context to do it without interrupting anyone.",
  },
  {
    k: "All week",
    // "Asking takes nerve" is a partner at a Nordic law firm's framing, given
    // unprompted when we asked what makes a new hire's first weeks hard. He
    // listed being "appropriately brave and fearless" as one of the three things
    // that decide whether someone gets going at all. It is a better description
    // of the problem than "they can ask as often as they like" because it names
    // the cost being removed rather than the quantity being permitted.
    d: "Asking a colleague takes nerve. Asking this doesn't, so they ask the fortieth question as easily as the first, and get answers out of the company's own messages. When nobody has written the answer down, it says so instead of inventing one.",
  },
  {
    k: "Before it costs anything",
    d: "If they are about to do something the team already decided against, it says so unprompted, and shows them the message where it was decided, by name and date.",
  },
];

/**
 * The three ways a question ends, in the order the agent tries them.
 * `lib/web/contract.ts` is the argument; this is the same table in public words.
 */
const ROUTES = [
  {
    k: "It is in the messages",
    d: "The message itself, quoted verbatim, with the person and the date.",
    out: "nobody interrupted",
  },
  {
    k: "Not there, and not about you",
    d: "\u201cWhat\u2019s the difference between git rebase and merge?\u201d Answered from the web with its sources, in a box that cannot be mistaken for something a colleague said.",
    out: "nobody interrupted",
  },
  {
    k: "Not there, and about you",
    d: "\u201cWhy do retries live in the consumer?\u201d That one goes to a named person.",
    out: "one person, once",
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

      <main className="mx-auto max-w-[1180px] px-5 sm:px-8 lg:px-12">
        {/* ── hero ── */}
        <section data-reveal className="grid gap-12 border-b border-line py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16 lg:py-24">
          <div className="flex flex-col gap-7">
            <h1 className="max-w-[20ch] text-[40px] leading-[1.03] font-semibold tracking-[-0.03em] text-balance sm:text-[54px] lg:text-[62px]">
              Your senior people are the onboarding plan. That&rsquo;s what it
              costs.
            </h1>
            <p className="max-w-[58ch] text-[17px] leading-[1.6] text-muted sm:text-[18.5px]">
              VANAV reads your Slack, docs and tickets, builds the onboarding
              plan that doesn&rsquo;t exist yet, and runs the new hire through
              their first two real days of work, answering from your own
              material instead of from the person next to them.
            </p>

            {/* Waitlist first: it is the conversion action now that there is
                no checkout, and it is the one thing a convinced reader can do.
                The demo sits beside it as the secondary — still one click, but
                it no longer competes with the ask. */}
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
              <Link href="/pricing" className="text-muted hover:text-ink">
                Pricing
              </Link>
            </div>
          </div>

          {/* the artefact preview — sets expectations for what the CTA produces */}
          {/* The visualiser. Plays the argument rather than describing it:
              a real quote out of the corpus lands, the agent says it is
              reading, and then the plan writes itself a line at a time.
              Someone who watches one loop and reads nothing has still seen
              what this does.

              CSS-only and infinite — it is the first thing on the page, so it
              must not wait on a script, and an infinite loop has no end state
              to get stuck in. Everything is legible with the animation off;
              only the "deriving" line hides, because it describes work that
              is not happening. */}
          <aside className="viz lg:pt-2">
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

        {/* ── the three facts ── */}
        <section data-reveal className="border-b border-line py-14 lg:py-20">
          <Label>Why this happens</Label>
          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-3">
            {BEATS.map((b) => (
              <article key={b.n} className="flex flex-col gap-4 bg-surface p-6 lg:p-8">
                <span className="tnum font-mono text-[13px] text-faint">
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
        <section data-reveal className="border-b border-line py-14 lg:py-20">
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
                  So the onboarding has to work the role out itself, from the
                  evidence the company has already produced, then run the first
                  two days of real work and interrupt a human only when it truly
                  cannot proceed.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── how it works ── */}
        <section data-reveal className="band band-ink">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8 lg:px-12 py-14 lg:py-20">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <Label>What their first days look like</Label>
              <span className="text-[12.5px] text-faint">
                their manager is interrupted once, not thirty times
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
          </div>
        </section>

        {/* ── the ask ──
            Moved out of the last slot before the footer. This is the first
            point on the page where somebody knows what the thing is, and a
            reader who is convinced here should not have to scroll four more
            sections to act on it. The band brings its own top rule, so the
            section above it drops its bottom one. ── */}
        <div className="border-b border-line">
          <Waitlist />
        </div>

        {/* ── the unprompted correction ──
            Step 4 of the four-step block mentions this in one line. It is the
            single behaviour that separates the product from a chatbot, it is
            where the originality points live, and it is the beat that lands in
            a demo — so it gets shown rather than claimed, with the real quote
            from the seeded corpus. ── */}
        <section data-reveal className="border-b border-line py-14 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
            <div className="flex flex-col gap-5">
              <Label>Nobody asked it to check</Label>
              <h2 className="max-w-[18ch] text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[38px]">
                It stops them before it costs two weeks.
              </h2>
              <p className="max-w-[46ch] text-[15px] leading-[1.65] text-muted">
                A manager normally catches a confident wrong turn by reviewing
                the work. That holds at six reports. It does not hold at sixty,
                and the correction arrives from a customer instead.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
                <div className="label mb-2.5">The new hire, day one</div>
                <p className="text-[15px] leading-[1.6] text-ink">
                  &ldquo;I&rsquo;m going to fix the Italian miss by adding
                  <em> cessione del contratto</em> and a few other synonyms to
                  the playbook keyword list.&rdquo;
                </p>
              </div>

              <div className="rounded-xl border border-accent/25 bg-accent-soft p-5 sm:p-6">
                <div className="label mb-2.5 !text-accent-ink">
                  Unprompted, three seconds later
                </div>
                <p className="text-[15px] leading-[1.6] text-ink">
                  Marta wrote this in{" "}
                  <span className="font-mono text-[13.5px]">
                    #customer-escalations
                  </span>{" "}
                  on 19 Aug:
                </p>
                <blockquote className="mt-3 border-l-2 border-accent/45 pl-4 text-[15px] leading-[1.55] text-ink">
                  &ldquo;NOT shipping: a keyword list. If anyone adds
                  &lsquo;cessione&rsquo; to a keyword list I will find
                  you.&rdquo;
                </blockquote>
                <p className="mt-3 text-[13.5px] leading-[1.6] text-muted">
                  They didn&rsquo;t ask a question. They stated a plan, and the
                  agent volunteered the decision that already ruled it out —
                  with the date and the person.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── the web rung ──
            The rung between "the messages cannot answer this" and "interrupt a
            human". Expert attention is the one input this product can actually
            run out of, so the question of which questions are allowed to spend
            it is the design decision, not a detail. `lib/web/contract.ts`. ── */}
        <section data-reveal className="border-b border-line py-14 lg:py-20">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Label>Which questions are allowed to cost a person</Label>
            <span className="text-[12.5px] text-faint">
              a general question never reaches a colleague
            </span>
          </div>

          <h2 className="mt-6 max-w-[20ch] text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[38px]">
            Nobody is interrupted for a git question.
          </h2>
          <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.65] text-muted">
            Expert attention is the thing that runs out. So when the
            company&rsquo;s own messages cannot answer, the agent first works
            out whether the question is even about this company.
          </p>

          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-3">
            {ROUTES.map((r, i) => (
              <article key={r.k} className="flex flex-col gap-3 bg-surface p-6">
                <span className="tnum font-mono text-[11px] text-faint">
                  0{i + 1}
                </span>
                <h3 className="text-[15px] leading-[1.3] font-semibold tracking-[-0.01em]">
                  {r.k}
                </h3>
                <p className="text-[13.5px] leading-[1.6] text-muted">{r.d}</p>
                <span className="mt-auto pt-1 font-mono text-[11.5px] text-accent-ink">
                  {r.out}
                </span>
              </article>
            ))}
          </div>

          <p className="mt-7 max-w-[62ch] text-[15.5px] leading-[1.65] text-muted">
            It has to be{" "}
            <span className="font-medium text-ink">
              75% sure a question is general
            </span>{" "}
            before it may skip the human; under that it asks anyway. A confident
            wrong answer about how your company works is unrecoverable. A
            wrongly forwarded git question costs five minutes.
          </p>
        </section>

        {/* ── what compounds ──
            The only selling point that is about money rather than experience,
            and it was missing from the site entirely. Argued structurally with
            a ledger rather than with an invented statistic — every "cost of a
            bad hire" figure in this market traces back to vendor marketing. ── */}
        <section data-reveal className="band band-sand">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8 lg:px-12 py-14 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
              <div className="flex flex-col gap-5">
                <Label>What compounds</Label>
                <h2 className="max-w-[20ch] text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[38px]">
                  The tenth hire asks nothing the first nine already answered.
                </h2>
                <p className="max-w-[46ch] text-[15px] leading-[1.65] text-muted">
                  When the answer genuinely isn&rsquo;t written down, the agent
                  asks the one person who would know, once, and writes the
                  confirmed answer back into the company&rsquo;s own record,
                  attributed and dated. Everyone who hits the same gap afterwards
                  gets it from there.
                </p>
              </div>

              <div className="flex flex-col self-start divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {[
                  {
                    who: "1st hire",
                    what: "Hits a gap nobody wrote down. The agent asks the person who knows.",
                    cost: "~60 seconds of theirs",
                    first: true,
                  },
                  {
                    who: "2nd hire",
                    what: "Same question. Answered from the record, attribution intact.",
                    cost: "nobody interrupted",
                  },
                  {
                    who: "3rd hire",
                    what: "Same question.",
                    cost: "nobody interrupted",
                  },
                ].map((r) => (
                  <div
                    key={r.who}
                    className="grid grid-cols-[74px_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 bg-surface px-5 py-3.5 sm:grid-cols-[84px_minmax(0,1fr)_auto]"
                  >
                    <span className="font-mono text-[11px] tracking-wide text-faint uppercase">
                      {r.who}
                    </span>
                    <span
                      className={`text-[14px] leading-[1.55] ${
                        r.first ? "text-ink" : "text-muted"
                      }`}
                    >
                      {r.what}
                    </span>
                    <span
                      className={`col-start-2 font-mono text-[11.5px] whitespace-nowrap sm:col-start-3 sm:text-right ${
                        r.first ? "text-accent-ink" : "text-faint"
                      }`}
                    >
                      {r.cost}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-7 max-w-[62ch] text-[15.5px] leading-[1.65] text-muted">
              Your senior people are interrupted{" "}
              <span className="font-medium text-ink">
                once per unknown, not once per hire
              </span>
              . With three people starting the same month that is one question
              instead of three; at thirty it is the difference between a tool and
              a second job.
            </p>
          </div>
        </section>

        {/* ── two starters at once ──
            Coordination through shared state, described as exactly that and no
            more: the second planner reads the first one's plan before it
            writes. The sentence in the card is generated output from the live
            fixtures, not copy. `lib/agent/cohort.ts`. ── */}
        <section data-reveal className="border-b border-line py-14 lg:py-20">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Label>When two people start the same week</Label>
            <span className="text-[12.5px] text-faint">
              otherwise both are handed the same ticket
            </span>
          </div>

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
            <div className="flex flex-col gap-5">
              <h2 className="max-w-[18ch] text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[38px]">
                The second plan is written around the first.
              </h2>
              <p className="max-w-[46ch] text-[15px] leading-[1.65] text-muted">
                Two planners read the same messages and both land on the same
                unglamorous, high-value ticket. So the second one reads what the
                first already wrote down, and where the scope genuinely runs
                alongside, it says so in the task itself, by name.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-accent/25 bg-accent-soft p-5 sm:p-6">
                <div className="label mb-2.5 !text-accent-ink">
                  Generated into Hannah&rsquo;s own task
                </div>
                <p className="text-[15px] leading-[1.6] text-ink">
                  &ldquo;Rebecca Hartley is delivering a
                  ma.spa.change-of-control label batch back to Priya this week
                  — that set is hers; you are on dd.assignment, so check with
                  her before either of you touches ma.spa.* labels.&rdquo;
                </p>
              </div>
              <p className="text-[13.5px] leading-[1.6] text-muted">
                Rebecca and Hannah started the same week. Nothing was negotiated
                between the two planners: the second one read the first
                one&rsquo;s plan before writing, the way you read a whiteboard
                before adding to it. Both people have already read the sentence
                their manager sees.
              </p>
              <Link
                href="/manager"
                className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent-ink underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
              >
                Where two ramps touch, on the manager screen
                <span aria-hidden>&rarr;</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ── what it cannot see ──
            Added after the sharpest outside critique we got: a role inferred
            from Slack is ambiguous, because much of what a job actually is
            gets said face to face. That is true, and the product already
            answers it: the coverage panel states what was missing before it
            states anything else. The answer existed and the page never made
            it, which meant the objection landed unopposed. ── */}
        <section data-reveal className="border-b border-line py-14 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <div className="flex flex-col gap-5">
              <Label>What it cannot see</Label>
              <h2 className="max-w-[18ch] text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[38px]">
                Half of any job is never written down.
              </h2>
              <p className="max-w-[46ch] text-[15px] leading-[1.65] text-muted">
                It reads Slack, documents, tickets and meeting notes. It does
                not read the corridor, the call, or the thing your best engineer
                only ever says out loud. So before it tells you anything, it
                tells you what it read and what it never saw.
              </p>
              <p className="max-w-[46ch] text-[15px] leading-[1.65] text-muted">
                The bar is not knowing the job perfectly. Nobody does on day
                one. The bar is beating a blank page, which is what a new hire
                gets today.
              </p>
            </div>

            <div
              className="self-start overflow-hidden rounded-xl border border-line-strong bg-surface"
              style={{ boxShadow: "var(--shadow)" }}
            >
              <div className="flex items-center gap-2 border-b border-line bg-surface-2/70 px-5 py-3">
                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                  Shown before the role, not after
                </span>
              </div>
              <div className="flex flex-col divide-y divide-line">
                <p className="px-5 py-3.5 text-[14px] leading-[1.55]">
                  <span className="font-medium">Read.</span>{" "}
                  <span className="text-muted">
                    63 messages, 14 people, 22 days.
                  </span>
                </p>
                <p className="px-5 py-3.5 text-[14px] leading-[1.55]">
                  <span className="font-medium">Not read.</span>{" "}
                  <span className="text-muted">No DMs. No meetings. No calls.</span>
                </p>
                <p className="px-5 py-3.5 text-[13px] leading-[1.6] text-muted">
                  A manager who can see the gap fills it in one sentence. One
                  who cannot is being guessed at.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── what it refuses to do ── */}
        <section data-reveal className="py-14 lg:py-20">
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
                without being told about it — a claim nobody can reach is
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
