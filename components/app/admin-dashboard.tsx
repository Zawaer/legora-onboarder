"use client";

/**
 * The signed-in customer's dashboard.
 *
 * Three things, in the order they matter. The automation setting first, because
 * it is the one control that changes what reaches a new hire without a person
 * in the loop. The draft queue second, because that is the day-to-day work.
 * The roster last, because it is reference rather than action.
 *
 * Everything here reads and writes through the session-scoped Supabase client,
 * so row-level security in supabase/schema.sql is the real boundary. The
 * `role === "admin"` checks below are courtesy: they keep an employee from
 * being offered a control that would fail, they are not what stops them.
 */

import { useCallback, useEffect, useState } from "react";
import { Label } from "@/components/ui";
import DraftQueue from "@/components/app/draft-queue";
import Materials from "@/components/app/materials";
import { browserClient, type Company, type Member } from "@/lib/supabase";

export default function AdminDashboard({
  member,
}: {
  member: Member & { company: Company };
}) {
  const isAdmin = member.role === "admin";

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.025em]">
          {member.company.name}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-faint">
          <span>{isAdmin ? "Admin" : "Employee"}</span>
          <span aria-hidden>·</span>
          <span className="font-mono">{member.company.slug}</span>
        </p>
      </header>

      <AutomationSetting company={member.company} isAdmin={isAdmin} />

      <section>
        <Label>Draft queue</Label>
        <div className="mt-4">
          <DraftQueue companyId={member.company_id} canDecide={isAdmin} />
        </div>
      </section>

      {/* Material sits between the queue and the members list on purpose: it
          is the answer to the sharpest criticism this product gets, which is
          that a role inferred from chat alone is ambiguous because much of a
          job is agreed out loud. What a company uploads here is the part that
          was written down somewhere other than Slack.

          canUpload is admin-only because it also gates Remove. The route
          independently lets any member POST and restricts DELETE to admins, so
          the two disagree deliberately in the safe direction. */}
      <section>
        <Label>Onboarding material</Label>
        <div className="mt-4">
          <Materials companyId={member.company_id} canUpload={isAdmin} />
        </div>
      </section>

      <Members companyId={member.company_id} />
    </div>
  );
}

/* ── panel chrome ─────────────────────────────────────────────────────────
   The product's panel idiom, local to this file so the dashboard does not
   have to reach into a shared component and change it for everyone else. */

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-line-strong bg-surface"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-2/70 px-5 py-3">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ── the automation setting ───────────────────────────────────────────────
   Off is the shipped default and the safe one. A buyer under supervision has
   to opt in to automation deliberately; nobody should ever find out later that
   they were opted in by a default. So the copy states what is true right now
   in plain terms, and the control never moves on its own. */

type SaveState = "idle" | "saving" | "error";

function AutomationSetting({
  company,
  isAdmin,
}: {
  company: Company;
  isAdmin: boolean;
}) {
  const [autoSend, setAutoSend] = useState(company.auto_send);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  // If the parent ever hands us a fresher company row, follow it rather than
  // sitting on a stale local copy.
  useEffect(() => {
    setAutoSend(company.auto_send);
  }, [company.auto_send]);

  const toggle = useCallback(
    async (next: boolean) => {
      if (!isAdmin || state === "saving") return;
      const previous = autoSend;

      // Optimistic: the switch moves now, and comes back if the write is
      // refused. A control that lags behind the finger gets clicked twice.
      setAutoSend(next);
      setState("saving");
      setError("");

      const db = browserClient();
      if (!db) {
        setAutoSend(previous);
        setState("error");
        setError(
          "This deployment has no Supabase project attached, so the setting could not be saved.",
        );
        return;
      }

      // `.select()` on the update matters. Row-level security does not reject
      // a write it is not allowed to make, it simply matches no rows and
      // returns success. Without the returned row we would show an employee a
      // switch that flipped and a database that never changed.
      const { data, error: writeError } = await db
        .from("companies")
        .update({ auto_send: next })
        .eq("id", company.id)
        .select("id, auto_send");

      if (writeError) {
        setAutoSend(previous);
        setState("error");
        setError(
          `Could not save the setting. ${writeError.message} Nothing changed.`,
        );
        return;
      }

      if (!data || data.length === 0) {
        setAutoSend(previous);
        setState("error");
        setError(
          "The database refused the change, which means this account is not an admin of this company. Nothing changed.",
        );
        return;
      }

      setState("idle");
    },
    [autoSend, company.id, isAdmin, state],
  );

  return (
    <section>
      <Label>Automation</Label>
      <div className="mt-4">
        <Panel title="Sending · agent authority">
          <div className="px-5 py-6 sm:px-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
              <div className="max-w-[62ch]">
                <h2
                  id="auto-send-label"
                  className="text-[17px] font-semibold tracking-[-0.01em]"
                >
                  Send drafts without review
                </h2>
                <p
                  id="auto-send-description"
                  className="mt-2 text-[14.5px] leading-[1.6] text-muted"
                >
                  {autoSend
                    ? "The agent sends directly. Drafts are logged but not held."
                    : "Every draft waits for an admin before it reaches a new hire."}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3 sm:pt-1">
                <span
                  className={`text-[13px] font-medium ${
                    autoSend ? "text-warn" : "text-muted"
                  }`}
                >
                  {autoSend ? "On" : "Off"}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoSend}
                  aria-labelledby="auto-send-label"
                  aria-describedby="auto-send-description"
                  disabled={!isAdmin || state === "saving"}
                  onClick={() => void toggle(!autoSend)}
                  className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:cursor-not-allowed ${
                    autoSend
                      ? "border-ink bg-ink"
                      : "border-line-strong bg-surface-2"
                  } ${!isAdmin ? "opacity-70" : ""}`}
                >
                  <span
                    className={`absolute top-[3px] left-0 h-5 w-5 rounded-full border border-line-strong bg-surface transition-transform ${
                      autoSend ? "translate-x-[24px]" : "translate-x-[4px]"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* The state that is not the default is stated again, in the
                colour the product uses for "a human is needed". */}
            {autoSend && (
              <p className="mt-5 rounded-lg border border-warn-line bg-warn-soft px-3.5 py-2.5 text-[13px] leading-[1.55] text-warn">
                Automation is on for {company.name}. New hires can receive
                messages nobody at the company has read first.
              </p>
            )}

            {!isAdmin && (
              <p className="mt-5 text-[13px] leading-[1.55] text-faint">
                Only an admin can change this. You are signed in as an employee,
                so the setting is shown here read only.
              </p>
            )}

            {state === "saving" && (
              <p className="mt-5 text-[13px] leading-[1.55] text-faint">
                Saving…
              </p>
            )}

            {state === "error" && (
              <p
                role="alert"
                className="mt-5 text-[13px] leading-[1.55] text-warn"
              >
                {error}
              </p>
            )}
          </div>
        </Panel>
      </div>
    </section>
  );
}

/* ── the roster ───────────────────────────────────────────────────────────
   Read only tonight. Invites are a real feature with a real email path behind
   them, and a button that opens nothing is worse than a sentence saying so. */

type LoadState = "loading" | "ready" | "error";

function Members({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<Member[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const db = browserClient();
    if (!db) {
      setState("error");
      setError(
        "This deployment has no Supabase project attached, so the team could not be loaded.",
      );
      return;
    }

    setState("loading");
    setError("");

    db.from("members")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .then(({ data, error: readError }) => {
        if (cancelled) return;
        if (readError) {
          setState("error");
          setError(`Could not load the team. ${readError.message}`);
          return;
        }
        setRows((data ?? []) as Member[]);
        setState("ready");
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <section>
      <Label>Members</Label>
      <div className="mt-4">
        <Panel title="Team · access">
          {state === "loading" && (
            <p className="px-5 py-6 text-[14px] text-muted sm:px-6">
              Loading the team…
            </p>
          )}

          {state === "error" && (
            <p
              role="alert"
              className="px-5 py-6 text-[14px] leading-[1.6] text-warn sm:px-6"
            >
              {error}
            </p>
          )}

          {state === "ready" && rows.length === 0 && (
            <p className="px-5 py-6 text-[14px] text-muted sm:px-6">
              Nobody is listed on this company yet.
            </p>
          )}

          {state === "ready" && rows.length > 0 && (
            <ul className="divide-y divide-line">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6"
                >
                  <span
                    className={`text-[14.5px] ${
                      row.full_name ? "text-ink" : "text-faint"
                    }`}
                  >
                    {row.full_name || "—"}
                  </span>
                  <span className="shrink-0 font-mono text-[12px] uppercase tracking-[0.06em] text-faint">
                    {row.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <p className="mt-3 text-[12.5px] leading-[1.55] text-faint">
          Inviting people is not built yet. For now a colleague joins by signing
          in with their work email, and an admin sets their role in the
          database.
        </p>
      </div>
    </section>
  );
}
