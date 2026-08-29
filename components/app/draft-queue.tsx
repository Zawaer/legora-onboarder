"use client";

/**
 * The review queue: everything the agent wants to say to a new hire, held
 * until somebody at the customer says yes.
 *
 * This is the screen two buyers named as their gate, so it is built around
 * their question rather than around the data. The question is not "how many
 * drafts are there", it is "what exactly is this thing about to say to my
 * staff, and can I stop it". So the body of every draft is on screen in full,
 * unclamped and untruncated: a queue that hides the message behind a "show
 * more" is asking for approval of something unread, which is the opposite of
 * the control being bought.
 *
 * Reads go through browserClient(), which carries the signed-in session, so
 * the row-level policies in supabase/schema.sql do the filtering. Writes go
 * through /api/app/drafts, which re-checks admin membership server side.
 */

import { useEffect, useState } from "react";
import { browserClient, type Draft } from "@/lib/supabase";
import { Label, Spinner, agoFrom } from "@/components/ui";

type Decision = "approve" | "reject";
type Phase = "loading" | "ready" | "unconfigured" | "failed";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Deterministic and locale-stable, like clockTime() in components/ui. */
function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${hh}:${mm}`;
}

/** `kind` is free text from whatever queued the draft. Make it readable. */
function kindLabel(kind: string): string {
  return kind.replace(/[_-]+/g, " ").trim() || "Draft";
}

export default function DraftQueue({
  companyId,
  canDecide,
}: {
  companyId: string;
  canDecide: boolean;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [tally, setTally] = useState({ approved: 0, rejected: 0 });

  useEffect(() => {
    const db = browserClient();
    if (!db) {
      setPhase("unconfigured");
      return;
    }
    let cancelled = false;
    (async () => {
      // Oldest first. The person at the top of this list is the one who has
      // been waiting longest for an answer, and newest-first would bury them.
      const { data, error: err } = await db
        .from("drafts")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setPhase("failed");
        return;
      }
      setDrafts((data ?? []) as Draft[]);
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  async function decide(draft: Draft, action: Decision, editedBody?: string) {
    if (!canDecide || busyId) return;

    // Remember where it sat so a failure can put it back exactly there rather
    // than at the end, which would look like a different draft arriving.
    const index = drafts.findIndex((d) => d.id === draft.id);

    setBusyId(draft.id);
    setError("");
    setEditingId(null);
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));

    try {
      const db = browserClient();
      const token = (await db?.auth.getSession())?.data.session?.access_token;
      const res = await fetch("/api/app/drafts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          draftId: draft.id,
          action,
          ...(editedBody ? { editedBody } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "The decision did not go through.");
      }
      setTally((t) =>
        action === "approve"
          ? { ...t, approved: t.approved + 1 }
          : { ...t, rejected: t.rejected + 1 },
      );
    } catch (e) {
      setDrafts((prev) => {
        const next = prev.slice();
        next.splice(index < 0 ? next.length : Math.min(index, next.length), 0, draft);
        return next;
      });
      const why = e instanceof Error ? e.message : "The decision did not go through.";
      setError(`${why} Nothing was sent, and the draft is back in the queue.`);
    } finally {
      // In finally rather than on each path: a throw between the two returns
      // above would otherwise leave every button disabled for good.
      setBusyId(null);
    }
  }

  function startEdit(draft: Draft) {
    setEditingId(draft.id);
    setEditText(draft.body);
  }

  const waiting = drafts.length;

  return (
    <section
      className="overflow-hidden rounded-xl border border-line-strong bg-surface"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-2/70 px-5 py-3">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
          Review queue
        </span>
        {phase === "ready" && waiting > 0 && (
          <span className="font-mono text-[11px] text-faint">
            <span className="tnum">{waiting}</span> waiting
          </span>
        )}
      </div>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {phase === "loading" && (
          <p className="flex items-center gap-2.5 text-[14px] text-faint">
            <Spinner />
            Loading the queue.
          </p>
        )}

        {phase === "unconfigured" && (
          <p className="max-w-[64ch] text-[14px] leading-[1.65] text-muted">
            This deployment has no Supabase project attached, so there is no
            queue to show.
          </p>
        )}

        {phase === "failed" && (
          <p role="alert" className="max-w-[64ch] text-[14px] leading-[1.65] text-warn">
            The queue could not be loaded. {error}
          </p>
        )}

        {phase === "ready" && (
          <>
            {!canDecide && (
              <p className="mb-5 max-w-[72ch] text-[13.5px] leading-[1.6] text-faint">
                Read only. Approving, editing and rejecting are admin actions.
              </p>
            )}

            {error && (
              <p
                role="alert"
                aria-live="polite"
                className="mb-5 max-w-[72ch] text-[13.5px] leading-[1.6] text-warn"
              >
                {error}
              </p>
            )}

            {waiting === 0 ? (
              <EmptyState canDecide={canDecide} />
            ) : (
              <div className="flex flex-col gap-4">
                {drafts.map((d) => (
                  <article
                    key={d.id}
                    className="rounded-lg border border-line bg-paper px-4 py-4 sm:px-5 sm:py-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                      <div>
                        <Label>{kindLabel(d.kind)}</Label>
                        <p className="mt-2.5 text-[15px] font-medium text-ink">
                          For {d.hire_ref}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                        <span className="font-mono text-[12px] text-faint">
                          Drafted {stamp(d.created_at)}
                        </span>
                        <span className="font-mono text-[11px] text-faint">
                          {agoFrom(d.created_at)}
                        </span>
                      </div>
                    </div>

                    {editingId === d.id ? (
                      <div className="mt-4">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          aria-label={`Edit the message for ${d.hire_ref}`}
                          rows={Math.min(24, Math.max(6, editText.split("\n").length + 2))}
                          className="w-full resize-y rounded-lg border border-line bg-surface px-3.5 py-3 text-[14.5px] leading-[1.65] text-ink focus:border-accent focus:outline-none"
                        />
                        <p className="mt-2 max-w-[72ch] text-[12.5px] leading-[1.55] text-faint">
                          Your edit is saved next to the original, not over it,
                          so what the agent actually wrote stays answerable
                          later.
                        </p>
                        <div className="mt-3.5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={busyId !== null || editText.trim().length === 0}
                            onClick={() => decide(d, "approve", editText.trim())}
                            className="h-9 rounded-lg bg-ink px-4 text-[13.5px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            Save and approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => setEditingId(null)}
                            className="h-9 rounded-lg border border-line-strong bg-surface px-4 text-[13.5px] text-muted transition-colors hover:text-ink disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // The whole message, wrapped as written. No clamp: this
                      // is the thing being approved.
                      <p className="mt-4 max-w-[80ch] whitespace-pre-wrap break-words text-[14.5px] leading-[1.65] text-muted">
                        {d.body}
                      </p>
                    )}

                    {canDecide && editingId !== d.id && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => decide(d, "approve")}
                          className="h-9 rounded-lg bg-ink px-4 text-[13.5px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => startEdit(d)}
                          className="h-9 rounded-lg border border-line-strong bg-surface px-4 text-[13.5px] font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
                        >
                          Edit and approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => decide(d, "reject")}
                          className="h-9 rounded-lg border border-line-strong bg-surface px-4 text-[13.5px] text-muted transition-colors hover:text-warn disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}

            {/* A card vanishing the instant it is clicked is the right feel and
                the wrong feedback. This line is the receipt. */}
            {(tally.approved > 0 || tally.rejected > 0) && (
              <p aria-live="polite" className="mt-5 text-[13px] text-faint">
                This session: <span className="tnum">{tally.approved}</span>{" "}
                approved, <span className="tnum">{tally.rejected}</span> rejected.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function EmptyState({ canDecide }: { canDecide: boolean }) {
  // Two different truths. For an admin, empty means the agent handled it. For
  // anyone else, empty is what the read policy in schema.sql returns whatever
  // is actually queued, and saying "nothing is waiting" there would be a claim
  // this component cannot make.
  if (!canDecide) {
    return (
      <div className="max-w-[68ch]">
        <p className="text-[15px] font-medium text-ink">
          This queue is visible to admins.
        </p>
        <p className="mt-2 text-[14px] leading-[1.65] text-muted">
          A draft is a decision being taken about a colleague, so the database
          returns these rows to your company admins and to nobody else.
        </p>
      </div>
    );
  }
  return (
    <div className="max-w-[68ch]">
      <p className="text-[15px] font-medium text-ink">Nothing is waiting.</p>
      <p className="mt-2 text-[14px] leading-[1.65] text-muted">
        This is the normal state. The agent answers most of what a new hire
        asks on its own, and holds a message back only when it wants a person
        to see it first. Anything it holds back appears here.
      </p>
    </div>
  );
}
