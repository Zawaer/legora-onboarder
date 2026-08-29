"use client";

import { useEffect, useState } from "react";
import { Label } from "./ui";

/**
 * The two numbers, on the manager's screen.
 *
 * THIS PAGE'S RULE STILL HOLDS
 *
 * /manager shows no productivity metrics, because a dashboard that ranks a
 * person you hired three days ago gets removed by the culture that bought it.
 * These two numbers are not an exception to that rule, they are the other side
 * of it: both measure the agent, and neither can be computed per-person into
 * anything resembling a score. "Questions answered without interrupting
 * anybody" says the tool did its job. It says nothing about who asked, and
 * asking more is not worse.
 *
 * WHY THE SECOND NUMBER IS HERE AND NOT IN A LOG
 *
 * It is the argument for the web rung existing. A large share of what a new
 * hire asks is not institutional knowledge at all, and every one of those
 * routed to a colleague spends a scarce, non-renewable resource — published
 * response rates for "please answer this newcomer's question" systems settle
 * around 10-20% at steady state. This number is the claim, measured on our own
 * corpus, and it is queryable at /api/resolutions rather than only drawn here.
 */

type Stats = {
  total: number;
  resolvedWithoutHuman: number;
  corpusMisses: number;
  generalCorpusMisses: number;
  generalShareOfCorpusMisses: number | null;
};

export default function ResolutionCounters({ companySlug }: { companySlug?: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  const query = companySlug ? `?company=${encodeURIComponent(companySlug)}` : "";

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch(`/api/resolutions${query}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Stats;
        if (alive) {
          setStats(body);
          setFailed(false);
        }
      } catch {
        // Never take the board down over a counter. The blockers are the page.
        if (alive) setFailed(true);
      }
    }

    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [query]);

  if (failed && !stats) return null;

  const share = stats?.generalShareOfCorpusMisses;

  return (
    <section className="border-b border-line py-8">
      <Label>What the agent absorbed</Label>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Figure
          value={stats ? String(stats.resolvedWithoutHuman) : null}
          of={stats ? `of ${stats.total} asked` : undefined}
          caption="Questions resolved without interrupting anyone — answered from your own corpus, or from the web when they turned out not to be about you at all."
        />
        <Figure
          // `null` share means no corpus miss has happened yet. A "0%" here
          // would read as "none of them were general", which is a different
          // and untrue statement.
          value={share == null ? "—" : `${Math.round(share * 100)}%`}
          of={
            stats
              ? stats.corpusMisses === 0
                ? "no corpus misses yet"
                : `${stats.generalCorpusMisses} of ${stats.corpusMisses} misses`
              : undefined
          }
          caption="Of the questions your corpus could not answer, the share that were general knowledge — not about this company, and never worth a colleague's time."
        />
      </div>

      <p className="mt-3 text-[12px] leading-[1.6] text-faint">
        About the agent, not about anybody on the roster: there is no per-person
        figure here and asking more questions is not worse.{" "}
        <span className="font-mono">
          GET /api/resolutions{companySlug ? `?company=${companySlug}` : ""}
        </span>{" "}
        returns both, filterable by company, hire and date.
      </p>
    </section>
  );
}

function Figure({
  value,
  of,
  caption,
}: {
  value: string | null;
  of?: string;
  caption: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3.5">
      <div className="flex items-baseline gap-2">
        {value === null ? (
          <span className="skeleton inline-block h-7 w-12 rounded" />
        ) : (
          <span className="tnum text-[28px] leading-none font-semibold tracking-[-0.02em]">
            {value}
          </span>
        )}
        {of && <span className="tnum text-[12px] text-faint">{of}</span>}
      </div>
      <p className="mt-2 max-w-[46ch] text-[12.5px] leading-[1.55] text-muted">{caption}</p>
    </div>
  );
}
