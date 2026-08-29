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
import { BAKED_HIRES } from "@/lib/seed/hires";

async function readAll(): Promise<Map<string, HireState>> {
  const map = new Map<string, HireState>(BAKED_HIRES.map((h) => [h.id, h]));

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

async function writeAll(map: Map<string, HireState>): Promise<void> {
  for (const [id, hire] of map) memory.set(id, hire);
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
  return [...(await readAll()).values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
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
