/**
 * Hire-state persistence.
 *
 * A JSON file, on purpose. The demo needs state to survive a page refresh and a
 * server restart, and nothing more — so a database here would be infrastructure
 * we have to explain rather than product we get to show. It is deliberately
 * separate from lib/store.ts (LOIs and payments) so the two never contend for
 * the same file handle.
 *
 * Writes are serialised through one promise chain because the natural shape of
 * every route here is read-modify-write, and two chat turns landing together
 * would otherwise silently drop one of them.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { HireState } from "@/lib/types";

const FILE = process.env.HIRES_PATH ?? path.join(process.cwd(), "data", "hires.json");

/**
 * Serverless filesystems are read-only outside /tmp, and a dropped write there
 * is better than a 500 in front of a judge. If the disk refuses us we keep
 * serving from memory for the life of the instance and say so in the log.
 */
const memory = new Map<string, HireState>();
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

/**
 * The demo hire, shipped inside the bundle.
 *
 * `FILE` lives under the project directory, which is read-only on serverless, so
 * the deployed site has no hires at all. Verified against the live deployment:
 * `/api/hire` returned an empty list, which means `/manager` renders its empty
 * state and there is no `/hire/[id]` to open — two of the three demo beats blank
 * on the URL we hand to customers and judges.
 *
 * Lowest priority of the three sources, so a real hire always wins and this can
 * never shadow someone's actual data. Same pattern as `lib/seed/derivations.ts`.
 */
import { isKvConfigured, kvGet, kvSet } from "@/lib/kv";
import { BAKED_HIRES } from "@/lib/seed/hires";

/**
 * Durable store key. On Vercel the disk below is per-instance and gone on
 * recycle, which for a pilot means a new hire's ramp plan and conversation
 * state vanish mid-week. Postgres via kv is the record there; disk stays for
 * local development. Same shape as lib/ingest/store.ts.
 */
const KV_KEY = "store:hires";

async function readAll(): Promise<Map<string, HireState>> {
  const map = new Map<string, HireState>(BAKED_HIRES.map((h) => [h.id, h]));

  if (isKvConfigured()) {
    const rows = (await kvGet<HireState[]>(KV_KEY)) ?? [];
    for (const h of rows) if (h && typeof h.id === "string") map.set(h.id, h);
    for (const [id, hire] of memory) map.set(id, hire);
    // kv is the record whenever it is configured. Falling through to disk when
    // kv was merely empty is how a dev machine's data/hires.json got uplifted
    // into production on the first write (3 Sept). Disk is for no-kv dev only.
    return map;
  }

  if (!diskWritable) {
    for (const [id, hire] of memory) map.set(id, hire);
    return map;
  }

  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as HireState[];
    for (const h of parsed) map.set(h.id, h);
  } catch {
    // No store yet, or unreadable. The baked demo hire still stands.
  }

  for (const [id, hire] of memory) map.set(id, hire);
  return map;
}

/**
 * "A real hire always wins" — enforced on the person, not just on the id.
 *
 * The baked hire was generated *from* a record that is still sitting in
 * `data/hires.json` on any machine that has run the demo, and it carries a
 * fixed id rather than that record's UUID. Merging by id therefore kept both,
 * and `/manager` listed two Rebecca Hartleys with the same blocker under each.
 * Same company, same person, same role is the same hire, so the stored one is
 * the one on the board and the bundled copy steps aside.
 *
 * Applied to `listHires` only, so `/hire/demo-legal-engineer` still resolves
 * and a bookmarked or printed link keeps working. Nothing on disk is touched.
 */
function dropShadowedBakes(map: Map<string, HireState>): Map<string, HireState> {
  const baked = new Set(BAKED_HIRES.map((h) => h.id));
  // NUL as the field separator: it is the one character that cannot occur in
  // a slug, a name or a role title, so no two hires can collide on a key.
  // Escaped rather than written as a literal byte, which would make git and
  // grep treat this whole file as binary and skip it.
  const key = (h: HireState) =>
    `${h.companySlug}\u0000${h.name.trim().toLowerCase()}\u0000${h.roleTitle.trim().toLowerCase()}`;

  const real = new Set<string>();
  for (const hire of map.values()) if (!baked.has(hire.id)) real.add(key(hire));
  if (real.size === 0) return map;

  for (const [id, hire] of map) if (baked.has(id) && real.has(key(hire))) map.delete(id);
  return map;
}

async function writeAll(map: Map<string, HireState>): Promise<void> {
  for (const [id, hire] of map) memory.set(id, hire);
  // Baked demo hires are shipped in the bundle; only real rows go to the store.
  const baked = new Set(BAKED_HIRES.map((h) => h.id));
  if (isKvConfigured()) await kvSet(KV_KEY, [...map.values()].filter((h) => !baked.has(h.id)));
  if (!diskWritable) return;
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify([...map.values()], null, 2), "utf8");
  } catch (err) {
    diskWritable = false;
    console.warn(
      `[hires] filesystem is not writable (${(err as Error).message}); continuing in memory only.`,
    );
  }
}

export async function getHire(id: string): Promise<HireState | undefined> {
  return (await readAll()).get(id);
}

export async function listHires(): Promise<HireState[]> {
  return [...dropShadowedBakes(await readAll()).values()].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );
}

export async function putHire(hire: HireState): Promise<HireState> {
  return serialise(async () => {
    const map = await readAll();
    map.set(hire.id, hire);
    await writeAll(map);
    return hire;
  });
}

/**
 * Read-modify-write inside the lock. Every route that mutates a hire goes
 * through here rather than doing its own get/put pair, which is where the lost
 * update would have been.
 */
export async function updateHire(
  id: string,
  mutate: (hire: HireState) => HireState | Promise<HireState>,
): Promise<HireState | undefined> {
  return serialise(async () => {
    const map = await readAll();
    const existing = map.get(id);
    if (!existing) return undefined;
    const next = await mutate(existing);
    map.set(id, next);
    await writeAll(map);
    return next;
  });
}

/**
 * Erasure (lib/erasure.ts): drop every hire belonging to one company, from the
 * durable store, the disk file and this instance's memory. Without the memory
 * clear a warm instance would serve — and on the next save write back — data a
 * customer asked us to delete.
 */
export async function purgeCompany(companySlug: string): Promise<number> {
  return serialise(async () => {
    const map = await readAll();
    let n = 0;
    for (const [id, hire] of map) {
      if (hire.companySlug === companySlug) {
        map.delete(id);
        memory.delete(id);
        n++;
      }
    }
    if (n) await writeAll(map);
    return n;
  });
}
