"use client";

import { useState } from "react";
import { WAITLIST_BOOKING_URL } from "@/lib/waitlist";

/**
 * The waitlist band.
 *
 * Two asks, sequenced rather than paired. The email is the primary one because
 * almost anyone interested will give it; the call is the stronger signal but
 * asking a cold visitor for twenty minutes up front loses most of them, and
 * they leave no trace when they go. Offering both side by side would just mean
 * everyone takes the cheaper one — so the call is offered on the *success*
 * screen, once the address is banked and there is nothing left to lose by
 * asking for more.
 *
 * Styled as an instrument panel, like the artefact previews elsewhere on the
 * page, so it reads as part of the product rather than an ad pasted onto it.
 */
export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, company, source: "landing" }),
      });
      if (res.ok) {
        setState("done");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Something went wrong. Try again in a moment.");
      setState("error");
    } catch {
      setError("Could not reach us just now. Try again in a moment.");
      setState("error");
    }
  }

  return (
    <section id="waitlist" className="border-t border-line py-14 lg:py-20">
      <div
        className="overflow-hidden rounded-xl border border-line-strong bg-surface"
        style={{ boxShadow: "var(--shadow)" }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-2/70 px-5 py-3">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
            Waitlist · onboarding slots
          </span>
        </div>

        <div className="px-5 py-7 sm:px-8 sm:py-9">
          {state === "done" ? (
            <div className="flex flex-col gap-4">
              <h2 className="text-[24px] font-semibold tracking-[-0.02em] sm:text-[28px]">
                You&rsquo;re on the list.
              </h2>
              <p className="max-w-[56ch] text-[15px] leading-[1.6] text-muted">
                We&rsquo;re rolling out to a small number of fast-scaling
                companies first, and we&rsquo;ll be in touch when it&rsquo;s
                your turn.
              </p>
              {/* The stronger ask, now that the weaker one is banked. */}
              <p className="max-w-[56ch] text-[15px] leading-[1.6] text-muted">
                Want to skip the queue? Twenty minutes on a call and we&rsquo;ll
                set you up on one real role this week.
              </p>
              <a
                href={WAITLIST_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 w-fit items-center gap-2.5 rounded-lg bg-ink px-6 text-[15px] font-medium text-paper transition-opacity hover:opacity-90"
              >
                Book 20 minutes
                <span aria-hidden>→</span>
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between lg:gap-14">
              <div className="lg:pt-1">
                <h2 className="text-[24px] font-semibold tracking-[-0.02em] sm:text-[30px]">
                  Join the waitlist
                </h2>
                <p className="mt-2.5 max-w-[46ch] text-[15px] leading-[1.6] text-muted">
                  We&rsquo;re rolling out to a limited number of fast-scaling
                  companies first. Leave an email and we&rsquo;ll come to you
                  when it&rsquo;s your turn.
                </p>
              </div>

              <form
                onSubmit={submit}
                className="flex w-full max-w-[420px] shrink-0 flex-col gap-2.5"
              >
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    aria-label="Your email"
                    className="h-12 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3.5 text-[15px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={state === "sending"}
                    className="h-12 shrink-0 rounded-lg bg-ink px-5 text-[15px] font-medium text-paper transition-opacity hover:opacity-90 disabled:cursor-progress disabled:opacity-70"
                  >
                    {state === "sending" ? "Adding…" : "Join"}
                  </button>
                </div>

                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company (optional)"
                  aria-label="Company, optional"
                  className="h-11 rounded-lg border border-line bg-paper px-3.5 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                />

                {state === "error" && (
                  <p role="alert" className="text-[13px] leading-[1.5] text-warn">
                    {error}
                  </p>
                )}

                <p className="mt-0.5 text-[12.5px] leading-[1.5] text-faint">
                  Your address is used to contact you about VANAV and nothing
                  else.{" "}
                  <a
                    href="/privacy"
                    className="underline decoration-line-strong underline-offset-2 hover:text-muted"
                  >
                    Privacy
                  </a>
                  .
                </p>

                <p className="text-[12.5px] leading-[1.5] text-faint">
                  Or, if you&rsquo;d rather talk now —{" "}
                  <a
                    href={WAITLIST_BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-ink underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
                  >
                    book 20 minutes
                  </a>
                  .
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
