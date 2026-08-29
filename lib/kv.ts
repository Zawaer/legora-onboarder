/**
 * The durable store, on Supabase.
 *
 * WHY THIS EXISTS
 *
 * Seven modules in this repo write JSON under `process.cwd()`. On Vercel that
 * filesystem is read-only, so every one of those writes throws EROFS and the
 * data goes with the instance. Three signed letters of intent were captured
 * this evening and survived only because the route logs before it writes.
 *
 * WHY NOT UPSTASH
 *
 * The first version of this file talked to Upstash, written an hour before
 * there was a database. There is one now, in Stockholm, holding the letters of
 * intent and the company tables. A second store would have meant a second
 * thing to provision, a second place to look when something is missing, and a
 * second set of credentials, for data Postgres holds perfectly well. The
 * interface below is unchanged; only what sits underneath it moved.
 *
 * Requires supabase/kv.sql.
 *
 * WHY IT NEVER THROWS
 *
 * Every function degrades to null or false. Callers are on request paths where
 * the visitor's outcome matters more than our bookkeeping, and the fallbacks
 * below them (disk locally, memory otherwise) still work. A missing store makes
 * the product forgetful, never broken.
 */
import { isSupabaseConfigured, serviceClient } from "@/lib/supabase";

const TABLE = "kv";

export function isKvConfigured(): boolean {
  return isSupabaseConfigured();
}

/** Read a JSON value. Null when absent, unconfigured, or on any failure. */
export async function kvGet<T>(key: string): Promise<T | null> {
  const db = serviceClient();
  if (!db) return null;
  const { data, error } = await db
    .from(TABLE)
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.warn(`[kv] read ${key} failed: ${error.message}`);
    return null;
  }
  return (data?.value as T) ?? null;
}

/** Write a JSON value. False when nothing durable took it. */
export async function kvSet(key: string, value: unknown): Promise<boolean> {
  const db = serviceClient();
  if (!db) return false;
  const { error } = await db
    .from(TABLE)
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    console.warn(`[kv] write ${key} failed: ${error.message}`);
    return false;
  }
  return true;
}

/**
 * Append to a JSON array under one key, read-modify-write.
 *
 * Not atomic. Two writes in the same few milliseconds can lose one, and at the
 * volume this sees - a letter, a signup, a hire - that is the right trade
 * against a stored procedure. Revisit it the day a customer writes
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
