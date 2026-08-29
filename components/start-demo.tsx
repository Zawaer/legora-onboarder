"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startDerivation } from "./client-api";

/** Honest stage copy — each line is something the agent is genuinely doing. */
const STAGES = [
  { at: 0, text: "Opening the corpus — Slack, docs, tickets, meeting notes" },
  { at: 8, text: "Reading #legal-eng and every channel that touches it" },
  { at: 22, text: "Working out who does this work today, and what they hand off" },
  { at: 38, text: "Deriving responsibilities from what the team actually ships" },
  { at: 55, text: "Checking every claim against a verbatim quote" },
  { at: 72, text: "Discarding every claim with no source behind it" },
  { at: 88, text: "Separating what the company decided from what it never settled" },
  { at: 104, text: "Writing two days of real work, with a done-when for each task" },
  { at: 122, text: "Naming the person to ask when the agent can't help" },
  { at: 140, text: "Assembling the workspace" },
];

export type FeedItem = {
  kind: string;
  source: string;
  author: string;
  snippet: string;
};

export default function StartDemo({
  companySlug = "legora",
  roleTitle = "Legal Engineer",
  companyName = "Legora",
  /**
   * The corpus never names the joiner — they haven't started, so people refer
   * to them as "the person starting sept 1". The demo names them anyway: a
   * header reading "New hire · NH" looks like an unfinished stub in front of a
   * customer, and this is the screen we show them.
   */
  hireName = "Rebecca Hartley",
  feed = [],
}: {
  companySlug?: string;
  roleTitle?: string;
  companyName?: string;
  hireName?: string;
  /** Real lines from the corpus, shown while the derivation runs. */
  feed?: FeedItem[];
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  async function start() {
    if (running) return;
    setError(null);
    setRunning(true);
    setElapsed(0);
    timer.current = setInterval(() => setElapsed((s) => s + 1), 1000);

    try {
      const { id } = await startDerivation({
        companySlug,
        roleTitle,
        name: hireName,
      });
      router.push(`/hire/${id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The derivation failed. Try again.",
      );
      setRunning(false);
      if (timer.current) clearInterval(timer.current);
    }
  }

  const stage =
    [...STAGES].reverse().find((s) => elapsed >= s.at)?.text ?? STAGES[0].text;

  /* Eases toward 95% over a couple of minutes — never claims to be finished
     before it is. */
  const progress = Math.min(95, 100 * (1 - Math.exp(-elapsed / 55)));

  /* One corpus line every ~2.5s, newest first. Nothing is faked: these are the
     actual artifacts the derivation is reading. */
  const shown = feed.length
    ? Array.from(
        { length: Math.min(4, Math.floor(elapsed / 2.5) + 1) },
        (_, i) => feed[(Math.floor(elapsed / 2.5) - i + feed.length * 4) % feed.length],
      )
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={start}
          disabled={running}
          className="group relative inline-flex h-12 items-center gap-3 overflow-hidden rounded-lg bg-ink px-6 text-[15px] font-medium text-paper transition-all hover:opacity-90 disabled:cursor-progress"
        >
          {running && (
            <span
              className="absolute inset-y-0 left-0 bg-accent/35 transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
              aria-hidden
            />
          )}
          <span className="relative flex items-center gap-2.5">
            {running ? (
              <Spinner />
            ) : (
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
                <path
                  d="M4 2.6 12.5 8 4 13.4V2.6Z"
                  fill="currentColor"
                />
              </svg>
            )}
            {running ? "Deriving the role…" : `Derive the ${roleTitle} role`}
          </span>
        </button>

        <p className="max-w-[36ch] text-[12.5px] leading-[1.5] text-faint">
          Runs live against {companyName}&rsquo;s corpus. No cached answer, no
          template, nothing pre-written. Takes about two minutes.
        </p>
      </div>

      {running && (
        <div
          className="rise overflow-hidden rounded-lg border border-line bg-surface"
          style={{ boxShadow: "var(--shadow)" }}
        >
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className="flex shrink-0 items-center gap-1">
              <span className="dot h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="dot h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="dot h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            <span
              className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink"
              aria-live="polite"
            >
              {stage}
            </span>
            <span className="tnum shrink-0 text-[12px] text-faint">
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
            </span>
          </div>

          {shown.length > 0 && (
            <ul className="flex flex-col divide-y divide-line">
              {shown.map((f, i) => (
                <li
                  key={`${f.source}-${f.snippet.slice(0, 12)}-${i}`}
                  className="flex min-w-0 items-baseline gap-3 px-4 py-2.5 transition-opacity"
                  style={{ opacity: 1 - i * 0.22 }}
                >
                  <span className="shrink-0 font-mono text-[11px] text-accent-ink">
                    {f.source}
                  </span>
                  <span className="shrink-0 text-[11.5px] text-faint">
                    {f.author}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
                    {f.snippet}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-warn-line bg-warn-soft px-4 py-3 text-[13px] leading-relaxed text-warn">
          {error}
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 animate-spin" aria-hidden fill="none">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.6" opacity="0.25" />
      <path
        d="M14.25 8A6.25 6.25 0 0 0 8 1.75"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
