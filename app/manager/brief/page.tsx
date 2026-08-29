import type { Metadata } from "next";
import ManagerBriefView from "@/components/manager-brief-view";
import type { SyntheticCorpus } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manager brief · Onboarder",
  description:
    "Sent to the hiring manager 48 hours before a start date: who the buddy should be and why, five people to meet with a specific reason each, the first real task with the worked example beside it, and what the company still has not decided. Every line quoted from the company's own corpus.",
};


/**
 * The seeded company behind at least one hire on this screen, if any.
 *
 * Both manager screens print invented people by name, so the notice is
 * resolved here on the server and passed down: rendering it after the hires
 * fetch lands would leave it out of the server HTML, and out of the first
 * frame of anything recorded or screenshotted.
 *
 * `getCompany` only knows the seeded corpora, so a workspace built from a
 * customer's own uploaded Slack correctly gets no notice — that export is
 * real, and saying otherwise would be its own falsehood.
 */
async function synthetic(): Promise<SyntheticCorpus | undefined> {
  try {
    const { listHires } = await import("@/lib/agent/hires");
    const { getCompany } = await import("@/lib/seed");
    for (const hire of await listHires()) {
      const company = getCompany(hire.companySlug);
      // Counted off the roster, not typed in.
      if (company) return { companyName: company.name, people: company.people?.length };
    }
  } catch {
    // Never take the screen down over a notice.
  }
  return undefined;
}

export default async function ManagerBriefPage() {
  return <ManagerBriefView synthetic={await synthetic()} />;
}
