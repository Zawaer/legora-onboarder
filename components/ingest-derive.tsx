"use client";

/**
 * The confirmation step: spend the money, or don't.
 *
 * Deriving is two Opus calls over the entire corpus — roughly two to three
 * minutes and a dollar or two, every time the corpus changes. That is a real
 * cost to a real customer, so it never fires as a side effect of an upload. It
 * fires here, from a button that says what it will cost, after the person has
 * seen what we understood from their data.
 *
 * The waiting state is deliberately not a bare spinner: the stage lines below
 * are the actual sequence lib/agent runs, and the channel names in them come
 * from the corpus that was just parsed — never from a hard-coded demo script.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startDerivation } from "./client-api";
import { Panel } from "./ui";
import type { IngestResult } from "./ingest-form";

/** Seconds into the run, and what is genuinely happening at that point. */
function stagesFor(result: IngestResult): { at: number; text: string }[] {
  const top = result.channels.slice(0, 2).map((c) => c.channel);
  const channels = top.length ? top.join(" and ") : "every channel you gave us";
  const people = result.people
    .slice(0, 2)
    .map((p) => p.name)
    .join(" and ");

  return [
    { at: 0, text: `Opening ${result.artifactCount.toLocaleString()} artifacts from ${result.name}` },
    { at: 8, text: `Reading ${channels} and everything that touches them` },
    {
      at: 22,
      text: people
        ? `Working out what ${people} do today, and what they hand off`
        : "Working out who does this work today, and what they hand off",
    },
    { at: 38, text: "Deriving responsibilities from what the team actually ships" },
    { at: 55, text: "Checking every claim against a verbatim quote from your corpus" },
    { at: 72, text: "Discarding every claim with no source behind it" },
    { at: 88, text: "Separating what your company decided from what it never settled" },
    { at: 104, text: "Writing two days of real work, with a done-when for each task" },
    { at: 122, text: "Naming the person to ask when the agent can't help" },
    { at: 140, text: "Assembling the workspace" },
  ];
}

export default function IngestDerive({ result }: { result: IngestResult }) {
  const router = useRouter();
  const [hireName, setHireName] = useState("");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const stages = stagesFor(result);

  async function derive() {
    if (running) return;
    setError(null);
    setRunning(true);
    setElapsed(0);
    timer.current = setInterval(() => setElapsed((s) => s + 1), 1000);

    try {
      const { id } = await startDerivation({
        companySlug: result.slug,
        roleTitle: result.roleTitle,
        name: hireName.trim() || "New hire",
      });
      router.push(`/hire/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The derivation failed. Try again.");
      setRunning(false);
      if (timer.current) clearInterval(timer.current);
    }
  }

  const stage = [...stages].reverse().find((s) => elapsed >= s.at)?.text ?? stages[0].text;
  /* Eases toward 95% over a couple of minutes — never claims to be finished
     before it is. */
  const progress = Math.min(95, 100 * (1 - Math.exp(-elapsed / 55)));

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">
            Derive the {result.roleTitle} role from this corpus
          </h2>
          <p className="max-w-[68ch] text-[13.5px] leading-[1.6] text-muted">
            Two model calls over all {result.artifactCount.toLocaleString()} artifacts:
            about two to three minutes, and one to two dollars of inference. Nothing
            is derived until you press this. If the numbers above look wrong, fix the
            export first — a derivation from the wrong corpus costs the same as a
            derivation from the right one.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <input
            value={hireName}
            onChange={(e) => setHireName(e.target.value)}
            placeholder="Who is starting? (optional)"
            disabled={running}
            className="h-12 w-full rounded-lg border border-line bg-surface-2/40 px-3.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-line-strong disabled:opacity-50 sm:w-[240px]"
          />

          <button
            type="button"
            onClick={derive}
            disabled={running}
            className="group relative inline-flex h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-lg bg-ink px-6 text-[15px] font-medium text-paper transition-all hover:opacity-90 disabled:cursor-progress sm:w-auto"
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
                  <path d="M4 2.6 12.5 8 4 13.4V2.6Z" fill="currentColor" />
                </svg>
              )}
              {running ? "Deriving the role…" : `Derive the ${result.roleTitle} role`}
            </span>
          </button>
        </div>

        {running && (
          <div className="rise overflow-hidden rounded-lg border border-line bg-surface-2/40">
            <div className="flex items-center gap-3 px-4 py-3">
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

            {result.sample.length > 0 && (
              <ul className="flex flex-col divide-y divide-line border-t border-line">
                {Array.from({ length: Math.min(4, Math.floor(elapsed / 2.5) + 1) }, (_, i) => {
                  const index =
                    (Math.floor(elapsed / 2.5) - i + result.sample.length * 4) % result.sample.length;
                  return result.sample[index];
                }).map((line, i) => (
                  <li
                    key={`${line.source}-${i}`}
                    className="flex min-w-0 items-baseline gap-3 px-4 py-2.5"
                    style={{ opacity: 1 - i * 0.22 }}
                  >
                    <span className="shrink-0 font-mono text-[11px] text-accent-ink">
                      {line.source}
                    </span>
                    <span className="shrink-0 text-[11.5px] text-faint">{line.author}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
                      {line.snippet}
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
    </Panel>
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
