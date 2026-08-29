/**
 * Who's who — the people a new hire will actually run into, derived.
 *
 * Steinmacher's newcomer-barrier work puts *social* barriers above documentation
 * ones: the thing that stops week one is not a missing README, it is not knowing
 * who anybody is or whose desk a question belongs on. This panel is the answer
 * to that, and it is derived from the corpus rather than nominated by anyone —
 * which is the only way it can exist at a company that has not written the
 * onboarding doc yet.
 *
 * Every row carries its receipts. The reason line is a claim about a colleague,
 * shown to a new hire who cannot yet tell a true one from a plausible one, so it
 * expands into the verbatim messages it was read off. Anybody with no surviving
 * quote is not listed at all — see `experts.impl.ts`.
 */

import { whosWho } from "@/lib/agent/experts.impl";
import type { Artifact, Company } from "@/lib/types";
import { Label, initials } from "./ui";

/* ── data ─────────────────────────────────────────────────────────────── */

/**
 * Self-contained on purpose: the page it mounts on knows a hire id and nothing
 * else, so the panel does its own lookups and renders nothing at all if any of
 * them come up empty. It must never be able to take the workspace down.
 */
export default async function WhosWhoPanel({ hireId }: { hireId: string }) {
  let company: Company | undefined;
  let roleTitle = "";

  try {
    const { getHire } = await import("@/lib/agent/hires");
    const hire = await getHire(hireId);
    if (!hire) return null;
    roleTitle = hire.roleTitle;

    // Through loadCompany, not the seed lookup: it is the one loader that also
    // layers in what colleagues have since been asked and confirmed. Resolving
    // the corpus here instead would make every elicited answer invisible on
    // this panel while it stayed citable everywhere else.
    const { loadCompany } = await import("@/lib/agent/knowledge");
    company = await loadCompany(hire.companySlug);
  } catch {
    return null;
  }

  if (!company) return null;

  const people = whosWho(company, roleTitle, { limit: 10 });
  if (!people.length) return null;

  return (
    <WhosWho
      people={people}
      artifacts={company.artifacts}
      companyName={company.name}
      derivedOwnership={company.people.every((p) => p.owns.length === 0)}
    />
  );
}

/* ── the panel ────────────────────────────────────────────────────────── */

type Row = ReturnType<typeof whosWho>[number];

export function WhosWho({
  people,
  artifacts,
  companyName,
  derivedOwnership,
}: {
  people: Row[];
  artifacts: Artifact[];
  companyName?: string;
  /** True when the roster carried no stated ownership and this is all there is. */
  derivedOwnership?: boolean;
}) {
  if (!people.length) return null;
  const byId = new Map(artifacts.map((a) => [a.id, a]));

  return (
    <section className="border-t border-line bg-surface-2/40">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label>Who&rsquo;s who</Label>
            <span className="h-3 w-px bg-line" />
            <span className="text-[11px] text-faint">
              {people.length} {people.length === 1 ? "person" : "people"} you will run
              into, read off {companyName ?? "the company"}&rsquo;s own record
            </span>
          </div>
          <span className="text-[11.5px] text-muted">
            {derivedOwnership
              ? "Nobody in this corpus states what they own, this is behaviour, not titles."
              : "Derived from who answers, who gets named, and who decides."}
          </span>
        </div>

        <ul className="mt-5 grid gap-2.5 lg:grid-cols-2">
          {people.map(({ person, why, evidence }) => (
            <li
              key={person.slackHandle + person.name}
              className="overflow-hidden rounded-lg border border-line bg-surface"
            >
              <details className="group">
                <summary className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-[1px] grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">
                    {initials(person.name)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[14px] font-medium tracking-[-0.005em]">
                        {person.name}
                      </span>
                      <span className="font-mono text-[11px] text-accent-ink">
                        {person.slackHandle}
                      </span>
                      <span className="truncate text-[11.5px] text-faint">
                        {person.role}
                      </span>
                    </span>
                    <span className="mt-1 block text-[13px] leading-[1.5] text-muted">
                      {why}
                    </span>
                  </span>

                  <span className="mt-[3px] flex shrink-0 items-center gap-1.5 text-[11px] text-faint">
                    <span className="tnum">{evidence.length}</span>
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      className="chev h-3 w-3 transition-transform"
                      aria-hidden
                    >
                      <path
                        d="M6 3.5 10.5 8 6 12.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </summary>

                <ol className="flex flex-col divide-y divide-line border-t border-line">
                  {evidence.map((e, i) => {
                    const a = byId.get(e.artifactId);
                    return (
                      <li key={`${e.artifactId}-${i}`} className="px-4 py-3">
                        <blockquote className="border-l-2 border-accent/45 pl-3 text-[13px] leading-[1.55] break-words whitespace-pre-line text-ink">
                          {e.quote}
                        </blockquote>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-3 text-[11.5px] text-faint">
                          <span className="rounded-sm bg-surface-2 px-1.5 py-[1px] text-[10.5px] font-medium text-muted">
                            {SIGNAL_COPY[e.signal]}
                          </span>
                          <span className="font-mono text-[11px] text-accent-ink">
                            {e.channel ?? e.artifactId}
                          </span>
                          {a?.author && (
                            <>
                              <span className="text-line-strong">/</span>
                              <span>{a.author}</span>
                            </>
                          )}
                          <span className="text-line-strong">/</span>
                          <span className="tnum">{dayStamp(e.timestamp)}</span>
                          <span className="text-line-strong">/</span>
                          <span className="font-mono text-[10.5px]">{e.artifactId}</span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── small stuff ──────────────────────────────────────────────────────── */

/** What each signal meant, in the words a person would use for it. */
const SIGNAL_COPY: Record<Row["evidence"][number]["signal"], string> = {
  answered: "answered here",
  named: "someone asked for them",
  decided: "called it",
  mentioned: "was in this",
};

function dayStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}
