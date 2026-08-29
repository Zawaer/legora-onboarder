"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Artifact, ChatMessage, HireState, Person } from "@/lib/types";
import BlockerList from "./blocker-list";
import Chat from "./chat";
import { ElicitStatus } from "./elicit-panel";
import { fetchHire } from "./client-api";
import RampPlanView from "./ramp-plan";
import RoleCard, { RoleCardSkeleton } from "./role-card";
import SiteHeader, { NavLink } from "./site-header";
import { Label, Pill, type SyntheticCorpus } from "./ui";

const DERIVING_COPY = [
  "Reading the company's Slack, docs, tickets and meeting notes",
  "Working out what this role actually is here",
  "Checking every claim against a verbatim quote",
  "Separating what was decided from what was never settled",
  "Writing two days of real work",
];

export type Corpus = Record<
  string,
  { name: string; artifacts: Artifact[]; people?: Person[] }
>;

export default function HireView({
  hireId,
  corpus = {},
}: {
  hireId: string;
  /** Seeded source material, so evidence can be shown with its channel and author. */
  corpus?: Corpus;
  /**
   * Set by the server when this hire's corpus is the written demo. The banner
   * it used to draw was removed from this screen; the prop stays so the server
   * page's call signature is unchanged and the notice can come back without a
   * round trip through the data layer.
   */
  synthetic?: SyntheticCorpus;
}) {
  const [hire, setHire] = useState<HireState | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [companyName, setCompanyName] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const stop = useRef(false);

  const load = useCallback(async () => {
    try {
      const payload = await fetchHire(hireId);
      if (payload) {
        setHire(payload.hire);
        if (payload.artifacts.length) setArtifacts(payload.artifacts);
        if (payload.companyName) setCompanyName(payload.companyName);
        if (payload.hire.derivedRole) stop.current = true;
        setError(null);
      } else {
        setError("No hire with that id.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this hire.");
    } finally {
      setLoading(false);
    }
  }, [hireId]);

  /* Poll until the role lands — a hire page opened mid-derivation should fill
     in by itself rather than showing a dead skeleton. */
  useEffect(() => {
    let n = 0;
    load();
    const id = setInterval(() => {
      n += 1;
      setTick((t) => t + 1);
      if (stop.current || n > 45) {
        clearInterval(id);
        return;
      }
      load();
    }, 3000);
    return () => clearInterval(id);
  }, [load]);

  if (loading && !hire) return <FullPageState state="loading" />;

  if (!hire) {
    return <FullPageState state="missing" message={error ?? undefined} />;
  }

  const role = hire.derivedRole;
  const deriving = !role;
  const openBlockers = (hire.blockers ?? []).filter(
    (b) => b.needsHuman && !b.resolved,
  );

  const seed: ChatMessage[] = hire.messages ?? [];
  const local = corpus[hire.companySlug];
  const sources = artifacts.length ? artifacts : (local?.artifacts ?? []);
  const company = companyName ?? local?.name ?? hire.companySlug;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <SiteHeader
        right={
          <>
            <NavLink href="/manager">Manager view</NavLink>
            <NavLink href="/" emphasis>
              Start over
            </NavLink>
          </>
        }
      />

      {/* ── who this is ──
          Two registers of type, not four: the name, and one quiet line under
          it carrying role, company and day. Everything that was a bordered
          pill up here is now plain text with a dot, so the only pill left in
          the strip is the one that means a human is actually needed. The
          avatar is neutral rather than brass — brass is the evidence colour
          and it should not be competing with itself at the top of the page. */}
      <div className="sticky top-14 z-20 shrink-0 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 sm:px-8">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold text-muted">
            {(hire.name ?? "?")
              .split(/\s+/)
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <span className="block truncate text-[15px] font-semibold tracking-[-0.012em]">
              {hire.name}
            </span>
            <span className="block truncate text-[11.5px] text-faint">
              {hire.roleTitle} · {company} · day 1 of 2
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            {deriving ? (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
                <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
                Deriving the role
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                Agent active
              </span>
            )}
            {openBlockers.length > 0 && (
              <Pill tone="warn">
                {openBlockers.length} escalated to a human
              </Pill>
            )}
          </div>
        </div>
      </div>

      {/* ── the workspace ── */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 sm:px-8 lg:min-h-0 lg:overflow-hidden">
        {/* A wider gutter between the two columns: at 40px the role and the
            plan read as one dense field of text, and the whole screen was the
            complaint. */}
        <div className="grid h-full gap-8 py-8 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:gap-12">
          {/* left: the derived role + its evidence */}
          <section className="scroll-thin min-h-0 lg:overflow-y-auto lg:pr-2">
            {deriving ? (
              <div className="flex flex-col gap-6">
                <div className="rounded-xl border border-accent/25 bg-accent-soft px-5 py-4">
                  <Label className="!text-accent-ink">In progress</Label>
                  <p className="mt-2 text-[14px] leading-[1.6] text-ink">
                    {DERIVING_COPY[tick % DERIVING_COPY.length]}…
                  </p>
                  <p className="mt-1.5 text-[12px] text-accent-ink/80">
                    This page fills in on its own — no need to reload. Usually
                    about two minutes.
                  </p>
                </div>
                <RoleCardSkeleton />
              </div>
            ) : (
              <RoleCard
                role={role}
                artifacts={sources}
                people={local?.people}
                companyName={company}
              />
            )}
          </section>

          {/* right: the work, and the conversation about it */}
          <section className="flex min-h-0 flex-col gap-6 lg:gap-5">
            <div className="scroll-thin min-h-0 shrink-0 lg:flex-[0.8] lg:overflow-y-auto lg:pr-2">
              <RampPlanView plan={hire.plan} taskStatus={hire.taskStatus ?? {}} />

              {/* Honest state on anything the corpus could not answer: which
                  question is out, with whom, and — explicitly — that nothing is
                  written down yet. Renders nothing when there is nothing out. */}
              <ElicitStatus
                hireId={hire.id}
                blockers={hire.blockers ?? []}
                className="mt-8"
              />

              {(hire.blockers ?? []).length > 0 && (
                <div className="mt-8 flex flex-col gap-3">
                  <Label>Raised so far</Label>
                  <BlockerList
                    blockers={hire.blockers}
                    people={{ [hire.id]: { name: hire.name, roleTitle: hire.roleTitle } }}
                  />
                </div>
              )}
            </div>

            <Chat
              hireId={hire.id}
              seedMessages={seed}
              hireName={firstName(hire.name)}
              channel={channelFor(hire.name, hire.roleTitle)}
              onHire={(next) => setHire(next)}
              className="h-[540px] shrink-0 lg:h-auto lg:min-h-[380px] lg:flex-[1.2]"
            />
          </section>
        </div>
      </main>
    </div>
  );
}

/* ── naming ───────────────────────────────────────────────────────────── */

function slug(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function firstName(name?: string) {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first && !/^new$/i.test(first) ? first : "You";
}

/** A placeholder name shouldn't produce `#onboarding-new`. */
function channelFor(name?: string, roleTitle?: string) {
  const clean = (name ?? "").trim();
  if (clean && !/^new\s*hire$/i.test(clean)) {
    return `#onboarding-${slug(clean.split(/\s+/)[0])}`;
  }
  return `#onboarding-${slug(roleTitle ?? "hire") || "hire"}`;
}

/* ── whole-page states ────────────────────────────────────────────────── */

function FullPageState({
  state,
  message,
}: {
  state: "loading" | "missing";
  message?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-[1400px] flex-1 place-items-center px-5 py-24">
        {state === "loading" ? (
          <div className="flex flex-col items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="dot h-2 w-2 rounded-full bg-accent" />
              <span className="dot h-2 w-2 rounded-full bg-accent" />
              <span className="dot h-2 w-2 rounded-full bg-accent" />
            </span>
            <p className="text-[13.5px] text-muted">Opening the workspace…</p>
          </div>
        ) : (
          <div className="max-w-[46ch] text-center">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
              That workspace isn&rsquo;t here.
            </h1>
            <p className="mt-2.5 text-[14px] leading-[1.6] text-muted">
              {message ??
                "The hire may not have been derived yet, or the server restarted."}
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex h-10 items-center rounded-lg bg-ink px-5 text-[14px] font-medium text-paper hover:opacity-90"
            >
              See how it works
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
