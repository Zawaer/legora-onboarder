"use client";

/**
 * The manager brief, on screen.
 *
 * Same visual language as the blocker screen — paper, one rule between
 * sections, quotes set as blockquotes with the artifact id in mono so a manager
 * can go and check one. The layout is the argument: four numbered blocks, each
 * one skimmable in a glance, with the receipts recessive underneath rather than
 * absent.
 *
 * The only action on the page is "copy as Slack message", because the brief is
 * not really a web page — it is a message that happens to have a permalink. The
 * manager reads it where they already are.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BriefCitation,
  ManagerBrief,
} from "@/lib/agent/manager-brief";
import { asHires } from "./client-api";
import type { HireState } from "@/lib/types";
import SiteHeader, { NavLink } from "./site-header";
import { Label, Panel, Pill } from "./ui";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Locale-free so the server and the client agree. Same rule as `ui.clockTime`. */
function dayMonth(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]}` : "";
}

export default function ManagerBriefView() {
  const [hires, setHires] = useState<HireState[] | null>(null);
  const [hireId, setHireId] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [brief, setBrief] = useState<ManagerBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read the query string in an effect rather than through `useSearchParams`,
  // which would drag a Suspense boundary into a page that is already dynamic.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setHireId(params.get("hire") ?? params.get("hireId"));
    setStartsAt(params.get("startsAt"));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/hire", { cache: "no-store" });
        const list = asHires(await res.json());
        if (alive) setHires(list);
      } catch {
        if (alive) setHires([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // No hire in the URL: fall back to the most recent one, so the page is never
  // a dead end for someone who followed a bare link.
  const resolvedId = hireId ?? hires?.[0]?.id ?? null;

  useEffect(() => {
    if (!resolvedId) return;
    let alive = true;
    setBrief(null);
    setError(null);
    (async () => {
      try {
        const qs = new URLSearchParams({ hireId: resolvedId });
        if (startsAt) qs.set("startsAt", startsAt);
        const res = await fetch(`/api/brief-manager?${qs}`, { cache: "no-store" });
        const body = (await res.json()) as { brief?: ManagerBrief; error?: string };
        if (!alive) return;
        if (!res.ok || !body.brief) {
          setError(body.error ?? `${res.status} — could not compose the brief.`);
          return;
        }
        setBrief(body.brief);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not reach the brief service.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [resolvedId, startsAt]);

  const copy = useCallback(async () => {
    if (!brief) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(brief.slack);
      ok = true;
    } catch {
      // Clipboard API needs a secure context; a hidden textarea does not.
      try {
        const el = document.createElement("textarea");
        el.value = brief.slack;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        ok = document.execCommand("copy");
        document.body.removeChild(el);
      } catch {
        ok = false;
      }
    }
    if (!ok) return;
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2200);
  }, [brief]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  return (
    <div className="min-h-dvh">
      <SiteHeader
        right={
          <>
            <NavLink href="/manager">Blockers</NavLink>
            <NavLink href="/" emphasis>
              Derive a role
            </NavLink>
          </>
        }
      />

      <main className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8 lg:py-14">
        {/* ── the design statement ── */}
        <header className="flex flex-col gap-5 border-b border-line pb-10">
          <Label>Manager brief</Label>
          <h1 className="max-w-[20ch] text-[32px] leading-[1.08] font-semibold tracking-[-0.028em] text-balance sm:text-[40px]">
            Forty-eight hours before they start.
          </h1>
          <p className="max-w-[70ch] text-[15.5px] leading-[1.65] text-muted">
            The highest-return onboarding intervention anyone has published is a
            short note to the <em>manager</em> before the start date — not
            another portal for the hire. It needs a human with a spare hour who
            notices a start date. A company hiring tens of people a month does not
            have that human, so this composes it instead: four things, each one
            quoted from your own Slack, docs and tickets.
          </p>

          {brief && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-faint">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                composed, not generated · no model call
              </span>
              <span className="hidden h-3 w-px bg-line sm:block" />
              <span>{brief.corpusSize} artifacts</span>
              <span className="hidden h-3 w-px bg-line sm:block" />
              <span>{brief.companyName}</span>
            </div>
          )}
        </header>

        {/* ── who this is about ── */}
        {hires && hires.length > 1 && (
          <section className="border-b border-line py-6">
            <Label>Whose brief</Label>
            <ul className="mt-3 flex flex-wrap gap-2">
              {hires.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/manager/brief?hire=${h.id}`}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors ${
                      h.id === resolvedId
                        ? "border-line-strong bg-surface font-medium text-ink"
                        : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    {h.name}
                    <span className="text-[11.5px] text-faint">{h.roleTitle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── the brief ── */}
        {error ? (
          <div className="my-10 rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
            <p className="text-[16px] font-medium">No brief for this hire.</p>
            <p className="mx-auto mt-2 max-w-[52ch] text-[14px] leading-relaxed text-muted">{error}</p>
            <Link
              href="/"
              className="mt-6 inline-flex h-10 items-center rounded-lg bg-ink px-5 text-[14px] font-medium text-paper hover:opacity-90"
            >
              Derive a role
            </Link>
          </div>
        ) : hires !== null && hires.length === 0 ? (
          <div className="my-10 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <p className="text-[16px] font-medium">Nobody is starting yet.</p>
            <p className="mx-auto mt-2 max-w-[48ch] text-[14px] leading-relaxed text-muted">
              Derive a role from the landing page and the brief for that hire appears here.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex h-10 items-center rounded-lg bg-ink px-5 text-[14px] font-medium text-paper hover:opacity-90"
            >
              Derive a role
            </Link>
          </div>
        ) : !brief ? (
          <div className="my-10 flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-28 rounded-xl border border-line" />
            ))}
          </div>
        ) : (
          <>
            {/* ── the countdown line + the one action ── */}
            <section className="flex flex-col gap-4 border-b border-line py-8 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] sm:text-[26px]">
                  {brief.hireName}
                  <span className="ml-2.5 text-[15px] font-normal text-muted">
                    {brief.roleTitle}
                  </span>
                </h2>
                <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[13.5px] text-muted">
                  <span>
                    {brief.hoursUntilStart >= 0 ? "Starts" : "Started"}{" "}
                    <span className="font-medium text-ink">{brief.startsAtLabel}</span>
                  </span>
                  <Pill tone={brief.hoursUntilStart >= 0 ? "accent" : "neutral"}>
                    <span className="tnum">{leadLabel(brief.hoursUntilStart)}</span>
                  </Pill>
                  {brief.startSource === "record" && (
                    <Pill tone="warn">record timestamp, not a start date</Pill>
                  )}
                  {brief.manager && (
                    <span className="text-faint">for {brief.manager.slackHandle}</span>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={copy}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-ink px-4 text-[13.5px] font-medium text-paper transition-opacity hover:opacity-90"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
                  {copied ? (
                    <path
                      d="M3.5 8.4 6.4 11.3l6.1-6.6"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : (
                    <>
                      <rect x="5.4" y="2.4" width="8.2" height="8.2" rx="2" stroke="currentColor" strokeWidth="1.3" />
                      <path
                        d="M10.6 13.6h-6a2 2 0 0 1-2-2v-6"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </svg>
                {copied ? "Copied for Slack" : "Copy as Slack message"}
              </button>
            </section>

            {/* ── 01 · buddy ── */}
            <Section n="01" title="Who the buddy should be">
              {brief.buddy ? (
                <Panel className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[18px] font-semibold tracking-[-0.015em]">
                      {brief.buddy.name}
                    </span>
                    <span className="font-mono text-[12.5px] text-accent-ink">
                      {brief.buddy.slackHandle}
                    </span>
                    <span className="text-[12.5px] text-faint">
                      {brief.buddy.role} · {brief.buddy.team}
                    </span>
                  </div>

                  {brief.buddy.overlaps.length > 0 && (
                    <Reason label="Works on the same things">
                      {brief.buddy.overlaps.join("; ")}.
                    </Reason>
                  )}
                  <Cite c={brief.buddy.worksOn} />

                  <Reason
                    label={
                      brief.buddy.answeredAQuestion
                        ? "Answers questions there"
                        : "Replies to people there"
                    }
                  >
                    {brief.buddy.answeredWhom} asked in the thread; {brief.buddy.name.split(/\s+/)[0]}{" "}
                    answered.
                  </Reason>
                  <Cite c={brief.buddy.answers} />

                  {brief.buddy.wroteTheWorkedExample && (
                    <Reason label="And">
                      They wrote the worked example in section 03 — the method{" "}
                      {brief.hireName.split(/\s+/)[0]} is being told to copy is theirs.
                    </Reason>
                  )}

                  <Reason label="Capacity">{brief.buddy.loadNote}</Reason>

                  {brief.passedOver && (
                    <div className="mt-5 rounded-lg border border-warn-line bg-warn-soft/50 p-4">
                      <div className="text-[13.5px] font-medium text-warn">
                        Not {brief.passedOver.name} ({brief.passedOver.slackHandle}) —{" "}
                        {brief.passedOver.reason}
                      </div>
                      {brief.passedOver.citations.map((c) => (
                        <Cite key={`${c.artifactId}-${c.quote.slice(0, 24)}`} c={c} />
                      ))}
                    </div>
                  )}
                </Panel>
              ) : (
                <Blank>
                  Nobody in the corpus both works on what this hire is about to work on and
                  visibly answers other people about it. Naming somebody anyway would be a
                  guess in a confident tone, so this is blank on purpose.
                </Blank>
              )}
            </Section>

            {/* ── 02 · people to meet ── */}
            <Section
              n="02"
              title={
                brief.meet.length > 0
                  ? `${brief.meet.length} people to meet, and why`
                  : "People to meet"
              }
            >
              {brief.meet.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {brief.meet.map((p) => (
                    <li key={p.name}>
                      <Panel className="p-4 sm:p-5">
                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                          <span className="text-[15px] font-semibold tracking-[-0.01em]">
                            {p.name}
                          </span>
                          <span className="font-mono text-[12px] text-accent-ink">
                            {p.slackHandle}
                          </span>
                          <span className="text-[12px] text-faint">{p.role}</span>
                        </div>
                        <p className="mt-2 max-w-[74ch] text-[14px] leading-[1.55] text-ink">
                          {p.reason}
                        </p>
                        <Cite c={p.citation} />
                      </Panel>
                    </li>
                  ))}
                </ul>
              ) : (
                <Blank>
                  None that the corpus can justify. A name with a reason and nothing behind it
                  is the thing this product is built not to produce.
                </Blank>
              )}
            </Section>

            {/* ── 03 · first task + worked example ── */}
            <Section n="03" title="Their first real task">
              {brief.firstTask ? (
                <Panel className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="accent">
                      day {brief.firstTask.day} · task {brief.firstTask.position}
                    </Pill>
                    <Pill>
                      <span className="tnum">~{formatMins(brief.firstTask.estimateMins)}</span>
                    </Pill>
                    <span className="font-mono text-[11px] text-faint">
                      {brief.firstTask.taskId}
                    </span>
                  </div>
                  <h3 className="mt-3 max-w-[60ch] text-[17px] leading-snug font-semibold tracking-[-0.012em]">
                    {brief.firstTask.title}
                  </h3>
                  <Reason label="Why it matters">{brief.firstTask.why}</Reason>
                  <Reason label="Done when">{brief.firstTask.doneWhen}</Reason>
                  <Reason label="Stuck">{brief.firstTask.askIfStuck}</Reason>

                  <div className="mt-5 rounded-lg border border-line bg-surface-2/60 p-4">
                    {brief.firstTask.workedExample ? (
                      <>
                        <Label>Worked example</Label>
                        <p className="mt-2 text-[14px] leading-snug font-medium">
                          {brief.firstTask.workedExample.title}
                        </p>
                        <p className="mt-1 text-[12.5px] text-muted">
                          {brief.firstTask.workedExample.whyItIsTheExample}
                        </p>
                        <Cite c={brief.firstTask.workedExample.citation} />
                      </>
                    ) : (
                      <>
                        <Label>Worked example</Label>
                        <p className="mt-2 text-[13.5px] text-muted">
                          Nothing in the corpus is close enough to this to call one.
                        </p>
                      </>
                    )}
                  </div>
                </Panel>
              ) : (
                <Blank>No ramp plan for this hire yet, so there is no first task.</Blank>
              )}
            </Section>

            {/* ── 04 · undecided ── */}
            <Section
              n="04"
              title="What the company hasn't decided"
              note="Only you can settle these. Otherwise they surface as their confusion in week two."
            >
              {brief.undecided.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {brief.undecided.map((u) => (
                    <li key={u.headline}>
                      <Panel className="p-4 sm:p-5">
                        <p className="max-w-[74ch] text-[14.5px] leading-[1.55] font-medium tracking-[-0.005em]">
                          {u.headline}
                        </p>
                        {u.detail && (
                          <p className="mt-1.5 max-w-[74ch] text-[13px] leading-[1.6] text-muted">
                            {u.detail}
                          </p>
                        )}
                        <Cite c={u.citation} />
                      </Panel>
                    </li>
                  ))}
                </ul>
              ) : (
                <Blank>Nothing surfaced that ties back to a source.</Blank>
              )}
            </Section>

            {/* ── what it does not know ── */}
            {brief.gaps.length > 0 && (
              <section className="border-b border-line py-8">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-warn" />
                  <Label className="!text-warn">What this brief does not know</Label>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {brief.gaps.map((g) => (
                    <li
                      key={g}
                      className="max-w-[80ch] rounded-lg border border-warn-line bg-warn-soft/40 px-4 py-3 text-[13.5px] leading-[1.6] text-ink"
                    >
                      {g}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <footer className="pt-8 pb-4">
          <p className="max-w-[70ch] text-[13px] leading-[1.65] text-faint">
            Nobody on this page is scored, ranked or compared. The brief says what a person
            does and shows you where they did it, because &ldquo;answered the last four
            questions about the extraction pipeline&rdquo; is checkable and
            &ldquo;best match, 0.87&rdquo; is not. Anything the corpus could not support was
            left out rather than softened.
          </p>
        </footer>
      </main>
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

function Section({
  n,
  title,
  note,
  children,
}: {
  n: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line py-9">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tnum text-[12px] font-semibold tracking-[0.06em] text-faint">{n}</span>
        <h2 className="text-[17px] font-semibold tracking-[-0.015em]">{title}</h2>
        {note && <span className="text-[12.5px] text-faint">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Reason({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="mt-3.5 max-w-[74ch] text-[14px] leading-[1.6] text-ink">
      <span className="text-muted">{label}: </span>
      {children}
    </p>
  );
}

/**
 * A citation. The artifact id is shown in mono on purpose — it is the thing a
 * sceptical manager searches for, and a quote you cannot go and check is just
 * a nicely formatted claim.
 */
function Cite({ c }: { c: BriefCitation }) {
  return (
    <figure className="mt-2.5 border-l-2 border-line-strong pl-3.5">
      <blockquote className="max-w-[76ch] text-[13.5px] leading-[1.6] text-muted">
        &ldquo;{c.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-faint">
        <span className="font-medium text-muted">{c.author}</span>
        <span>·</span>
        <span>{c.where}</span>
        <span>·</span>
        <span className="tnum">{dayMonth(c.at)}</span>
        <span>·</span>
        <span className="font-mono">{c.artifactId}</span>
      </figcaption>
    </figure>
  );
}

function Blank({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[70ch] rounded-xl border border-dashed border-line bg-surface px-5 py-6 text-[13.5px] leading-[1.6] text-muted">
      {children}
    </p>
  );
}

function leadLabel(hours: number): string {
  if (hours < 0) {
    const past = Math.abs(hours);
    if (past < 24) return `${past}h ago`;
    const days = Math.round(past / 24);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }
  if (hours < 1) return "today";
  if (hours <= 72) return `in ${hours} hours`;
  return `in ${Math.round(hours / 24)} days`;
}

function formatMins(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
