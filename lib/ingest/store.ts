/**
 * Ingested-company persistence.
 *
 * Same shape as lib/agent/hires.ts on purpose — a JSON file, one serialised
 * promise chain for read-modify-write, an in-memory fallback when the disk is
 * read-only. A database here would be infrastructure to explain rather than
 * product to show, and the failure mode we actually care about is "a customer
 * uploaded their Slack and the page 500'd", not "we outgrew a JSON file".
 *
 * It is deliberately a *separate* file from `data/hires.json` and
 * `data/derivations.json`: hires are user state you must not lose, derivations
 * are a disposable cache, and this is neither — it is somebody's real internal
 * corpus, which we want to be able to delete on request by removing one file
 * and nothing else. Three files, three lifecycles, no shared file handle.
 *
 * Server-only: touches the filesystem. Never import into a client component.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { COMPANIES } from "@/lib/seed";
import type { Company } from "@/lib/types";
import { slugify } from "./parse";
import { isKvConfigured, kvGet, kvSet } from "@/lib/kv";

const FILE =
  process.env.INGESTED_COMPANIES_PATH ?? path.join(process.cwd(), "data", "companies.json");

/**
 * A ceiling on how much of other people's data we sit on. This route is public
 * during a pilot; without a bound, one afternoon of curious visitors turns into
 * an unbounded pile of third-party Slack on our disk. Oldest out first.
 */
const MAX_STORED = 50;

export type IngestedCompany = {
  company: Company;
  /** ISO 8601. */
  ingestedAt: string;
  /** Which parser recognised the input. Shown to the user, not just logged. */
  format: string;
  /** Everything the parse could not do, carried alongside the corpus. */
  warnings: string[];
  /** The role the ingest was started for. A hint for the UI, not a constraint. */
  roleTitle?: string;
};

/**
 * Serverless filesystems are read-only outside /tmp, and a dropped write there
 * is better than a 500 mid-demo: we keep serving from memory for the life of
 * the instance and say so in the log. (Same trade-off, and same wording, as
 * lib/agent/hires.ts — if that behaviour ever changes, change it in both.)
 */
const memory = new Map<string, IngestedCompany>();
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

const KV_KEY = "store:companies";

async function readAll(): Promise<Map<string, IngestedCompany>> {
  // The durable store is the record on serverless, where the disk never was.
  if (isKvConfigured()) {
    const rows = (await kvGet<IngestedCompany[]>(KV_KEY)) ?? [];
    const map = new Map(
      rows
        .filter((row) => row && row.company && typeof row.company.slug === "string")
        .map((row) => [row.company.slug, row] as const),
    );
    // Anything written this instance but not yet flushed still counts.
    for (const [slug, row] of memory) if (!map.has(slug)) map.set(slug, row);
    if (map.size) return map;
  }
  if (!diskWritable) return memory;
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as IngestedCompany[];
    const rows = Array.isArray(parsed) ? parsed : [];
    const map = new Map(
      rows
        .filter((row) => row && row.company && typeof row.company.slug === "string")
        .map((row) => [row.company.slug, row]),
    );
    for (const [slug, row] of memory) if (!map.has(slug)) map.set(slug, row);
    return map;
  } catch {
    // Missing file on first run, or a half-written one. Either way an empty
    // registry is the right answer — a read must never take a page down.
    return memory;
  }
}

async function writeAll(map: Map<string, IngestedCompany>): Promise<void> {
  for (const [slug, row] of map) memory.set(slug, row);

  // A corpus somebody pasted has to survive the request that created it, or
  // the derivation they are shown belongs to a company that no longer exists.
  if (isKvConfigured()) await kvSet(KV_KEY, [...map.values()]);

  if (!diskWritable) return;
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, `${JSON.stringify([...map.values()], null, 2)}\n`, "utf8");
  } catch (err) {
    diskWritable = false;
    console.warn(
      `[ingest] filesystem is not writable (${(err as Error).message}); continuing in memory only.`,
    );
  }
}

/**
 * Allocate a slug nobody else is using — including the seeded companies, since
 * `getCompany` is checked first everywhere and a collision would silently
 * shadow the customer's corpus with ours. Runs inside the write lock, so two
 * simultaneous ingests cannot both win "acme".
 */
function allocateSlug(desired: string, taken: Map<string, IngestedCompany>): string {
  const base = slugify(desired);
  const isFree = (candidate: string) => !taken.has(candidate) && !(candidate in COMPANIES);

  if (isFree(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (isFree(candidate)) return candidate;
  }
  // Astronomically unlikely; still better than looping forever.
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Persist a parsed company under a fresh, unique slug.
 *
 * The slug on the incoming `Company` is treated as a *wish*: the stored company
 * is returned with the slug it actually got, and callers must use that one.
 */
export async function saveCompany(
  company: Company,
  meta: { format: string; warnings?: string[]; roleTitle?: string } = { format: "unknown" },
): Promise<IngestedCompany> {
  return serialise(async () => {
    const map = await readAll();
    const slug = allocateSlug(company.slug || company.name, map);

    const row: IngestedCompany = {
      company: { ...company, slug },
      ingestedAt: new Date().toISOString(),
      format: meta.format,
      warnings: meta.warnings ?? [],
      roleTitle: meta.roleTitle,
    };

    map.set(slug, row);

    // Evict oldest first, but never the one we just wrote.
    if (map.size > MAX_STORED) {
      const oldest = [...map.values()]
        .sort((a, b) => a.ingestedAt.localeCompare(b.ingestedAt))
        .slice(0, map.size - MAX_STORED);
      for (const victim of oldest) {
        if (victim.company.slug !== slug) {
          map.delete(victim.company.slug);
          memory.delete(victim.company.slug);
        }
      }
    }

    await writeAll(map);
    return row;
  });
}

/** The corpus behind an ingested slug, in the exact shape lib/agent expects. */
export async function getIngestedCompany(slug: string): Promise<Company | undefined> {
  return (await readAll()).get(slug)?.company;
}

export async function listIngestedCompanies(): Promise<IngestedCompany[]> {
  return [...(await readAll()).values()].sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt));
}
