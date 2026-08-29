import type { Metadata } from "next";
import HireView, { type Corpus } from "@/components/hire-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Day 1 · Onboarder",
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
        { name: c.name, artifacts: c.artifacts ?? [] },
      ]),
    );
  } catch {
    return {};
  }
}

export default async function HirePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HireView hireId={id} corpus={await corpus()} />;
}
