"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Blocker, HireState } from "@/lib/types";
import { findAdjoiningScope } from "@/lib/agent/cohort";
import { fetchHires } from "./client-api";
import ResolutionCounters from "./resolution-counters";
import SiteHeader from "./site-header";
import { Label, initials, type SyntheticCorpus } from "./ui";

/**
 * The manager view.
 *
 * Rebuilt around one question, because that is the only one anybody opens this
 * screen to answer: **is somebody stuck, and does it need me?** The previous
 * version laid every section out at the same visual weight in one column, so a
 * blocker waiting on a named person since yesterday looked exactly like a
 * roster row that needed nothing. A reader could not triage it in the twenty
 * seconds they actually have between meetings.
 *
 * So the order is now strictly by what it costs the reader to ignore:
 *
 *   1. Blocked on a human   -> act today. The only thing that gets colour.
 *   2. Where two ramps touch-> two plans deconflicting themselves. Reassuring.
 *   3. Attention not spent  -> what the agent absorbed. Evidence.
 *   4. Who is ramping       -> reference. Quiet, tabular, scannable.
 *
 * ON THE PROGRESS COLUMN, WHICH IS A REVERSAL
 *
 * This page used to refuse every completion figure, on the grounds that a
 * surveillance dashboard gets killed by the culture it is sold into. That
 * argument still holds for time-on-task, for ranking people against each other,
 * and for anything that outlives the ramp. It does not hold for "4 of 9 tasks,
 * day 2", because the plan is two days long, the agent wrote it, and a manager
 * who cannot see whether someone is on day one or day two cannot help them.
 * The line is: measure the plan, never the person, and keep nothing after the
 * ramp ends.
 */

type Ramp = {
  hire: HireState;
  day: 1 | 2 | null;
  done: number;
  total: number;
};

function rampOf(hire: HireState): Ramp {
  const days = hire.plan?.days ?? [];
  const all = days.flatMap((d) => d.tasks);
  const statusOf = (id: string) => hire.taskStatus?.[id] ?? "not_started";
  const done = all.filter((t) => statusOf(t.id) === "done").length;

  // The day they are actually on: the first day still carrying unfinished
  // work, not elapsed wall-clock time. Someone who finished day one in a
  // morning is on day two, and someone who has stalled is still on day one.
  const current = days.find((d) => d.tasks.some((t) => statusOf(t.id) !== "done"));
  return { hire, day: current?.day ?? null, done, total: all.length };
}

export default function ManagerView({
  // Accepted and deliberately not rendered here. The synthetic-workspace notice
  // was cut from this screen on 30 Aug: it is the manager's triage view, not a
  // page a stranger lands on cold. The disclosure still has to exist somewhere,
  // and it now lives in what we say about the demo rather than on the page, so
  // keep saying it out loud whenever this screen is shown to anyone.
  synthetic: _synthetic,
}: {
  synthetic?: SyntheticCorpus;
} = {}) {
  const [hires, setHires] = useState<HireState[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let alive = true;
    setNow(Date.now());

    async function load() {
      try {
        const list = await fetchHires();
        if (alive) {
          setHires(list);
          setError(null);
        }
      } catch (err) {
        if (alive) {
          setHires([]);
          setError(err instanceof Error ? err.message : "Couldn't load hires.");
        }
      }
    }

    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const list = hires ?? [];
  const ramps = list.map(rampOf);
  const byHire = new Map(list.map((h) => [h.id, h]));

  const needsHuman = list
    .flatMap((h) => (h.blockers ?? []).map((b) => ({ blocker: b, hire: h })))
    .filter(({ blocker }) => blocker.needsHuman && !blocker.resolved);

  const adjoining = findAdjoiningScope(list);

  const headline =
    hires === null
      ? "Loading the roster"
      : list.length === 0
        ? "Nobody is ramping yet"
        : needsHuman.length === 0
          ? `${list.length} ${list.length === 1 ? "person" : "people"} ramping, nobody blocked`
          : `${list.length} ${list.length === 1 ? "person" : "people"} ramping, ${needsHuman.length} ${needsHuman.length === 1 ? "needs" : "need"} you`;

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 lg:py-12">
        <header className="flex flex-col gap-3 border-b border-line pb-7">
          <Label>Manager view</Label>
          <h1 className="max-w-[22ch] text-[30px] leading-[1.1] font-semibold tracking-[-0.028em] text-balance sm:text-[36px]">
            {headline}
          </h1>
          <span className="inline-flex items-center gap-2 text-[12.5px] text-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            live · refreshes every 8s
          </span>
        </header>

        {/* ── 1. blocked on a human ──────────────────────────────────────────
            The only section that gets colour, because it is the only one that
            costs something to miss. */}
        <section className="pt-8">
          <Label>Needs a human</Label>

          {hires === null ? (
            <div className="skeleton mt-4 h-28 rounded-xl border border-line" />
          ) : needsHuman.length === 0 ? (
            // Emptiness here is the product working. It must not read as a
            // failed fetch, so it is stated rather than left blank.
            <p className="mt-4 rounded-xl border border-dashed border-line bg-surface px-5 py-6 text-[14px] text-muted">
              {list.length === 0
                ? error
                  ? "The onboarding service did not return a roster."
                  : "Start someone onboarding and this screen fills in as they work."
                : "Nobody is waiting on a person. Everything asked so far was answerable from your own material."}
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {needsHuman.map(({ blocker, hire }) => (
                <li
                  // Blocker ids are not unique across hires: two people seeded
                  // from the same fixture carry the same id, which made React
                  // collapse three real blockers into one row.
                  key={`${hire.id}:${blocker.id}`}
                  className="rounded-xl border border-warn/35 bg-warn-soft px-5 py-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="flex flex-wrap items-baseline gap-x-2.5">
                      <Link
                        href={`/hire/${hire.id}`}
                        className="text-[15px] font-semibold hover:underline"
                      >
                        {hire.name}
                      </Link>
                      <span className="text-[13px] text-muted">{hire.roleTitle}</span>
                    </span>
                    <span className="text-[12.5px] font-medium text-warn">
                      {waitedFor(blocker.raisedAt, now)}
                    </span>
                  </div>

                  <p className="mt-2 max-w-[80ch] text-[14.5px] leading-[1.55]">
                    {blocker.summary}
                  </p>

                  {blocker.suggestedPerson && (
                    <p className="mt-3 border-t border-warn/25 pt-3 text-[13.5px] text-muted">
                      Unblock with{" "}
                      <span className="font-semibold text-ink">
                        {blocker.suggestedPerson}
                      </span>
                      {typeof blocker.minutesToUnblock === "number" && (
                        <span className="text-faint">
                          {" · "}about {blocker.minutesToUnblock} min of their time
                        </span>
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── 2. where two ramps touch ───────────────────────────────────── */}
        {adjoining.length > 0 && (
          <section className="pt-10">
            <Label>Where two ramps touch</Label>
            <p className="mt-2 text-[13.5px] text-muted">
              Lines the agent wrote into one person&rsquo;s plan that name another.
              Nobody typed these, and the two agents never messaged each other.
            </p>
            <ul className="mt-4 grid gap-3 lg:grid-cols-2">
              {adjoining.slice(0, 4).map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-line bg-surface px-5 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                    <span>{a.hireName}</span>
                    <span aria-hidden className="text-faint">
                      &harr;
                    </span>
                    <span>{a.otherHireName}</span>
                  </div>
                  <blockquote className="mt-2.5 border-l-2 border-line-strong pl-3 text-[13.5px] leading-[1.6] text-muted">
                    {a.note}
                  </blockquote>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── 3. attention not spent ─────────────────────────────────────── */}
        <section className="pt-10">
          <Label>Attention not spent</Label>
          <ResolutionCounters />
        </section>

        {/* ── 4. who is ramping ──────────────────────────────────────────── */}
        {list.length > 0 && (
          <section className="pt-10">
            <Label>Who is ramping</Label>
            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-surface-2/60">
                    {["Person", "Role", "Plan", "Tasks"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-4 py-2.5 font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ramps.map(({ hire, day, done, total }) => (
                    <tr
                      key={hire.id}
                      className="border-b border-line last:border-0 hover:bg-surface-2/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/hire/${hire.id}`}
                          className="flex items-center gap-2.5 font-medium hover:underline"
                        >
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[10.5px] font-semibold text-muted">
                            {initials(hire.name ?? "?")}
                          </span>
                          <span className="truncate text-[14px]">{hire.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[13.5px] text-muted">
                        {hire.roleTitle}
                      </td>
                      <td className="px-4 py-3 text-[13.5px] text-muted">
                        {day ? `Day ${day}` : "Complete"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <span
                            className="h-1.5 w-[90px] shrink-0 overflow-hidden rounded-full bg-surface-2"
                            role="presentation"
                          >
                            <span
                              className="block h-full rounded-full bg-ink"
                              style={{
                                width: `${total ? Math.round((done / total) * 100) : 0}%`,
                              }}
                            />
                          </span>
                          <span className="tnum text-[12.5px] text-faint">
                            {done}/{total}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <footer className="mt-12 border-t border-line pt-7 pb-4">
          <p className="max-w-[74ch] text-[13px] leading-[1.65] text-faint">
            There is no ranking here, no time-on-task, and no score attached to
            anybody. Progress is counted against the two-day plan the agent
            wrote, and it stops existing when the ramp does. Everything else we
            could have measured would have measured the person instead, and none
            of it would make anybody less stuck.
          </p>
        </footer>
      </main>
    </div>
  );
}

/** "Waiting since yesterday" reads better than a timestamp nobody converts. */
function waitedFor(raisedAt: string, now: number): string {
  if (!now) return "waiting";
  const mins = Math.max(0, Math.round((now - new Date(raisedAt).getTime()) / 60000));
  if (mins < 60) return `waiting ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `waiting ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "waiting since yesterday" : `waiting ${days} days`;
}
