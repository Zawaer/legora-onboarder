import type { Metadata } from "next";
import HireView, { type Corpus } from "@/components/hire-view";
import type { SyntheticCorpus } from "@/components/ui";
import WhosWhoPanel from "@/components/whos-who";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Day 1 · Vanav",
};

/**
 * The evidence citations are the proof the role wasn't invented, so they have to
 * carry the channel and author they came from. The hire record only stores
 * artifact ids, so the source corpus is handed down from the server alongside it.
 */
async function corpus(): Promise<Corpus> {
  try {
    // Imported lazily so a seed module that fails to load degrades the citations
    // to bare artifact ids rather than taking the whole page down.
    const { listCompanies } = await import("@/lib/seed");
    // Ingested corpora too, otherwise a hire derived from a customer's own
    // Slack renders its citations as bare artifact ids — and the citations are
    // the entire proof that the role was not invented.
    const { listIngestedCompanies } = await import("@/lib/ingest/store");
    const companies = [
      ...listCompanies(),
      ...(await listIngestedCompanies()).map((c) => c.company),
    ];
    return Object.fromEntries(
      companies.map((c) => [
        c.slug,
        // The roster travels with the corpus. Without it the coverage panel on
        // the role card runs roster-blind: no "N of M named people appear in it
        // as authors", and no way to say whether the roster is independent of
        // the corpus or was read off the messages themselves — which is the
        // whole claim that panel exists to make.
        { name: c.name, artifacts: c.artifacts ?? [], people: c.people ?? [] },
      ]),
    );
  } catch {
    return {};
  }
}

/**
 * Whether this hire's corpus is the written demo rather than a customer's own
 * export, resolved here on the server.
 *
 * It is resolved server-side, and not in the client after the hire loads,
 * because a disclosure that arrives with the second render is a disclosure
 * missing from the first frame of a screen recording and from every
 * screenshot anybody takes of the loading state. It has to be in the HTML.
 *
 * `getCompany` only knows the seeded corpora, which is exactly the test we
 * want: an ingested corpus is a customer's real Slack, and telling them it is
 * fictional would be a worse falsehood than the one this exists to prevent.
 */
async function synthetic(id: string): Promise<SyntheticCorpus | undefined> {
  try {
    const { getHire } = await import("@/lib/agent/hires");
    const { getCompany } = await import("@/lib/seed");
    const hire = await getHire(id);
    const company = hire ? getCompany(hire.companySlug) : undefined;
    if (!company) return undefined;
    // Counted off the roster rather than typed in, so it stays true if the
    // corpus grows a fifteenth person.
    return { companyName: company.name, people: company.people?.length };
  } catch {
    // A notice we could not resolve must never take the workspace down; the
    // page still renders, and HireView falls back to showing none.
    return undefined;
  }
}

export default async function HirePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [sources, invented] = await Promise.all([corpus(), synthetic(id)]);
  return (
    <>
      <HireView hireId={id} corpus={sources} synthetic={invented} />
      {/* Derived from the corpus on the server, below the workspace: not knowing
          who anyone is outranks missing documentation as a week-one blocker. */}
      <WhosWhoPanel hireId={id} />
    </>
  );
}
