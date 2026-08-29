import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import JdDiff from "@/components/jd-diff";
import { Label } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Job description vs. the traces · VANAV",
  description:
    "Paste a job description. VANAV breaks it into claims and shows you, with verified quotes from your own Slack, docs and tickets, which ones the traces support, which ones they contradict, and which ones they say nothing about at all.",
};

/**
 * The falsifiable page.
 *
 * Everywhere else in this product the agent tells you something you have to
 * take on trust — here is what the role is, here is what to do on Monday. This
 * page tells you something you can check in four seconds by opening Slack, and
 * that is a deliberately different and stronger claim. It also does the one
 * thing an enterprise search box structurally cannot: the finding is the gap
 * between what is written and what is happening, and a gap is not a document,
 * so there is nothing to retrieve.
 *
 * The three columns of copy below are load-bearing rather than decorative. The
 * silent verdict is the one a reader will otherwise take as a failure, and if
 * they do, the honest denominator stops being honest — a tool that only reports
 * hits is a tool that will find hits.
 */
const VERDICTS = [
  {
    k: "Contradicted",
    tone: "warn" as const,
    d: "Your own material shows something incompatible with the line as written, someone with standing saying the opposite, a thing the line assumes exists that visibly does not, or a question the posting settles that your team is still openly arguing about. Always quoted, always attributed.",
  },
  {
    k: "Silent",
    tone: "muted" as const,
    d: "Nothing in the corpus touches it. This is a result, not a miss: either the work is not happening, or it happens somewhere we cannot see. We say which rooms we were looking in so you can tell the difference yourself.",
  },
  {
    k: "Supported",
    tone: "ok" as const,
    d: "The corpus shows it happening, specifically, in a passage we can point at. The least interesting third of the page, which is why it is at the bottom.",
  },
];

export default function JdPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto flex max-w-[1000px] flex-col gap-10 px-5 py-12 sm:px-8 sm:py-16">
        <header className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-warn" />
              Checkable, not persuasive
            </span>
            <Link href="/ingest" className="text-[12px] text-faint hover:text-muted">
              or point it at your own corpus first
            </Link>
          </div>

          <h1 className="max-w-[24ch] text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-[44px]">
            Your job description, checked against what actually happened.
          </h1>

          <p className="max-w-[64ch] text-[16px] leading-[1.6] text-muted sm:text-[17px]">
            Paste the posting. We break it into claims and, for each one, show
            you what your team&rsquo;s own Slack, docs, tickets and meeting notes
            say, including where they say something else, and including, out
            loud, where they say nothing at all.
          </p>

          <p className="max-w-[64ch] text-[13.5px] leading-[1.65] text-faint">
            We do not tell you what your role is. Every verdict that is not
            &ldquo;silent&rdquo; carries a sentence a real person really wrote,
            verified character by character against the artifact it came from, 
            if the quote is not there, the verdict is deleted rather than
            softened. You can check any line on this page by opening Slack.
          </p>
        </header>

        <JdDiff companySlug="lexhav" />

        <section className="flex flex-col gap-4 border-t border-line pt-8">
          <Label>The three verdicts</Label>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-3">
            {VERDICTS.map((v) => (
              <div key={v.k} className="flex flex-col gap-1.5">
                <dt className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      v.tone === "warn"
                        ? "bg-warn"
                        : v.tone === "ok"
                          ? "bg-ok"
                          : "bg-line-strong"
                    }`}
                  />
                  {v.k}
                </dt>
                <dd className="text-[12.5px] leading-[1.6] text-muted">{v.d}</dd>
              </div>
            ))}
          </dl>

          <p className="max-w-[86ch] text-[12.5px] leading-[1.6] text-faint">
            The claims are extracted by a call that has never seen your corpus,
            so the denominator is not picked to flatter the numerator; each
            quoted line is then verified as really being in the document you
            pasted. A verdict biased toward silent is the point, a false
            contradiction tells a hiring manager their own posting is at odds
            with their own team on evidence that will not survive being looked
            at, and the first one of those takes every true verdict next to it
            down with it. The corpus behind the demo is realistic and synthetic;
            it is not Lexhav&rsquo;s real Slack, and we have never had access to
            it.
          </p>
        </section>
      </main>
    </div>
  );
}
