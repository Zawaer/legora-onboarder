/**
 * How every question got answered, counted.
 *
 * WHY THIS IS A STORE AND NOT A LOG LINE
 *
 * The claim the web rung makes is a number: "most of what a new hire asks never
 * costs a colleague anything." That number is the whole argument for the rung
 * existing, and it is the one thing a sponsor write-up will actually quote. A
 * claim like that has to be recomputable from records rather than asserted, so
 * every resolved question is written down with how it was resolved — including
 * the ones that went to a human, because a denominator you cannot see is not a
 * denominator.
 *
 * ON `resolvedBy: "corpus"`
 *
 * It means "the agent resolved it itself, out of the workspace, with nobody
 * interrupted". That covers the ordinary corpus hit and also the corpus *miss*
 * the agent handled honestly on its own — "nobody has written this down, here
 * is what to try" — because from the only perspective the number reports on,
 * whether a human was spent, those two are the same event. What separates a
 * hit from a miss is `classification`: it is written only on a corpus miss, so
 * `classification != null` is exactly the set of misses and is what the GENERAL
 * share divides by. Nothing here overloads one field to mean two things.
 *
 * ON MEASUREMENT — the same rule as everywhere else in this product
 *
 * These are facts about the agent, never about the person who asked. There is
 * no per-hire ranking here and none should be added: `hireId` exists so a
 * pilot can be scoped to one workspace, not so anybody can be compared.
 *
 * Storage follows `lib/agent/hires.ts` exactly — one JSON file, writes
 * serialised through a single promise chain, memory fallback when the disk is
 * read-only. Two chat turns landing together would otherwise drop one record,
 * and a dropped record is a silently wrong number.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { QuestionClass, ResolutionRecord } from "@/lib/web/contract";
import { isKvConfigured, kvGet, kvSet } from "@/lib/kv";

const FILE =
  process.env.RESOLUTIONS_PATH ?? path.join(process.cwd(), "data", "resolutions.json");

/**
 * Enough to cover any demo, any pilot, and a long way past both. The file is
 * read whole on every append, so this is the bound that keeps a chat turn from
 * paying for a year of history.
 */
const MAX_RECORDS = 5_000;

const memory: ResolutionRecord[] = [];
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

function isRecord(v: unknown): v is ResolutionRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Partial<ResolutionRecord>;
  return typeof r.questionId === "string" && typeof r.resolvedBy === "string";
}

/** Durable store key — see the note on KV_KEY in lib/agent/hires.ts. */
const KV_KEY = "store:resolutions";

async function readAll(): Promise<ResolutionRecord[]> {
  if (isKvConfigured()) {
    const rows = (await kvGet<unknown[]>(KV_KEY)) ?? [];
    const kept = rows.filter(isRecord);
    if (kept.length) return kept;
  }
  if (!diskWritable) return [...memory];

  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter(isRecord);
  } catch {
    // No store yet, or unreadable. An empty history is the correct answer to
    // "what has this thing resolved so far" on a fresh machine.
  }
  return [...memory];
}

async function writeAll(records: ResolutionRecord[]): Promise<void> {
  memory.length = 0;
  memory.push(...records);
  if (isKvConfigured()) await kvSet(KV_KEY, records);
  if (!diskWritable) return;
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(records, null, 2), "utf8");
  } catch (err) {
    diskWritable = false;
    console.warn(
      `[resolutions] filesystem is not writable (${(err as Error).message}); continuing in memory only.`,
    );
  }
}

/**
 * Append one resolution.
 *
 * Never throws. A counter that can take down a chat turn is worse than a
 * counter that is occasionally short by one — the hire's answer is the product
 * and this is bookkeeping about it.
 */
export async function recordResolution(record: ResolutionRecord): Promise<void> {
  try {
    await serialise(async () => {
      const all = await readAll();
      all.push(record);
      await writeAll(all.slice(-MAX_RECORDS));
    });
  } catch (err) {
    console.warn("[resolutions] could not record resolution:", err);
  }
}

export type ResolutionQuery = {
  companySlug?: string;
  hireId?: string;
  /** ISO timestamp. Records at or after this instant only. */
  since?: string;
};

export async function listResolutions(
  query: ResolutionQuery = {},
): Promise<ResolutionRecord[]> {
  const all = await readAll();
  const since = query.since ? Date.parse(query.since) : Number.NaN;

  return all.filter((r) => {
    if (query.companySlug && r.companySlug !== query.companySlug) return false;
    if (query.hireId && r.hireId !== query.hireId) return false;
    if (Number.isFinite(since)) {
      const at = Date.parse(r.at);
      if (!Number.isFinite(at) || at < since) return false;
    }
    return true;
  });
}

export type ResolutionStats = {
  total: number;
  /** corpus + web. The first of the two numbers the dashboard shows. */
  resolvedWithoutHuman: number;
  byResolver: Record<ResolutionRecord["resolvedBy"], number>;
  /** Questions the corpus could not answer — i.e. the ones that got classified. */
  corpusMisses: number;
  generalCorpusMisses: number;
  /**
   * The second number, and the one going in a write-up.
   *
   * `null`, not 0, when nothing has missed the corpus yet. "0% of misses were
   * general" and "there have been no misses" are different claims and only one
   * of them is true on a fresh install.
   */
  generalShareOfCorpusMisses: number | null;
  /** Of the misses classified GENERAL, how many the web actually answered. */
  webAnswered: number;
  medianLatencyMs: number | null;
};

export function summarise(records: ResolutionRecord[]): ResolutionStats {
  const byResolver: ResolutionStats["byResolver"] = { corpus: 0, web: 0, peer: 0, expert: 0 };
  let corpusMisses = 0;
  let generalCorpusMisses = 0;
  const latencies: number[] = [];

  for (const r of records) {
    if (r.resolvedBy in byResolver) byResolver[r.resolvedBy] += 1;
    if (r.classification != null) {
      corpusMisses += 1;
      if ((r.classification as QuestionClass) === "GENERAL") generalCorpusMisses += 1;
    }
    if (Number.isFinite(r.latencyMs)) latencies.push(r.latencyMs);
  }

  latencies.sort((a, b) => a - b);

  return {
    total: records.length,
    resolvedWithoutHuman: byResolver.corpus + byResolver.web,
    byResolver,
    corpusMisses,
    generalCorpusMisses,
    generalShareOfCorpusMisses: corpusMisses > 0 ? generalCorpusMisses / corpusMisses : null,
    webAnswered: byResolver.web,
    medianLatencyMs: latencies.length > 0 ? latencies[latencies.length >> 1] ?? null : null,
  };
}

export async function resolutionStats(query: ResolutionQuery = {}): Promise<ResolutionStats> {
  return summarise(await listResolutions(query));
}

/** Erasure (lib/erasure.ts). Same reasoning as purgeCompany in lib/agent/hires.ts. */
export async function purgeCompany(companySlug: string): Promise<number> {
  return serialise(async () => {
    const all = await readAll();
    const kept = all.filter((r) => r.companySlug !== companySlug);
    const n = all.length - kept.length;
    if (n) await writeAll(kept);
    return n;
  });
}
