"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { Label } from "@/components/ui";
import { useAuth, sendMagicLink, signOut } from "@/lib/auth";
import { browserClient } from "@/lib/supabase";
import AdminDashboard from "@/components/app/admin-dashboard";

/**
 * The customer-facing app.
 *
 * Three states, and the page is whichever one is true: signed out, signed in
 * with no company yet, signed in as a member. Deliberately one route rather
 * than three, because every redirect between them is a chance to land somebody
 * in a loop at three in the morning.
 */
export default function AppPage() {
  const { loading, session, member, ready, refresh } = useAuth();

  if (!ready) return <Shell><Notice title="Not configured">
    This deployment has no Supabase project attached, so sign-in is unavailable.
  </Notice></Shell>;

  if (loading) return <Shell><p className="text-[15px] text-muted">Loading…</p></Shell>;
  if (!session) return <Shell><SignIn /></Shell>;
  if (!member) return <Shell><CreateCompany onDone={refresh} email={session.user.email ?? ""} /></Shell>;

  return (
    <Shell>
      <AdminDashboard member={member} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader
        right={
          session ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-md px-2.5 py-1.5 text-[13px] text-muted hover:bg-surface-2 hover:text-ink"
            >
              Sign out
            </button>
          ) : undefined
        }
      />
      <main className="mx-auto w-full max-w-[1180px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        {children}
      </main>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-[52ch]">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="mt-3 text-[15px] leading-[1.65] text-muted">{children}</p>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const err = await sendMagicLink(email);
    if (err) { setError(err); setState("error"); return; }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <Notice title="Check your email">
        We sent a sign-in link to <span className="text-ink">{email}</span>. It
        opens this page already signed in. No password, so there is nothing to
        reset and nothing to leak.
      </Notice>
    );
  }

  return (
    <div className="max-w-[42ch]">
      <Label>Sign in</Label>
      <h1 className="mt-3 text-[30px] leading-[1.1] font-semibold tracking-[-0.025em]">
        Your company&rsquo;s workspace.
      </h1>
      <p className="mt-3 text-[15px] leading-[1.65] text-muted">
        Review what the agent wants to send before it reaches anyone, and decide
        what it may send on its own.
      </p>

      <form onSubmit={submit} className="mt-7 flex flex-col gap-2.5">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label="Work email"
          className="h-12 rounded-lg border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="h-12 rounded-lg bg-ink text-[15px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-70"
        >
          {state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
        {state === "error" && (
          <p role="alert" className="text-[13px] text-warn">{error}</p>
        )}
      </form>

      <p className="mt-5 text-[13px] leading-[1.55] text-faint">
        Hosted in Stockholm.{" "}
        <Link href="/privacy" className="underline decoration-line-strong underline-offset-2 hover:text-muted">
          What we store
        </Link>
        .
      </p>
    </div>
  );
}

/** First run: the person who signs in first owns the company and admins it. */
function CreateCompany({ onDone, email }: { onDone: () => void; email: string }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    // The route runs with the service key and so does its own authorisation.
    // It needs the session token to know who is asking.
    const db = browserClient();
    const token = (await db?.auth.getSession())?.data.session?.access_token;
    const res = await fetch("/api/app/company", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error ?? "Could not create the workspace."); setBusy(false); return; }
    onDone();
  }

  return (
    <div className="max-w-[42ch]">
      <Label>First run</Label>
      <h1 className="mt-3 text-[30px] leading-[1.1] font-semibold tracking-[-0.025em]">
        Name your company.
      </h1>
      <p className="mt-3 text-[15px] leading-[1.65] text-muted">
        Signed in as {email}. You will be its first admin, which means nothing
        the agent writes reaches anyone until you have seen it.
      </p>
      <form onSubmit={submit} className="mt-7 flex flex-col gap-2.5">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tonava Group"
          aria-label="Company name"
          className="h-12 rounded-lg border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-12 rounded-lg bg-ink text-[15px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-70"
        >
          {busy ? "Creating…" : "Create workspace"}
        </button>
        {error && <p role="alert" className="text-[13px] text-warn">{error}</p>}
      </form>
    </div>
  );
}
