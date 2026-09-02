import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { Label } from "@/components/ui";
import { PRODUCT } from "@/lib/product";

export const metadata = {
  title: `Privacy · ${PRODUCT}`,
  description:
    "What we collect from visitors, what we hold for customers, where it is processed, and how to have it deleted.",
};

/**
 * A privacy notice covering two different things, which is why it is longer
 * than it was.
 *
 * It started as a notice about a waitlist email address. That is still here,
 * but it is now the smaller half: customers hand us their company's content,
 * and a page that only discussed visitor emails would be silent about the data
 * that actually matters. docs/data-processing.md is the long form we send to a
 * security reviewer; this is the public version of the same facts.
 *
 * The rule the original set is worth keeping: every sentence should be
 * checkable against the code rather than a promise. It previously claimed no
 * analytics at all and invited the reader to verify that in package.json —
 * which stopped being true the day @vercel/analytics was added. A specific
 * claim that goes stale is worse than a vague one, so the analytics section
 * below states exactly what runs and what it does not do.
 */

// A real mailbox someone reads, rather than a branded one that bounces. A
// privacy page whose contact address does not work is worse than not having
// the page: it states a right and then removes the only way to exercise it.
// Swap for hello@vanav.io once that forwards somewhere.
const CONTACT = "toivo@stuhi.org";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8">
      <Label>{title}</Label>
      <div className="mt-3 flex max-w-[68ch] flex-col gap-3 text-[15px] leading-[1.65] text-muted">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1180px] px-5 pb-20 sm:px-8 lg:px-12">
        <section className="py-14 lg:py-20">
          <h1 className="max-w-[22ch] text-balance text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[42px]">
            Privacy
          </h1>
          <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.6] text-muted">
            Two different things: what we collect from visitors to this site,
            and what we hold on behalf of customers. If anything here is
            unclear, write to{" "}
            <a
              href={`mailto:${CONTACT}`}
              className="text-accent-ink underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
            >
              {CONTACT}
            </a>{" "}
            and we will answer plainly.
          </p>
        </section>

        <Section title="What we collect">
          <p>
            If you join the waitlist: your <span className="text-ink">email
            address</span>, and your <span className="text-ink">company name</span>{" "}
            if you choose to give it. Nothing else, and nothing is required
            beyond the address.
          </p>
          <p>
            If you sign a letter of intent: the name, role, company and email
            you type into that form, together with what you wrote and the time
            you submitted it.
          </p>
        </Section>

        <Section title="If your company uses VANAV">
          <p>
            We hold the <span className="text-ink">context you give us</span>:
            the Slack export, documents or text you upload, and whatever is in
            it — including the names of your people and what they wrote. Nothing
            is collected automatically. You choose what to hand over, and you
            can hand over less.
          </p>
          <p>
            The Slack app reads only the channels you invite it into. A bot sees
            history for channels it is a member of, not your whole workspace. It
            is never in a private channel unless someone adds it, it never sees
            direct messages between employees, and removing it from a channel
            ends its access immediately.
          </p>
          <p>
            We do not use your content to train models, sell it, or use it for
            anything other than running VANAV for you.
          </p>
        </Section>

        <Section title="Analytics">
          <p>
            We count page views using{" "}
            <span className="text-ink">Vercel Analytics</span>, which is
            cookieless. It sets no tracking identifier, does not follow you
            between sites, and does not build a profile of you.
          </p>
          <p>
            We deliberately do not use Google Analytics. Several European data
            protection authorities have found its transfers unlawful, and using
            it would contradict everything else on this page.
          </p>
          <p>
            No advertising scripts, no third-party trackers, and nothing that
            writes a cookie.
          </p>
        </Section>

        <Section title="Why, and for how long">
          <p>
            Only to contact you about {PRODUCT}, to tell you when a slot opens,
            or to reply to something you sent us. We do not sell it, share it
            with advertisers, or use it to train anything.
          </p>
          <p>
            We keep it until you ask us not to, or until it is obviously stale.
            A waitlist address from a company that never replied is not worth
            keeping and we will not.
          </p>
        </Section>

        <Section title="Where it is stored and processed">
          <p>
            Content and account records are stored in a{" "}
            <span className="text-ink">Postgres database in Stockholm</span>,
            along with any files you upload. The site itself runs on Vercel.
          </p>
          <p>
            To answer a question, the relevant context is sent to a large
            language model. Today that is the Anthropic API, which processes it
            in the United States. We are moving this to Amazon Bedrock in an EU
            region so that it stays inside the EEA, and this page will say so
            once it has. Neither provider trains on content sent through their
            API.
          </p>
          <p>
            The full list of processors we rely on — Vercel, Supabase,
            Anthropic, AWS, Slack, Stripe and Resend — and what each one does,
            is available on request.
          </p>
        </Section>

        <Section title="Getting it deleted">
          <p>
            Email{" "}
            <a
              href={`mailto:${CONTACT}`}
              className="text-accent-ink underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
            >
              {CONTACT}
            </a>{" "}
            and ask. You do not need to explain why, and we will confirm when it
            is done. You can also ask for a copy of what we hold.
          </p>
          <p>
            For a company, deletion removes the context you gave us, any files
            you uploaded, and your account record, in one operation. We aim to
            complete a request within 30 days and in practice within a few
            working days. One honest limit: a running server may hold content in
            memory until it restarts, so we redeploy when immediacy matters.
          </p>
        </Section>

        <Section title="The demo data">
          <p>
            Everything in the product demo, the company, the fourteen people
            and every message, is invented. It is not any real company&rsquo;s
            data.
          </p>
          <p>
            If you paste your own messages into{" "}
            <Link
              href="/ingest"
              className="text-accent-ink underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
            >
              the ingest page
            </Link>
            , they are processed to build a role and are not shared with anyone.
            Do not paste anything you would not be comfortable sending us in an
            email.
          </p>
        </Section>
      </main>
    </div>
  );
}
