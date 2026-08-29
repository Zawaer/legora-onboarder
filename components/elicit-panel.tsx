"use client";

/**
 * The expert's side of the loop.
 *
 * ── WHAT THIS SCREEN IS COMPETING WITH ───────────────────────────────────────
 *
 * Not another tool. It is competing with the expert closing the tab. They are
 * mid-deal, somebody they have never met is asking them a question, and every
 * second of friction here is a reason to deal with it later — which means never,
 * which means the hire stays blocked and the knowledge stays in one head.
 *
 * So the whole design constraint is a number: under a minute, end to end,
 * including the correction. That is why there is one primary action visible at a
 * time, why the mic sits next to the box rather than behind a mode switch, and
 * why the teachback is four lines you tap rather than a form you fill in.
 * Anything added to this screen has to pay for its seconds.
 *
 * ── WHY THE TEACHBACK STEP IS NOT SKIPPABLE ──────────────────────────────────
 *
 * Because a spoken answer, transcribed, is wrong in small ways — and once it is
 * sitting in the corpus attributed to a named senior person, a new hire has no
 * way to tell which parts. The correction is one line and it is where the
 * accuracy comes from. There is deliberately no "just save it, skip the check"
 * path in this component; confirming *unchanged* is a review too, and it is
 * recorded as one.
 *
 * ── WHAT THE HIRE SEES ───────────────────────────────────────────────────────
 *
 * `ElicitStatus`, at the bottom of this file. It never implies an answer exists
 * while the request is out. That is not a nicety — the failure it prevents is a
 * new hire sitting and waiting on something they have been led to believe is
 * coming, which is worse than being told plainly that nobody has written it down.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Label, Panel, Pill, agoFrom } from "./ui";
import VoiceInput from "./voice-input";

/* ── the shapes this component reads. Deliberately loose: the route is the
      authority, and a UI that hard-fails on an extra field is a UI that breaks
      the moment the API grows. ─────────────────────────────────────────────── */

type Probe = { id: string; label: string; text: string };

export type Elicitation = {
  id: string;
  companySlug: string;
  hireId?: string;
  hireName?: string;
  hireRole?: string;
  blockerId?: string;
  question: string;
  expert: { name: string; role: string; team: string; slackHandle: string };
  expertWhy: string;
  routing: "ranked" | "roster";
  tier?: "peer" | "expert";
  askedBefore?: string[];
  expertEvidence?: Array<{ artifactId: string; quote: string; channel?: string; timestamp: string; signal: string }>;
  anchor?: { artifactId: string; quote: string; channel?: string; timestamp: string };
  probes: Probe[];
  requestText: string;
  estimatedSeconds: number;
  createdAt: string;
  status: "requested" | "answered" | "confirmed" | "declined";
  answer?: { text: string; via: "voice" | "text"; at: string; durationMs?: number };
  teachback?: {
    draft: { lines: string[]; uncertain: string[]; source: "model" | "extractive" };
    shown: string;
    correction?: { line?: number; text: string };
    finalLines: string[];
    confirmedAt?: string;
    outcome?: "corrected" | "unchanged";
  };
  followUpSent?: string;
  declinedReason?: string;
  artifactId?: string;
};

type Artifact = { id: string; kind: string; author: string; authorRole?: string; timestamp: string; title?: string; text: string };
type Proof = { grounded: boolean; evidence: { artifactId: string; quote: string } | null; artifact: Artifact | null };

/* ── network ───────────────────────────────────────────────────────────────── */

async function post(body: unknown) {
  const res = await fetch("/api/elicit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw new Error(
      (typeof json?.error === "string" && json.error) || `${res.status} ${res.statusText}`,
    );
  }
  return json ?? {};
}

/* ══════════════════════════════════════════════════ the expert's screen ══ */

export default function ElicitPanel({
  elicitation,
  proof: initialProof = null,
  onChange,
}: {
  elicitation: Elicitation;
  proof?: Proof | null;
  onChange?: (next: Elicitation) => void;
}) {
  const [record, setRecord] = useState<Elicitation>(elicitation);
  const [proof, setProof] = useState<Proof | null>(initialProof);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<null | "answer" | "confirm" | "decline">(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [followUp, setFollowUp] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setRecord(elicitation);
    setProof(initialProof);
  }, [elicitation, initialProof]);

  const update = useCallback(
    (next: Elicitation) => {
      setRecord(next);
      onChange?.(next);
    },
    [onChange],
  );

  const submitAnswer = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy("answer");
    setError(null);
    try {
      const out = await post({ action: "answer", id: record.id, text });
      update(out.elicitation as Elicitation);
      const f = out.followUp as { text: string } | null | undefined;
      setFollowUp(f?.text ?? null);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't send.");
    } finally {
      setBusy(null);
    }
  }, [busy, draft, record.id, update]);

  const confirm = useCallback(
    async (correction?: { line: number; text: string }) => {
      if (busy) return;
      setBusy("confirm");
      setError(null);
      try {
        const out = await post({
          action: "confirm",
          id: record.id,
          ...(correction ? { line: correction.line, correction: correction.text } : {}),
        });
        update(out.elicitation as Elicitation);
        setProof((out.proof as Proof) ?? null);
        setEditing(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "That didn't save.");
      } finally {
        setBusy(null);
      }
    },
    [busy, record.id, update],
  );

  const decline = useCallback(async () => {
    if (busy) return;
    setBusy("decline");
    setError(null);
    try {
      const out = await post({
        action: "decline",
        id: record.id,
        reason: draft.trim() || undefined,
      });
      update(out.elicitation as Elicitation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't send.");
    } finally {
      setBusy(null);
    }
  }, [busy, draft, record.id, update]);

  const lines = record.teachback?.finalLines ?? record.teachback?.draft.lines ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Header record={record} />

      {record.status === "requested" && (
        <>
          <TheAsk record={record} />

          <Panel className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Label>Your answer</Label>
              <span className="text-[11.5px] text-faint">
                Speak it — that&rsquo;s faster than typing, and you can fix the transcript before it sends.
              </span>
            </div>

            <div className="mt-3 flex items-end gap-2">
              <textarea
                ref={box}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void submitAnswer();
                  }
                }}
                rows={5}
                /* Matches the server's cap, so a long answer is stopped at the
                   keyboard rather than lost to a 400 after they hit send. */
                maxLength={8000}
                placeholder="Tell me what happened — the sequence, what you saw, what you did."
                className="min-h-[110px] flex-1 resize-y rounded-lg border border-line bg-paper px-3.5 py-3 text-[14.5px] leading-[1.6] outline-none placeholder:text-faint focus:border-line-strong"
              />
              {/* The verified mic. Transcript lands here editable — never auto-sent. */}
              <VoiceInput
                onTranscript={(t) => {
                  setDraft((d) => (d.trim() ? `${d.trim()} ${t}` : t));
                  box.current?.focus();
                }}
                disabled={busy !== null}
                className="pb-1"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => void submitAnswer()}
                disabled={!draft.trim() || busy !== null}
                className="inline-flex h-10 items-center rounded-lg bg-ink px-5 text-[14px] font-medium text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {busy === "answer" ? "Reading it back…" : "Send it"}
              </button>
              <span className="text-[11.5px] text-faint">⌘↵</span>

              {/* Refusal is a real button, the same size as the other one, and
                  it routes the question onward rather than ending it. An ask you
                  cannot decline is an ask people learn to ignore — and ignoring
                  is the outcome that leaves the newcomer waiting forever. */}
              <button
                type="button"
                onClick={() => void decline()}
                disabled={busy !== null}
                className="ml-auto inline-flex h-10 items-center rounded-lg border border-line bg-surface px-4 text-[13.5px] text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
              >
                {busy === "decline" ? "Passing it on…" : "Not me — pass it on"}
              </button>
            </div>

            <p className="mt-2 text-[11.5px] leading-[1.55] text-faint">
              Passing it on costs nothing and is genuinely useful — it goes to the next person who
              has worked on this, and {record.hireName?.split(/\s+/)[0] ?? "they"} finds out either
              way. Type a word in the box first if you want to say who instead.
            </p>

            {error && (
              <p className="mt-3 rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
                {error}
              </p>
            )}
          </Panel>
        </>
      )}

      {record.status === "answered" && record.teachback && (
        <>
          {followUp && (
            <div className="rounded-xl border border-accent/25 bg-accent-soft px-4 py-3">
              <Label className="!text-accent-ink">One more, if you have ten seconds</Label>
              <p className="mt-1.5 text-[13.5px] leading-[1.6] text-ink">{followUp}</p>
              <button
                type="button"
                onClick={() => setFollowUp(null)}
                className="mt-2 text-[12px] text-accent-ink/80 underline-offset-2 hover:underline"
              >
                Skip — check the write-up instead
              </button>
            </div>
          )}

          <Panel className="p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline gap-2">
              <Label>Here&rsquo;s what I understood</Label>
              <span className="text-[11.5px] text-faint">
                Tap the line that&rsquo;s wrong. Nothing is stored until you say so.
              </span>
            </div>

            <ol className="mt-3.5 flex flex-col gap-1.5">
              {record.teachback.draft.lines.map((line, i) => {
                const uncertain = record.teachback?.draft.uncertain.includes(line);
                const isEditing = editing === i;
                return (
                  <li key={i} className="flex gap-3">
                    <span className="tnum mt-[7px] w-4 shrink-0 text-right text-[12px] text-faint">
                      {i + 1}
                    </span>
                    {isEditing ? (
                      <div className="flex-1">
                        <textarea
                          autoFocus
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={3}
                          className="w-full resize-y rounded-lg border border-accent/40 bg-paper px-3 py-2 text-[14px] leading-[1.6] outline-none"
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void confirm({ line: i + 1, text: editText })}
                            disabled={!editText.trim() || busy !== null}
                            className="inline-flex h-9 items-center rounded-lg bg-ink px-4 text-[13px] font-medium text-paper hover:opacity-90 disabled:opacity-30"
                          >
                            {busy === "confirm" ? "Saving…" : "Save this correction"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="text-[12.5px] text-muted hover:text-ink"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(i);
                          setEditText(line);
                        }}
                        className={`flex-1 rounded-lg border px-3 py-2 text-left text-[14px] leading-[1.6] transition-colors ${
                          uncertain
                            ? "border-warn-line bg-warn-soft/60 hover:border-warn/40"
                            : "border-transparent hover:border-line hover:bg-surface-2"
                        }`}
                      >
                        {line}
                        {uncertain && (
                          <span className="ml-2 align-middle text-[11px] text-warn">
                            — least sure about this one
                          </span>
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={busy !== null || editing !== null}
                className="inline-flex h-10 items-center rounded-lg border border-ok-line bg-ok-soft px-5 text-[14px] font-medium text-ok transition-colors hover:border-ok/40 disabled:opacity-40"
              >
                {busy === "confirm" ? "Writing it down…" : "That's right — write it down"}
              </button>
              <span className="text-[12px] text-faint">
                {record.answer?.via === "voice" ? "Captured by voice" : "Captured as text"}
                {record.answer?.durationMs
                  ? ` · ${Math.round(record.answer.durationMs / 1000)}s of speech`
                  : ""}
                {record.teachback.draft.source === "extractive" ? " · read back verbatim" : ""}
              </span>
            </div>

            {error && (
              <p className="mt-3 rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
                {error}
              </p>
            )}
          </Panel>
        </>
      )}

      {record.status === "confirmed" && (
        <Panel className="overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-ok-line bg-ok-soft px-4 py-3 sm:px-5">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0 text-ok" aria-hidden>
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M4.75 8.2 7 10.4l4.25-4.6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[13.5px] font-medium text-ok">
              In the corpus. That took {Math.round((record.estimatedSeconds ?? 55) / 5) * 5}s of your time.
            </span>
            {record.artifactId && (
              <span className="ml-auto font-mono text-[11px] text-ok/80">{record.artifactId}</span>
            )}
          </div>

          <div className="px-4 py-4 sm:px-5">
            <ol className="flex flex-col gap-1.5">
              {lines.map((line, i) => (
                <li key={i} className="flex gap-3 text-[14px] leading-[1.6]">
                  <span className="tnum w-4 shrink-0 text-right text-[12px] text-faint">{i + 1}</span>
                  <span
                    className={
                      record.teachback?.correction &&
                      record.teachback.correction.line === i + 1
                        ? "flex-1 rounded bg-accent-soft px-1.5 text-ink"
                        : "flex-1"
                    }
                  >
                    {line}
                  </span>
                </li>
              ))}
            </ol>

            <p className="mt-4 border-t border-line pt-3.5 text-[12.5px] leading-[1.6] text-muted">
              Attributed to <span className="text-ink">{record.expert.name}</span> ({record.expert.role}).{" "}
              {record.teachback?.outcome === "corrected"
                ? `You corrected line ${record.teachback.correction?.line ?? "one"} before it was stored.`
                : "You read it back and confirmed it unchanged before it was stored."}{" "}
              {record.hireName ? `${record.hireName} has it now, ` : ""}and it is there for whoever asks next.
            </p>

            {proof && (
              <p
                className={`mt-3 rounded-md border px-3 py-2 text-[12px] leading-[1.55] ${
                  proof.grounded
                    ? "border-ok-line bg-ok-soft text-ok"
                    : "border-warn-line bg-warn-soft text-warn"
                }`}
              >
                {proof.grounded
                  ? "Verified: the agent can now cite this the same way it cites a Slack message — the quote checks out as a literal substring of the stored artifact."
                  : "Stored, but the citation check did not pass — the agent will not quote this until it does."}
              </p>
            )}
          </div>
        </Panel>
      )}

      {record.status === "declined" && (
        <Panel className="px-4 py-4 sm:px-5">
          <Label>Passed on</Label>
          <p className="mt-2 text-[14px] leading-[1.6] text-ink">
            Thanks — that was useful.
            {record.declinedReason ? ` (“${record.declinedReason}”)` : ""}
          </p>
          {/*
            Deliberately claims nothing about where this goes next.

            An earlier draft branched on a `rerouted` target, but the record
            carries no such field — routing onward is not wired yet. Telling an
            expert "it's gone to Priya instead" when it has not, or "nobody else
            has worked on this" when we never checked, are the same failure as an
            unverified citation: a confident sentence with nothing behind it.
            Declining has to be free and final for the person declining; what
            happens after is not something to invent on their screen.
          */}
          <p className="mt-2 text-[13px] leading-[1.6] text-muted">
            This won&rsquo;t come back to you. Nothing more to do here.
          </p>
        </Panel>
      )}
    </div>
  );
}

/* ── the header: who is asking, and why you ─────────────────────────────────── */

function Header({ record }: { record: Elicitation }) {
  const who = record.hireName ?? "Someone who just joined";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={record.status === "confirmed" ? "ok" : "accent"}>
          {record.status === "requested"
            ? `~${record.estimatedSeconds}s`
            : record.status === "answered"
              ? "One line to check"
              : record.status === "confirmed"
                ? "Done"
                : "Passed on"}
        </Pill>
        <span className="text-[12.5px] text-muted">
          for <span className="text-ink">{record.expert.name}</span>
        </span>
        <span className="ml-auto text-[11.5px] text-faint">{agoFrom(record.createdAt)}</span>
      </div>

      {/* The person, first and largest. Not the question, not the product. The
          attribution of an ask changes whether it gets answered — see the note
          at the top of buildRequest in lib/agent/elicit.ts. */}
      <h1 className="max-w-[52ch] text-[20px] leading-[1.3] font-semibold tracking-[-0.02em] text-balance sm:text-[23px]">
        {who} is stuck on something you&rsquo;ve dealt with.
      </h1>

      <blockquote className="max-w-[62ch] border-l-2 border-line-strong pl-3.5 text-[15px] leading-[1.55] text-ink">
        {record.question}
      </blockquote>

      <p className="max-w-[64ch] text-[12.5px] leading-[1.6] text-muted">
        {record.hireRole ? `They started recently as a ${record.hireRole}. ` : ""}
        It isn&rsquo;t written down anywhere.{" "}
        {record.routing === "roster" ? (
          <span className="text-warn">
            Nobody has worked on this anywhere in the corpus — you were picked because{" "}
            {record.expert.name.split(/\s+/)[0]} {record.expertWhy} If that&rsquo;s wrong, passing it
            on is the most useful thing you can do.
          </span>
        ) : record.tier === "peer" ? (
          <>
            You&rsquo;ve worked on this and you&rsquo;re deliberately not the person everyone routes
            these to — they only get asked if this comes back empty.
          </>
        ) : (
          <>You came up because of what&rsquo;s already in the corpus: {record.expertWhy}</>
        )}
      </p>
    </div>
  );
}

/* ── the ask itself, with the probes made legible ───────────────────────────── */

function TheAsk({ record }: { record: Elicitation }) {
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(() => {
    if (playing) {
      audio.current?.pause();
      setPlaying(false);
      return;
    }
    const el = new Audio(`/api/elicit?id=${encodeURIComponent(record.id)}&speak=1&of=request`);
    audio.current = el;
    el.onended = () => setPlaying(false);
    el.onerror = () => setPlaying(false);
    setPlaying(true);
    void el.play().catch(() => setPlaying(false));
  }, [playing, record.id]);

  useEffect(() => () => audio.current?.pause(), []);

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5 sm:px-5">
        <Label>The ask</Label>
        <span className="text-[11.5px] text-faint">
          Anchored to one thing that actually happened — not &ldquo;describe your process&rdquo;
        </span>
        <button
          type="button"
          onClick={play}
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          {playing ? (
            <>
              <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
                <rect x="4" y="3.5" width="3" height="9" rx="1" fill="currentColor" />
                <rect x="9" y="3.5" width="3" height="9" rx="1" fill="currentColor" />
              </svg>
              Stop
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
                <path d="M5 3.4v9.2L12.5 8 5 3.4Z" fill="currentColor" />
              </svg>
              Listen
            </>
          )}
        </button>
      </div>

      <div className="px-4 py-4 sm:px-5">
        {record.anchor && (
          <blockquote className="mb-4 border-l-2 border-accent/40 pl-3.5">
            <p className="text-[13.5px] leading-[1.6] text-ink italic">
              &ldquo;{record.anchor.quote}&rdquo;
            </p>
            <p className="mt-1 font-mono text-[11px] text-faint">
              {record.expert.name} · {record.anchor.channel ?? "corpus"} ·{" "}
              {record.anchor.artifactId}
            </p>
          </blockquote>
        )}

        <ul className="flex flex-col gap-3">
          {record.probes.map((probe) => (
            <li key={probe.id} className="flex gap-3">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-[1.55] text-ink">{probe.text}</p>
                <p className="mt-0.5 text-[11px] text-faint">{probe.label}</p>
              </div>
            </li>
          ))}
          <li className="flex gap-3">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-[1.55] font-medium text-ink">
                And what would {record.hireName?.split(/\s+/)[0] ?? "they"} have got wrong there?
              </p>
              <p className="mt-0.5 text-[11px] text-faint">
                The one that actually helps them — a newcomer can&rsquo;t get this anywhere else
              </p>
            </div>
          </li>
        </ul>

        <p className="mt-4 border-t border-line pt-3.5 text-[12.5px] leading-[1.6] text-muted">
          Two or three sentences off the top of your head is plenty — please don&rsquo;t go and look
          anything up. Just what happened: what you saw, what you did. Not why it was right.
        </p>
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════ the standalone screen ══ */

/**
 * What `/expert` renders. Two states, because the person opening this link is in
 * one of exactly two situations: they were sent a specific question, or they are
 * looking at the queue.
 *
 * The queue polls, so a request raised on the hire's screen appears here without
 * anybody refreshing anything — which is the only way this works live, on stage
 * or in an office.
 */
export function ExpertScreen({
  id,
  companySlug = "lexhav",
}: {
  id?: string;
  companySlug?: string;
}) {
  const [record, setRecord] = useState<Elicitation | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [queue, setQueue] = useState<Elicitation[]>([]);
  const [captured, setCaptured] = useState(0);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const url = id
          ? `/api/elicit?id=${encodeURIComponent(id)}`
          : `/api/elicit?companySlug=${encodeURIComponent(companySlug)}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!alive) return;
        if (!res.ok) {
          if (id) setMissing(true);
          return;
        }
        const body = (await res.json()) as {
          elicitation?: Elicitation;
          proof?: Proof | null;
          elicitations?: Elicitation[];
          captured?: number;
        };
        if (!alive) return;
        if (id) {
          setRecord(body.elicitation ?? null);
          setProof(body.proof ?? null);
          if (!body.elicitation) setMissing(true);
        } else {
          setQueue(body.elicitations ?? []);
          setCaptured(body.captured ?? 0);
        }
      } catch {
        // Leave whatever is on screen. A failed poll is not a reason to blank a
        // page somebody is about to answer a question on.
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    // Only the queue polls. Once a specific request is open, the panel owns its
    // own state and a poll would fight the expert's half-typed answer.
    const timer = id ? null : setInterval(load, 4000);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [id, companySlug]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 py-16">
        <span className="dot h-2 w-2 rounded-full bg-accent" />
        <span className="dot h-2 w-2 rounded-full bg-accent" />
        <span className="dot h-2 w-2 rounded-full bg-accent" />
      </div>
    );
  }

  if (id && (missing || !record)) {
    return (
      <div className="max-w-[46ch] py-16">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">That question isn&rsquo;t here.</h1>
        <p className="mt-2 text-[14px] leading-[1.6] text-muted">
          The link may be from an older session, or the server restarted.
        </p>
        <Link
          href="/expert"
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-ink px-5 text-[14px] font-medium text-paper hover:opacity-90"
        >
          See what&rsquo;s waiting
        </Link>
      </div>
    );
  }

  if (record) return <ElicitPanel elicitation={record} proof={proof} />;

  const open = queue.filter((r) => r.status === "requested" || r.status === "answered");
  const done = queue.filter((r) => r.status === "confirmed");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="max-w-[24ch] text-[30px] leading-[1.06] font-semibold tracking-[-0.03em] text-balance sm:text-[38px]">
          Somebody new is stuck on something you know.
        </h1>
        <p className="max-w-[62ch] text-[14.5px] leading-[1.65] text-muted">
          One specific question about one thing that actually happened. Under a minute, including the
          bit where you correct what I got wrong — and then it&rsquo;s written down for good, with
          your name on it, and nobody has to ask you again.
        </p>
        {captured > 0 && (
          <p className="text-[12.5px] text-ok">
            {captured} {captured === 1 ? "answer" : "answers"} captured this way so far — all of them
            citable by the agent like any other source.
          </p>
        )}
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${open.length ? "bg-warn" : "bg-line-strong"}`} />
          <Label className={open.length ? "!text-warn" : ""}>Waiting on you</Label>
          <span className="tnum text-[11px] text-faint">{open.length}</span>
        </div>

        {open.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-[13.5px] text-muted">
            Nothing right now. This page fills in on its own when the agent hits something the corpus
            genuinely can&rsquo;t answer.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {open.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/expert?id=${encodeURIComponent(r.id)}`}
                  className="block rounded-xl border border-warn-line bg-surface px-4 py-3.5 transition-colors hover:border-warn/40 sm:px-5"
                  style={{ boxShadow: "var(--shadow)" }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="warn">
                      {r.status === "requested" ? `~${r.estimatedSeconds}s` : "one line to check"}
                    </Pill>
                    <span className="text-[12.5px] text-muted">
                      for <span className="text-ink">{r.expert.name}</span>
                    </span>
                    <span className="ml-auto text-[11.5px] text-faint">{agoFrom(r.createdAt)}</span>
                  </div>
                  <p className="mt-2 max-w-[70ch] text-[15px] leading-[1.5] font-medium tracking-[-0.005em]">
                    {r.question}
                  </p>
                  {r.hireName && (
                    <p className="mt-1 text-[12px] text-faint">
                      {r.hireName} is blocked on this{r.hireRole ? ` · ${r.hireRole}` : ""}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-ok" />
            <Label className="!text-ok">Now in the corpus</Label>
            <span className="tnum text-[11px] text-faint">{done.length}</span>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {done.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
                <Link
                  href={`/expert?id=${encodeURIComponent(r.id)}`}
                  className="min-w-0 flex-1 text-[14px] leading-snug hover:underline"
                >
                  {r.question}
                </Link>
                <span className="text-[12px] text-muted">{r.expert.name}</span>
                <span className="font-mono text-[11px] text-faint">{r.artifactId}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════ the hire's side ══ */

/**
 * What the waiting hire sees.
 *
 * The wording is the feature. While a request is out this says a named person
 * has it and that **nothing is written down yet** — it never says an answer is
 * "on its way", because that implies an answer exists, and it might not. When it
 * lands, the same strip says so and points at the artifact id.
 */
export type BlockerRef = {
  id: string;
  summary: string;
  needsHuman: boolean;
  resolved: boolean;
  suggestedPerson?: string;
};

export function ElicitStatus({
  hireId,
  blockers = [],
  className = "",
  pollMs = 4000,
}: {
  hireId: string;
  /** Open blockers, so an escalation can be turned into an actual question. */
  blockers?: BlockerRef[];
  className?: string;
  pollMs?: number;
}) {
  const [rows, setRows] = useState<Elicitation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/elicit?hireId=${encodeURIComponent(hireId)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = (await res.json()) as { elicitations?: Elicitation[] };
      setRows(body.elicitations ?? []);
    } catch {
      // A dead poll must never take the workspace down with it.
    } finally {
      setLoaded(true);
    }
  }, [hireId]);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (alive) void load();
    };
    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [load, pollMs]);

  const open = useMemo(
    () => rows.filter((r) => r.status === "requested" || r.status === "answered"),
    [rows],
  );
  const landed = useMemo(() => rows.filter((r) => r.status === "confirmed"), [rows]);

  /** Escalations that nobody has actually turned into a question yet. */
  const unasked = useMemo(() => {
    const covered = new Set(rows.map((r) => r.blockerId).filter(Boolean));
    return blockers.filter((b) => b.needsHuman && !b.resolved && !covered.has(b.id));
  }, [blockers, rows]);

  const ask = useCallback(
    async (blockerId: string) => {
      if (asking) return;
      setAsking(blockerId);
      setProblem(null);
      try {
        const out = await post({ action: "create", hireId, blockerId });
        // A null elicitation is not a failure — it is the honest "we could not
        // work out who knows this" answer, and it has to be shown as such.
        if (!out.elicitation) setProblem(String(out.reason ?? "Nobody could be identified."));
        await load();
      } catch (err) {
        setProblem(err instanceof Error ? err.message : "That didn't send.");
      } finally {
        setAsking(null);
      }
    },
    [asking, hireId, load],
  );

  if (!loaded || (rows.length === 0 && unasked.length === 0)) return null;

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <Label>{rows.length ? "Out with a human" : "Escalated — nothing written down"}</Label>

      {unasked.map((b) => (
        <div key={b.id} className="rounded-xl border border-line bg-surface px-4 py-3">
          <p className="text-[13.5px] leading-[1.55] text-ink">{b.summary}</p>
          <p className="mt-1.5 text-[12px] leading-[1.55] text-muted">
            Escalating gets {b.suggestedPerson ?? "someone"} to unblock this once. Asking them one
            specific question about a time it came up — under a minute — gets it written into the
            corpus so nobody has to ask again.
          </p>
          <button
            type="button"
            onClick={() => void ask(b.id)}
            disabled={asking !== null}
            className="mt-2.5 inline-flex h-9 items-center rounded-lg bg-ink px-4 text-[13px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {asking === b.id
              ? "Working out who knows this…"
              : `Ask ${b.suggestedPerson?.split(/\s+/)[0] ?? "whoever knows"} properly`}
          </button>
        </div>
      ))}

      {problem && (
        <p className="rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-[12.5px] leading-[1.55] text-warn">
          {problem}
        </p>
      )}

      {open.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-warn-line bg-warn-soft px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="dot h-1.5 w-1.5 rounded-full bg-warn" />
            <span className="text-[13px] font-medium text-warn">
              {r.status === "requested"
                ? `Asked ${r.expert.name}`
                : `${r.expert.name} answered — checking my write-up with them`}
            </span>
            <span className="ml-auto text-[11.5px] text-warn/80">{agoFrom(r.createdAt)}</span>
          </div>
          <p className="mt-1.5 text-[13.5px] leading-[1.55] text-ink">{r.question}</p>
          <p className="mt-1.5 text-[12px] leading-[1.5] text-warn/90">
            Nothing is written down yet. I&rsquo;ll tell you here the moment it comes back and
            they&rsquo;ve checked it — I&rsquo;m not going to guess at it in the meantime.
          </p>
          <Link
            href={`/expert?id=${encodeURIComponent(r.id)}`}
            className="mt-2 inline-block text-[12px] text-warn underline-offset-2 hover:underline"
          >
            See exactly what was asked →
          </Link>
        </div>
      ))}

      {landed.map((r) => (
        <div key={r.id} className="rounded-xl border border-ok-line bg-ok-soft px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            <span className="text-[13px] font-medium text-ok">
              {r.expert.name} answered, and checked it
            </span>
            {r.artifactId && (
              <span className="ml-auto font-mono text-[11px] text-ok/80">{r.artifactId}</span>
            )}
          </div>
          <p className="mt-1.5 text-[13.5px] leading-[1.55] text-ink">{r.question}</p>
          <p className="mt-1.5 text-[12px] leading-[1.5] text-ok/90">
            It&rsquo;s in the corpus now, attributed to them. I can cite it like anything else — and so
            can whoever starts next.
          </p>
        </div>
      ))}
    </div>
  );
}
