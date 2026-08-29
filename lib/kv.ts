/**
 * The durable store.
 *
 * WHY THIS EXISTS
 *
 * Seven modules in this repo write JSON under `process.cwd()`. On Vercel that
 * filesystem is read-only, so every one of those writes throws EROFS and the
 * data is gone with the instance. That is not theoretical: three signed letters
 * of intent were captured this evening and survived only because the route logs
 * before it writes. We read them back out of the deployment logs.
 *
 * Nothing that a customer does can be built on that. A company profile, an
 * admin who approves a draft, a file somebody dragged in — all of it needs
 * state that outlives a request.
 *
 * WHY NOT A DEPENDENCY
 *
 * Upstash's REST API is one POST with a JSON array body, which is less code
 * than configuring an SDK and matches how Linkup and ElevenLabs are already
 * wired here. Vercel KV *is* Upstash underneath and sets KV_REST_API_URL and
 * KV_REST_API_TOKEN automatically, so provisioning a store in the dashboard is
 * the whole setup.
 *
 * WHY IT NEVER THROWS
 *
 * Every function degrades to null or false rather than raising. The callers are
 * on request paths where the visitor's outcome matters more than our
 * bookkeeping, and the fallbacks below them (disk locally, memory otherwise)
 * still work. A missing store must make the product forgetful, never broken.
 */

const TIMEOUT_MS = 4_000;

function config(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

export function isKvConfigured(): boolean {
  return config() !== null;
}

/** One Redis command. Returns undefined when unconfigured or on any failure. */
async function command<T>(args: (string | number)[]): Promise<T | undefined> {
  const cfg = config();
  if (!cfg) return undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
      // This is per-request state, never a cached read.
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[kv] ${args[0]} failed: HTTP ${res.status}`);
      return undefined;
    }
    const body = (await res.json()) as { result?: T };
    return body.result;
  } catch (err) {
    console.warn(`[kv] ${args[0]} failed: ${(err as Error).message}`);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** Read a JSON value. Returns null when absent, unconfigured, or unparseable. */
export async function kvGet<T>(key: string): Promise<T | null> {
  const raw = await command<string | null>(["GET", key]);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A value we cannot parse is not a value. Better to behave as if empty
    // than to take a route down over one bad row.
    console.warn(`[kv] ${key} held unparseable JSON`);
    return null;
  }
}

/** Write a JSON value. Returns false when nothing durable took it. */
export async function kvSet(key: string, value: unknown): Promise<boolean> {
  const res = await command<string>(["SET", key, JSON.stringify(value)]);
  return res === "OK";
}

/**
 * Append to a JSON array under one key, read-modify-write.
 *
 * Not atomic. Two writes landing in the same few milliseconds can lose one, and
 * at the volumes this product sees — a letter of intent, a signup, a hire — that
 * is a trade worth making against the complexity of a Lua script or a Redis
 * list with a different read shape. Revisit it the day a customer is writing
 * concurrently, not before.
 */
export async function kvAppend<T>(key: string, row: T): Promise<boolean> {
  const rows = (await kvGet<T[]>(key)) ?? [];
  rows.push(row);
  return kvSet(key, rows);
}

export async function kvList<T>(key: string): Promise<T[]> {
  return (await kvGet<T[]>(key)) ?? [];
}
