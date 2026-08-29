"use client";

/**
 * The three-way breakdown.
 *
 * Reading order is the whole design: contradicted, then silent, then supported.
 * Supported claims are the least interesting thing on the page — they are the
 * posting agreeing with itself — and putting them first would bury the finding
 * under a wall of green ticks. Silent sits in the middle rather than at the
 * bottom because it is a result, not a remainder.
 *
 * Every card leads with the posting's own words, verbatim, and puts the quote
 * from the corpus directly underneath with a name, a room and a date on it. The
 * gap between the two lines is the product; nothing here needs to editorialise
 * about it, and nothing here does.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Label, Panel, Pill, Spinner } from "./ui";

/* ─────────────────────────────────────────────────────────────────── types
   Structural mirrors of lib/agent/jd-contradiction.ts. Declared here rather
   than imported so this file never drags a server module (and its API key
   read) into the client bundle. */

type Verdict = "supported" | "contradicted" | "silent";

type Evidence = { artifactId: string; quote: string; why: string };

type Claim = {
  id: string;
  quote: string;
  proposition: string;
  verdict: Verdict;
  observation: string;
  blindSpot?: string;
  evidence: Evidence[];
};

type Source = {
  id: string;
  kind: string;
  author: string;
  timestamp: string;
  channel?: string;
  title?: string;
};

type Coverage = {
  artifacts: number;
  people: number;
  channels: string[];
  kinds: string[];
  from: string;
  to: string;
};

type Check = {
  companySlug: string;
  companyName: string;
  claims: Claim[];
  summary: {
    total: number;
    supported: number;
    contradicted: number;
    silent: number;
    downgraded: number;
    inventedClaims: number;
    droppedCitations: number;
  };
  coverage: Coverage;
  sources: Record<string, Source>;
  generatedAt: string;
};

/**
 * Lexhav's real, public posting for Legal Engineer, quoted verbatim from
 * careers.lexhav.com (see docs/jd-comparison.md). Offered as a one-click fill
 * so anyone can watch this run on a document they can open and check
 * themselves — the two section headings are the only scaffolding.
 */
const SAMPLE_JD = [
  "Legal Engineer",
  "",
  "The Legal Engineer will help clients maximize the use of Lexhav's AI-powered platform, acting as a liaison between clients and product development, providing demos, and ensuring effective adoption across legal teams.",
  "",
  "What you'll do",
  "- Acting as a thought partner to clients",
  "- Be the voice of the user inside Lexhav",
  "- Documenting best practices, contribute to the development of scalable playbooks",
  "",
  "Who you are",
  "- Not necessarily a coder, but passionate navigating technical conversations",
].join("\n");

const MAX_CHARS = 20_000;

const STAGES: { at: number; text: string }[] = [
  { at: 0, text: "Reading the posting on its own, without the corpus in front of it" },
  { at: 10, text: "Breaking it into claims about the work" },
  { at: 22, text: "Opening every channel, doc, ticket and meeting note" },
  { at: 40, text: "Looking for what the traces say about each claim" },
  { at: 62, text: "Checking every quote against the artifact it was attributed to" },
  { at: 84, text: "Discarding every verdict that lost its evidence" },
  { at: 104, text: "Counting what nothing in the corpus touches" },
];

export default function JdDiff({ companySlug = "lexhav" }: { companySlug?: string }) {
  const [text, setText] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* What we can see, fetched before anything is spent. The honest framing of
     a silent verdict depends on the reader knowing the size of the window. */
  useEffect(() => {
    let live = true;
    fetch(`/api/jd?companySlug=${encodeURIComponent(companySlug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (live && body?.coverage) setCoverage(body.coverage as Coverage);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [companySlug]);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const run = useCallback(async () => {
    const jobDescription = text.trim();
    if (running || jobDescription.length < 40) return;

    setError(null);
    setCheck(null);
    setRunning(true);
    setElapsed(0);
    timer.current = setInterval(() => setElapsed((s) => s + 1), 1000);

    try {
      const res = await fetch("/api/jd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companySlug, jobDescription }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (body && typeof body.error === "string" && body.error) ||
            `${res.status} ${res.statusText || "request failed"}`,
        );
      }
      setCheck(body.check as Check);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The check failed. Try again.");
    } finally {
      setRunning(false);
      if (timer.current) clearInterval(timer.current);
    }
  }, [companySlug, running, text]);

  const stage = [...STAGES].reverse().find((s) => elapsed >= s.at)?.text ?? STAGES[0].text;
  const progress = Math.min(95, 100 * (1 - Math.exp(-elapsed / 45)));
  const tooShort = text.trim().length > 0 && text.trim().length < 40;

  return (
    <div className="flex flex-col gap-10">
      {/* ── paste ───────────────────────────────────────────────────────── */}
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <Label>The job description</Label>
          <button
            type="button"
            onClick={() => setText(SAMPLE_JD)}
            disabled={running}
            className="rounded-md border border-line bg-surface-2/50 px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
          >
            Use Lexhav&rsquo;s real public posting
          </button>
          <span className="tnum ml-auto text-[11.5px] text-faint">
            {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          disabled={running}
          spellCheck={false}
          placeholder={
            "Paste the posting. Bullets, headings, whatever your ATS spat out — it gets broken into claims either way."
          }
          className="scroll-thin block h-[260px] w-full resize-y bg-transparent px-4 py-4 font-mono text-[12.5px] leading-[1.65] text-ink outline-none placeholder:text-faint disabled:opacity-60 sm:px-5"
        />

        <div className="flex flex-col gap-3 border-t border-line px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
          <p className="max-w-[64ch] text-[12px] leading-[1.6] text-faint">
            Two model calls over the whole corpus, about a minute. Nothing is
            compared until you press this.
          </p>
          <button
            type="button"
            onClick={run}
            disabled={running || text.trim().length < 40}
            className="group relative inline-flex h-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink px-5 text-[14.5px] font-medium text-paper transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:ml-auto"
          >
            {running && (
              <span
                className="absolute inset-y-0 left-0 bg-accent/35 transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
                aria-hidden
              />
            )}
            <span className="relative flex items-center gap-2.5">
              {running && <Spinner />}
              {running ? "Checking against the traces…" : "Check it against the traces"}
            </span>
          </button>
        </div>
      </Panel>

      {tooShort && !running && (
        <p className="-mt-6 text-[12.5px] text-faint">
          A little more than that — there is nothing to break into claims yet.
        </p>
      )}

      {coverage && !check && !running && <CoverageNote coverage={coverage} />}

      {running && (
        <div className="rise flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-4 py-3.5">
          <span className="flex shrink-0 items-center gap-1">
            <span className="dot h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="dot h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="dot h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <span className="min-w-0 flex-1 text-[13.5px] font-medium text-ink" aria-live="polite">
            {stage}
          </span>
          <span className="tnum shrink-0 text-[12px] text-faint">
            {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
            {String(elapsed % 60).padStart(2, "0")}
          </span>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-warn-line bg-warn-soft px-4 py-3 text-[13px] leading-relaxed text-warn">
          {error}
        </p>
      )}

      {check && <Result check={check} />}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────── result */

function Result({ check }: { check: Check }) {
  const contradicted = check.claims.filter((c) => c.verdict === "contradicted");
  const silent = check.claims.filter((c) => c.verdict === "silent");
  const supported = check.claims.filter((c) => c.verdict === "supported");

  return (
    <div className="rise flex flex-col gap-10">
      {/* ── the honest summary ── */}
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Stat value={String(check.summary.total)} label="claims in the posting" tone="muted" />
        <Stat
          value={String(check.summary.contradicted)}
          label="the traces contradict"
          tone={contradicted.length > 0 ? "warn" : "muted"}
        />
        <Stat value={String(check.summary.silent)} label="the traces are silent on" tone="muted" />
        <Stat value={String(check.summary.supported)} label="the traces support" tone="ok" />
      </div>

      <CoverageNote coverage={check.coverage} summary={check.summary} />

      <Section
        tone="warn"
        title="The traces say something else"
        count={contradicted.length}
        note="Every one of these carries a quote from your own material. Open it and check."
        empty="Nothing in this corpus is incompatible with the posting. That is a real result, not a fallback."
      >
        {contradicted.map((c) => (
          <ClaimCard key={c.id} claim={c} sources={check.sources} tone="warn" />
        ))}
      </Section>

      <Section
        tone="muted"
        title="The traces say nothing"
        count={silent.length}
        note="Either it is not happening, or it happens somewhere this corpus cannot see. We are not guessing which."
        empty="Every claim in the posting was touched by something in the corpus."
      >
        {silent.map((c) => (
          <ClaimCard key={c.id} claim={c} sources={check.sources} tone="muted" />
        ))}
      </Section>

      <Section
        tone="ok"
        title="The traces show this happening"
        count={supported.length}
        note="Cited, verbatim, from the corpus."
        empty="Nothing in the posting was corroborated by a verifiable quote."
      >
        {supported.map((c) => (
          <ClaimCard key={c.id} claim={c} sources={check.sources} tone="ok" />
        ))}
      </Section>
    </div>
  );
}

function CoverageNote({
  coverage,
  summary,
}: {
  coverage: Coverage;
  summary?: Check["summary"];
}) {
  const channels = coverage.channels.slice(0, 6);
  const more = coverage.channels.length - channels.length;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-dashed border-line px-4 py-3.5 sm:px-5">
      <Label>What we could see</Label>
      <p className="max-w-[86ch] text-[12.5px] leading-[1.65] text-muted">
        {coverage.artifacts.toLocaleString()} artifacts from {coverage.people} people
        {coverage.from && coverage.to ? `, ${coverage.from} to ${coverage.to}` : ""} —{" "}
        {channels.join(", ")}
        {more > 0 ? ` and ${more} more` : ""}. Anything decided in a meeting nobody
        wrote up, a DM, or an email is outside this window, and a silent verdict
        below means silent <em>here</em>.
      </p>
      {summary && (summary.droppedCitations > 0 || summary.downgraded > 0) && (
        <p className="max-w-[86ch] text-[12px] leading-[1.65] text-faint">
          {summary.downgraded > 0 && (
            <>
              {summary.downgraded} verdict{summary.downgraded === 1 ? "" : "s"} moved to
              silent because the evidence behind {summary.downgraded === 1 ? "it" : "them"}{" "}
              did not survive verification.{" "}
            </>
          )}
          {summary.droppedCitations > 0 && (
            <>
              {summary.droppedCitations} citation
              {summary.droppedCitations === 1 ? "" : "s"} discarded for not appearing
              in the artifact {summary.droppedCitations === 1 ? "it was" : "they were"}{" "}
              attributed to.
            </>
          )}
        </p>
      )}
    </div>
  );
}

function Section({
  tone,
  title,
  count,
  note,
  empty,
  children,
}: {
  tone: "warn" | "ok" | "muted";
  title: string;
  count: number;
  note: string;
  empty: string;
  children: React.ReactNode;
}) {
  const dot = tone === "warn" ? "bg-warn" : tone === "ok" ? "bg-ok" : "bg-line-strong";
  const label = tone === "warn" ? "!text-warn" : tone === "ok" ? "!text-ok" : "";

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <Label className={label}>{title}</Label>
        <span className="tnum text-[11px] text-faint">{count}</span>
        <span className="ml-auto hidden max-w-[52ch] text-right text-[11.5px] text-faint lg:block">
          {note}
        </span>
      </div>

      {count === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">
          {empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">{children}</ul>
      )}
    </section>
  );
}

function ClaimCard({
  claim,
  sources,
  tone,
}: {
  claim: Claim;
  sources: Record<string, Source>;
  tone: "warn" | "ok" | "muted";
}) {
  const border =
    tone === "warn" ? "border-warn-line" : tone === "ok" ? "border-ok-line" : "border-line";
  const rail = tone === "warn" ? "bg-warn" : tone === "ok" ? "bg-ok" : "bg-line-strong";

  return (
    <li
      className={`overflow-hidden rounded-xl border ${border} bg-surface`}
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="flex">
        <div className={`w-[3px] shrink-0 ${rail}`} />
        <div className="min-w-0 flex-1 px-4 py-4 sm:px-5">
          {/* The posting's own words, first and verbatim. */}
          <p className="text-[11px] tracking-[0.06em] text-faint uppercase">The posting says</p>
          <p className="mt-1.5 max-w-[74ch] text-[15px] leading-[1.55] font-medium tracking-[-0.005em] text-ink">
            &ldquo;{claim.quote}&rdquo;
          </p>

          {claim.proposition && (
            <p className="mt-1.5 max-w-[74ch] text-[12.5px] leading-[1.55] text-faint">
              Read as: {claim.proposition}
            </p>
          )}

          {claim.observation && (
            <p className="mt-4 max-w-[74ch] text-[14px] leading-[1.6] text-ink">
              {claim.observation}
            </p>
          )}

          {claim.evidence.length > 0 && (
            <ul className="mt-3.5 flex flex-col gap-3">
              {claim.evidence.map((e, i) => {
                const src = sources[e.artifactId];
                return (
                  <li key={`${e.artifactId}-${i}`} className="border-l-2 border-line pl-3.5">
                    <p className="max-w-[74ch] text-[13.5px] leading-[1.6] text-muted italic">
                      &ldquo;{e.quote.trim()}&rdquo;
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-faint">
                      <span className="text-ink/70">{src?.author ?? "unknown"}</span>
                      {src?.channel && <span>{src.channel}</span>}
                      {src?.timestamp && <span className="tnum">{shortDate(src.timestamp)}</span>}
                      <span className="font-mono text-[10.5px] text-faint/70">
                        {e.artifactId}
                      </span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          {claim.verdict === "silent" && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <Pill>Nothing in the corpus touches this</Pill>
              {claim.blindSpot && (
                <span className="max-w-[62ch] text-[12px] leading-[1.55] text-muted">
                  {claim.blindSpot}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "warn" | "ok" | "muted";
}) {
  const color = tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-ink";
  return (
    <div className="bg-surface px-5 py-4">
      <div className={`tnum text-[26px] leading-none font-semibold tracking-[-0.02em] ${color}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[12.5px] leading-snug text-muted">{label}</div>
    </div>
  );
}


const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Read straight off the string rather than through `new Date()`: converting to
 * the viewer's zone can move a late-evening Stockholm message onto the previous
 * day, and a citation dated one off from the Slack the reader is looking at is
 * a citation they stop trusting.
 */
function shortDate(timestamp: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(timestamp);
  if (!m) return timestamp;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}
