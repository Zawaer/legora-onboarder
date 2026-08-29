import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { Label } from "@/components/ui";
import { PRODUCT } from "@/lib/product";

export const metadata = {
  title: `Privacy · ${PRODUCT}`,
  description:
    "What we collect, why, and how to have it deleted. Short, because we collect very little.",
};

/**
 * A privacy notice, written because the waitlist form collects an email address
 * from visitors in the EU — not because a lawyer asked for one.
 *
 * It is deliberately short and specific rather than boilerplate. Every sentence
 * is checkable against the code: there is no analytics dependency in
 * package.json, no next/script tag anywhere in app/, and nothing writes
 * document.cookie. A generic policy claiming vague "legitimate interests" in
 * "usage data" we do not collect would be worse than this — it would be the
 * first thing on the site that is not true.
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
            Short, because we collect very little. If anything here is unclear,
            write to{" "}
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

        <Section title="What we do not collect">
          <p>
            No cookies. No analytics. No advertising or tracking scripts of any
            kind, first-party or third-party. We do not know who visits this
            site, which pages they read, or where they came from.
          </p>
          <p>
            This is checkable rather than a promise: there is no analytics
            dependency in the project&rsquo;s{" "}
            <code className="font-mono text-[14px] text-accent-ink">
              package.json
            </code>
            , no script tag in the application, and nothing that writes a cookie.
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

        <Section title="Where it goes">
          <p>
            Into our own systems, and a notification to our team so someone
            actually sees it. The site is hosted on Vercel, so their servers
            handle the request in transit. That is the whole list.
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
            is done. You can also ask for a copy of what we hold, which will be
            one line.
          </p>
        </Section>

        <Section title="The demo data">
          <p>
            Everything in the product demo, the company, the fourteen people
            and every message, is invented. It is not any real company&rsquo;s
            data, and no customer data has ever been through this site.
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
