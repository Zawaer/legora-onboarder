import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader, { NavLink } from "@/components/site-header";
import { ExpertScreen } from "@/components/elicit-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "One question · Onboarder",
  description:
    "A specific question about one thing that actually happened, sent to the person who would know. Under a minute, including the correction — and then it is written down for good.",
};

/**
 * The page a colleague opens.
 *
 * ── WHY THIS IS ITS OWN PAGE AND NOT A MODAL IN THE PRODUCT ──────────────────
 *
 * The person answering does not have an account, does not want one, and is not
 * going to install anything. They get a link in Slack while they are doing
 * something else. So this is a URL that works cold, on a phone, with no state:
 * `/expert?id=…` is one question, `/expert` is whatever is waiting.
 *
 * It is also, deliberately, the only screen in the product aimed at somebody who
 * is *not* the new hire or their manager — which is why the header is stripped
 * back to a way home rather than the full navigation. Nothing here should read
 * as "here is a tool for you to learn". They are doing us a favour and they are
 * doing it in under a minute.
 */
export default async function ExpertPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[]; company?: string | string[] }>;
}) {
  const params = await searchParams;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const company = Array.isArray(params.company) ? params.company[0] : params.company;

  return (
    <div className="min-h-dvh">
      <SiteHeader
        right={
          <>
            {id && <NavLink href="/expert">All questions</NavLink>}
            <NavLink href="/manager">Manager view</NavLink>
          </>
        }
      />

      <main className="mx-auto w-full max-w-[820px] px-5 py-10 sm:px-8 sm:py-14">
        <ExpertScreen id={id} companySlug={company || "legora"} />

        <footer className="mt-14 border-t border-line pt-5">
          <p className="max-w-[68ch] text-[12px] leading-[1.65] text-faint">
            Your answer is written back to you before it is stored, and only the version you confirm
            goes into the corpus — attributed to you, dated, and quotable. Nothing is inferred, added
            or smoothed over on the way in.{" "}
            <Link href="/" className="underline underline-offset-2 hover:text-muted">
              What this is
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
