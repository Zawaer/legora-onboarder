/**
 * Verification of model-supplied citations against the actual corpus.
 *
 * WHY THIS FILE EXISTS, AND WHY IT MUST NEVER BE REMOVED FOR A DEMO:
 *
 * On a previous project a scraping tool returned ten fully-formed records —
 * plausible names, plausible fields, HTTP 200, no error anywhere — and every
 * single one was invented. Nothing in the pipeline could tell the difference
 * between a real record and a confident fabrication, because both looked
 * identical at the type level. We shipped it and found out later.
 *
 * The same failure here is worse. This product shows a hiring manager quotes
 * attributed to their own team, in their own Slack. A fabricated quote is not
 * a subtly wrong answer they might miss — it is a sentence they know for a
 * fact nobody wrote, and they will spot it in about four seconds. Showing them
 * an invented quote from their own #eng channel is strictly worse than showing
 * them nothing at all, because it retroactively poisons every claim on the
 * page, including the ones that were true.
 *
 * So: the model proposes, this file disposes. Every quote is checked as a
 * literal substring of the artifact it cites. If it isn't there, it's gone —
 * even if the surrounding claim was probably fine. We would rather present
 * four verified citations than eight where one is fake.
 *
 * There is no flag to turn this off. Do not add one.
 */

import type { Artifact, Company, Evidence } from "@/lib/types";

/**
 * Quotes shorter than this cite nothing useful — "we" appears in every
 * artifact and verifies trivially, which makes the check meaningless rather
 * than merely weak.
 */
const MIN_QUOTE_CHARS = 12;

export type GroundingReport = {
  kept: Evidence[];
  dropped: DroppedEvidence[];
  keptCount: number;
  droppedCount: number;
};

export type DroppedEvidence = Evidence & {
  reason: "unknown_artifact" | "quote_not_found" | "quote_too_short";
};

/**
 * Keep only evidence whose quote genuinely appears in the artifact it cites.
 *
 * Matching is normalised for whitespace, case, and the punctuation an LLM
 * silently rewrites (curly quotes, en/em dashes, non-breaking spaces). That is
 * the entire tolerance budget: normalisation forgives transcription, it does
 * not forgive invention.
 */
export function groundEvidence(evidence: Evidence[], company: Company): Evidence[] {
  return report(evidence, company).kept;
}

/** Same check, but tells you what it threw away and why. */
export function groundingReport(evidence: Evidence[], company: Company): GroundingReport {
  return report(evidence, company);
}

function report(evidence: Evidence[], company: Company): GroundingReport {
  const byId = new Map<string, Artifact>(company.artifacts.map((a) => [a.id, a]));
  const kept: Evidence[] = [];
  const dropped: DroppedEvidence[] = [];

  for (const item of evidence) {
    const artifact = byId.get(item.artifactId);
    if (!artifact) {
      dropped.push({ ...item, reason: "unknown_artifact" });
      continue;
    }
    if (item.quote.trim().length < MIN_QUOTE_CHARS) {
      dropped.push({ ...item, reason: "quote_too_short" });
      continue;
    }
    if (!quoteAppearsIn(item.quote, artifact.text)) {
      dropped.push({ ...item, reason: "quote_not_found" });
      continue;
    }
    kept.push(item);
  }

  return { kept, dropped, keptCount: kept.length, droppedCount: dropped.length };
}

/**
 * A quote may legitimately elide the middle of a long message with an ellipsis.
 * We allow that, but only in order: every fragment must appear, and each one
 * after the position where the previous fragment ended. Stitching two unrelated
 * halves of an artifact into a sentence nobody wrote is still fabrication.
 */
function quoteAppearsIn(quote: string, text: string): boolean {
  const haystack = normalise(text);
  const fragments = quote
    .split(/\s*(?:\.\.\.|\u2026)\s*/)
    .map(normalise)
    .filter((f) => f.length > 0);

  if (fragments.length === 0) return false;

  let cursor = 0;
  for (const fragment of fragments) {
    const at = haystack.indexOf(fragment, cursor);
    if (at === -1) return false;
    cursor = at + fragment.length;
  }
  return true;
}

/**
 * Collapse the differences that are transcription artefacts rather than
 * meaning: case, runs of whitespace, and the typographic characters a model
 * substitutes without being asked. Everything else is left intact on purpose —
 * a looser normaliser is a check that passes when it should fail.
 */
function normalise(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
