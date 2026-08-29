"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Blocker, HireState } from "@/lib/types";
import BlockerList, { type HireRef } from "./blocker-list";
import { fetchHires } from "./client-api";
import SiteHeader, { NavLink } from "./site-header";
import { Label, SyntheticNote, initials, type SyntheticCorpus } from "./ui";

export default function ManagerView({
  synthetic,
}: {
  /**
   * Set by the server when a hire on this screen comes from the written demo
   * corpus. A prop, not a fetch, so the notice is in the server HTML rather
   * than appearing once the roster lands.
   */
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
  const blockers: Blocker[] = list.flatMap((h) => h.blockers ?? []);
  const people: Record<string, HireRef> = Object.fromEntries(
    list.map((h) => [h.id, { name: h.name, roleTitle: h.roleTitle }]),
  );

  return (
    <div className="min-h-dvh">
      <SiteHeader
        right={
          <>
            {/* The pre-start half of this screen. Reachable from here because
                the two are one job: what lands before day 1, and what is in
                the way after it. */}
            <NavLink href="/manager/brief">Manager brief</NavLink>
            <NavLink href="/loi">Letter of intent</NavLink>
            <NavLink href="/" emphasis>
              Derive a role
            </NavLink>
          </>
        }
      />

      <main className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8 lg:py-14">
        {/* ── the design statement ── */}
        <header className="flex flex-col gap-5 border-b border-line pb-10">
          {/* Every name below this line was written. Said here, above the
              fold and next to the names, rather than in a footer. */}
          {synthetic && <SyntheticNote {...synthetic} />}
          <Label>Manager view</Label>
          <h1 className="max-w-[18ch] text-[32px] leading-[1.08] font-semibold tracking-[-0.028em] text-balance sm:text-[40px]">
            Blockers. Nothing else.
          </h1>
          <p className="max-w-[70ch] text-[15.5px] leading-[1.65] text-muted">
            This screen deliberately shows no productivity metrics — no scores,
            no completion rates, no time-on-task. You hire for ownership, and a
            surveillance dashboard gets killed by the culture it is sold into.
            The only thing worth your attention is what somebody is stuck on
            that the agent genuinely could not resolve.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-faint">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              live · refreshes every 8s
            </span>
            <span className="hidden h-3 w-px bg-line sm:block" />
            <span>{list.length} {list.length === 1 ? "hire" : "hires"} ramping</span>
          </div>
        </header>

        {/* ── roster ── */}
        {list.length > 0 && (
          <section className="border-b border-line py-8">
            <Label>Ramping now</Label>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((h) => {
                const open = (h.blockers ?? []).filter(
                  (b) => b.needsHuman && !b.resolved,
                ).length;
                return (
                  <li key={h.id}>
                    <Link
                      href={`/hire/${h.id}`}
                      className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">
                        {initials(h.name ?? "?")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">
                          {h.name}
                        </span>
                        <span className="block truncate text-[12px] text-faint">
                          {h.roleTitle}
                        </span>
                      </span>
                      {open > 0 ? (
                        <span className="tnum shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">
                          {open}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] text-faint">
                          clear
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── blockers ── */}
        <section className="py-10">
          {hires === null ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="skeleton h-24 rounded-xl border border-line"
                />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
              <p className="text-[16px] font-medium">Nobody is onboarding yet.</p>
              <p className="mx-auto mt-2 max-w-[48ch] text-[14px] leading-relaxed text-muted">
                {error
                  ? "The onboarding service didn't return a roster. Derive a role to create one."
                  : "Derive a role from the landing page and this screen fills in as the hire works."}
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex h-10 items-center rounded-lg bg-ink px-5 text-[14px] font-medium text-paper hover:opacity-90"
              >
                Derive a role
              </Link>
            </div>
          ) : (
            <BlockerList blockers={blockers} people={people} now={now || undefined} />
          )}
        </section>

        <footer className="border-t border-line pt-8 pb-4">
          <p className="max-w-[70ch] text-[13px] leading-[1.65] text-faint">
            What is missing from this page is the point. There is no ranking of
            people, no percentage complete, and no score attached to anybody.
            The one number on the roster is a count of things standing in
            someone&rsquo;s way, which is a queue to clear and not a mark against
            them — every other number we could have shown would have measured
            the person instead, and none of them would make a single person less
            stuck.
          </p>
        </footer>
      </main>
    </div>
  );
}
