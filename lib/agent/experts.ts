/**
 * Who actually knows this, and the receipts.
 *
 * `askIfStuck` currently resolves against a hand-authored `owns` list, which is
 * fine for the seeded corpus and useless for an ingested one — the parser leaves
 * `owns` empty on purpose, because guessing ownership routes a stuck hire to the
 * wrong person with full confidence. So on exactly the path a customer would try
 * first, routing is our weakest link.
 *
 * This derives it from behaviour instead, and — the part that matters — carries
 * the evidence with it. The citation convinces, not the score. Nobody believes
 * "Johan: 0.84"; everybody believes three messages where Johan answered this.
 *
 * The bug to design against, and the reason not to just count messages: volume
 * weighting elects the chattiest person in the channel, not the one who knows.
 * Authority signals are answering-shaped, not talking-shaped.
 */

import type { Artifact, Company, Person } from "@/lib/types";

/** Half-life in days for recency weighting. Knowledge goes stale; ownership moves. */
const RECENCY_HALF_LIFE_DAYS = 90;

export type ExpertEvidence = {
  artifactId: string;
  /** Verbatim excerpt, kept short enough to read at a glance. */
  quote: string;
  channel?: string;
  timestamp: string;
  /** Which signal this line contributed. */
  signal: ExpertSignal;
};

export type ExpertSignal =
  /** Replied in a thread they did not start — answering, not broadcasting. */
  | "answered"
  /** Named by someone else asking a question. Others route to them already. */
  | "named"
  /** Stated ownership or a decision about the area. */
  | "decided"
  /** Merely present in the topic. Weakest signal, never sufficient alone. */
  | "mentioned";

/** How much each signal is worth. Answering and being named beat talking. */
export const SIGNAL_WEIGHT: Record<ExpertSignal, number> = {
  answered: 3,
  named: 3,
  decided: 2,
  mentioned: 0.5,
};

export type RankedExpert = {
  person: Person;
  /** Not shown to users on its own — it exists to order the list. */
  score: number;
  /** Always populated. An expert with no evidence is not returned. */
  evidence: ExpertEvidence[];
  /** One line a human can read: "answered three questions about this in August". */
  why: string;
};

/** Exponential recency decay on an ISO timestamp, relative to `now`. */
export function recencyWeight(timestamp: string, now: Date = new Date()): number {
  const t = Date.parse(timestamp);
  if (Number.isNaN(t)) return 0.25;
  const days = Math.max(0, (now.getTime() - t) / 86_400_000);
  return Math.pow(0.5, days / RECENCY_HALF_LIFE_DAYS);
}

/**
 * Rank people by who demonstrably knows `topic`.
 *
 * Returns at most `limit`, and **never returns anyone without evidence** — an
 * unevidenced routing suggestion is the same failure as an unevidenced citation,
 * and it costs a new hire a wasted interruption plus the confidence to ask again.
 *
 * Implemented in `experts.impl.ts` so this file stays the contract.
 */
export type RankExperts = (
  company: Company,
  topic: string,
  opts?: { limit?: number; now?: Date; exclude?: string[] },
) => RankedExpert[];

/**
 * The people a new hire should know in week one, derived rather than nominated.
 *
 * Same index as the ranking, different question: not "who knows X" but "who will
 * this person actually run into". Steinmacher's largest barrier category is
 * social — not knowing who is who outranks missing documentation by a distance.
 */
export type WhosWho = (
  company: Company,
  roleTitle: string,
  opts?: { limit?: number; now?: Date },
) => Array<{ person: Person; why: string; evidence: ExpertEvidence[] }>;

/** Shared helper: does this artifact plausibly concern the topic? */
export function mentionsTopic(artifact: Artifact, terms: string[]): boolean {
  if (!terms.length) return false;
  const haystack = `${artifact.title ?? ""} ${artifact.text}`.toLowerCase();
  return terms.some((t) => t.length > 2 && haystack.includes(t));
}

/** Split a topic into search terms, dropping words that match everything. */
export function topicTerms(topic: string): string[] {
  const STOP = new Set([
    "the","a","an","and","or","for","to","of","in","on","with","is","are","was",
    "what","who","how","why","when","where","this","that","it","i","we","you",
    "do","does","did","can","should","would","about","from","by","at","as","be",
  ]);
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}
