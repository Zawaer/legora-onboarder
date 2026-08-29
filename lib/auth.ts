"use client";

/**
 * Session and membership, for the customer-facing app under /app.
 *
 * Client-side on purpose. Row-level security in supabase/schema.sql is the
 * actual boundary: a signed-out browser holds no token, and a signed-in one is
 * filtered to its own company by the database on every query. A server-side
 * gate on top of that would stop somebody seeing an empty page, not stop them
 * seeing data, so it is not worth the SSR cookie machinery tonight.
 *
 * The corollary is worth stating plainly, because it is easy to forget later:
 * any new table needs its own policies. Adding one without them makes it world
 * readable, and nothing in this file would notice.
 */
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { browserClient, type Company, type Member } from "@/lib/supabase";

export type AuthState = {
  loading: boolean;
  session: Session | null;
  member: (Member & { company: Company }) | null;
  /** Configured at all? An unconfigured deployment renders an explanation. */
  ready: boolean;
};

export function useAuth(): AuthState & { refresh: () => void } {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    member: null,
    ready: true,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const db = browserClient();
    if (!db) {
      setState({ loading: false, session: null, member: null, ready: false });
      return;
    }

    let cancelled = false;

    const load = async (session: Session | null) => {
      if (!session) {
        if (!cancelled) setState({ loading: false, session: null, member: null, ready: true });
        return;
      }
      // One row: which company this user belongs to, and as what. RLS means a
      // user who belongs to nothing simply gets nothing back.
      const { data } = await db
        .from("members")
        .select("*, company:companies(*)")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setState({
          loading: false,
          session,
          member: (data as unknown as (Member & { company: Company })) ?? null,
          ready: true,
        });
      }
    };

    db.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = db.auth.onAuthStateChange((_e, session) => load(session));

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [tick]);

  return { ...state, refresh: () => setTick((t) => t + 1) };
}

/** Magic link. No passwords: nothing to reset, nothing to leak, nothing to forget. */
export async function sendMagicLink(email: string): Promise<string | null> {
  const db = browserClient();
  if (!db) return "Sign-in is not configured on this deployment.";
  const { error } = await db.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}/app` },
  });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  await browserClient()?.auth.signOut();
}
