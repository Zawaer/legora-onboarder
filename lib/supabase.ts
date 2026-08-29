/**
 * Supabase clients. Two of them, and the difference matters.
 *
 * `browserClient()` carries the signed-in user's session, so every read and
 * write is filtered by the row-level policies in supabase/schema.sql. This is
 * the one that touches a customer's data.
 *
 * `serviceClient()` uses the service-role key and bypasses those policies
 * entirely. It exists for the things acting on nobody's behalf — the Slack bot
 * queueing a draft, a webhook writing a record. It is server-only, and the
 * guard below throws rather than letting it be imported into a client bundle,
 * because a leaked service-role key is every customer's data at once.
 *
 * Both return null when Supabase is not configured. Nothing in the existing
 * product depends on this yet, so an unconfigured deployment behaves exactly
 * as it does today rather than failing to boot.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export function isSupabaseConfigured(): boolean {
  return Boolean(URL && ANON);
}

/** Session-scoped, RLS-enforced. Safe in the browser. */
export function browserClient(): SupabaseClient | null {
  if (!URL || !ANON) return null;
  return createClient(URL, ANON);
}

/**
 * Bypasses RLS. Server only.
 *
 * The `window` check is not paranoia about a hypothetical: importing this into
 * a component that later gains "use client" is a two-character mistake that
 * ships the key to every visitor, and it would not fail loudly on its own.
 */
export function serviceClient(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error(
      "serviceClient() was called in the browser. It holds a key that bypasses " +
        "every access policy and must never leave the server.",
    );
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!URL || !key) return null;
  return createClient(URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─────────────────────────────────────────────────────────────── row types
// Hand-written rather than generated: the schema is small, and a generated
// file would be one more thing to remember to regenerate at four in the
// morning. Keep these in step with supabase/schema.sql by hand.

export type MemberRole = "admin" | "employee";
export type DraftStatus = "pending" | "approved" | "rejected" | "sent";

export type Company = {
  id: string;
  name: string;
  slug: string;
  /** False means every draft waits for an admin. Customers opt in, never out. */
  auto_send: boolean;
  created_at: string;
};

export type Member = {
  id: string;
  company_id: string;
  user_id: string;
  role: MemberRole;
  full_name: string | null;
  created_at: string;
};

export type Draft = {
  id: string;
  company_id: string;
  hire_ref: string;
  kind: string;
  body: string;
  status: DraftStatus;
  decided_by: string | null;
  decided_at: string | null;
  /** An admin's edit. The original `body` is never overwritten. */
  edited_body: string | null;
  created_at: string;
};

export type Material = {
  id: string;
  company_id: string;
  file_name: string;
  storage_path: string;
  bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};
