/**
 * Derivation cache.
 *
 * A cold derivation is two Opus calls over the whole corpus and takes about two
 * minutes. That is the honest cost of the thing the product actually does, and
 * it is fine — once. It is not fine on a stage with a three-minute slot, or on
 * someone's phone in a corridor, where the same role gets derived over and over
 * from an unchanged corpus and the answer is deterministic enough that paying
 * twice is just waiting.
 *
 * Two rules this file exists to enforce:
 *
 *   1. A cache hit is never presented as live work. Every entry carries
 *      `derivedAt`, and the route returns it, so the UI can say "derived four
 *      minutes ago" instead of implying the model just ran. This is the same
 *      honesty rule as the grounding check — do not show someone something that
 *      did not happen. A spinner over a disk read is a lie with a progress bar.
 *
 *   2. A stale hit is worse than a slow miss. Entries are keyed by a hash of
 *      the corpus, so editing the seed invalidates them automatically. Relying
 *      on a human to remember `fresh=1` after changing an artifact is how you
 *      end up demoing a derivation of a corpus that no longer exists.
 *
 * Deliberately not sharing a store abstraction with `hires.ts`: hire state is
 * user data you must not lose, this is disposable. `rm data/derivations.json`
 * has to be a safe thing to do at any moment, and coupling the two would make
 * that a question rather than an answer.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { renderCorpus } from "@/lib/agent/derive";
import type { Company, DerivedRole, RampPlan } from "@/lib/types";

const FILE = process.env.DERIVATIONS_PATH ?? path.join(process.cwd(), "data", "derivations.json");

export type CachedDerivation = {
  key: string;
  companySlug: string;
  /** The role title as it was originally asked for, punctuation and all. */
  roleTitle: string;
  /** Fingerprint of the corpus this was derived from. Mismatch means stale. */
  corpusHash: string;
  role: DerivedRole;
  plan: RampPlan;
  grounding: { kept: number; dropped: number };
  /** ISO 8601. When the model actually ran. Surfaced to the user, not hidden. */
  derivedAt: string;
};

/**
 * "Forward Deployed Engineer", "forward deployed engineer" and "Forward
 * Deployed Engineer " are the same request typed by three different people.
 * Normalise for the key; keep the original for display.
 */
export function normaliseRoleTitle(roleTitle: string): string {
  return roleTitle
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function derivationKey(companySlug: string, roleTitle: string): string {
  return `${companySlug.toLowerCase()}::${normaliseRoleTitle(roleTitle)}`;
}

/** Short hash of the exact bytes the model would have been shown. */
export function corpusFingerprint(company: Company): string {
  return createHash("sha256").update(renderCorpus(company)).digest("hex").slice(0, 16);
}

const memory = new Map<string, CachedDerivation>();
let diskWritable = true;
let queue: Promise<unknown> = Promise.resolve();

function serialise<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function readAll(): Promise<Map<string, CachedDerivation>> {
  if (!diskWritable) return memory;
  try {
    const parsed = JSON.parse(await fs.readFile(FILE, "utf8")) as CachedDerivation[];
    const map = new Map(parsed.map((d) => [d.key, d]));
    for (const [key, entry] of memory) if (!map.has(key)) map.set(key, entry);
    return map;
  } catch {
    return memory;
  }
}

/**
 * Look up a derivation, but only return one that was derived from the corpus we
 * have in front of us right now.
 */
export async function readDerivation(
  company: Company,
  roleTitle: string,
): Promise<CachedDerivation | undefined> {
  const entry = (await readAll()).get(derivationKey(company.slug, roleTitle));
  if (!entry) return undefined;
  if (entry.corpusHash !== corpusFingerprint(company)) return undefined;
  return entry;
}

export async function writeDerivation(
  company: Company,
  roleTitle: string,
  value: { role: DerivedRole; plan: RampPlan; grounding: { kept: number; dropped: number } },
): Promise<CachedDerivation> {
  const entry: CachedDerivation = {
    key: derivationKey(company.slug, roleTitle),
    companySlug: company.slug,
    roleTitle,
    corpusHash: corpusFingerprint(company),
    role: value.role,
    plan: value.plan,
    grounding: value.grounding,
    derivedAt: new Date().toISOString(),
  };

  return serialise(async () => {
    const map = await readAll();
    map.set(entry.key, entry);
    memory.set(entry.key, entry);
    if (diskWritable) {
      try {
        await fs.mkdir(path.dirname(FILE), { recursive: true });
        await fs.writeFile(FILE, JSON.stringify([...map.values()], null, 2), "utf8");
      } catch (err) {
        // A cache that cannot write is still a cache for the life of the
        // instance. Never let this path fail a request.
        diskWritable = false;
        console.warn(`[cache] not writable (${(err as Error).message}); in-memory only.`);
      }
    }
    return entry;
  });
}

/** What is warm right now, newest first. Lets the UI avoid promising a fast path it does not have. */
export async function listDerivations(): Promise<
  Array<Pick<CachedDerivation, "companySlug" | "roleTitle" | "derivedAt"> & { corpusHash: string }>
> {
  return [...(await readAll()).values()]
    .sort((a, b) => b.derivedAt.localeCompare(a.derivedAt))
    .map(({ companySlug, roleTitle, derivedAt, corpusHash }) => ({
      companySlug,
      roleTitle,
      derivedAt,
      corpusHash,
    }));
}
