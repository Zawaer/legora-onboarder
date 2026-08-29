import type { Artifact, DerivedRole } from "@/lib/types";
import { Label, Pill } from "./ui";

/* ── source icons ─────────────────────────────────────────────────────── */

function KindIcon({ kind }: { kind?: Artifact["kind"] }) {
  const c = "h-3.5 w-3.5 shrink-0";
  if (kind === "doc")
    return (
      <svg viewBox="0 0 16 16" fill="none" className={c} aria-hidden>
        <path
          d="M9 1.75H4.75A1.25 1.25 0 0 0 3.5 3v10a1.25 1.25 0 0 0 1.25 1.25h6.5A1.25 1.25 0 0 0 12.5 13V5.25L9 1.75Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M9 1.75V5.25h3.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  if (kind === "ticket")
    return (
      <svg viewBox="0 0 16 16" fill="none" className={c} aria-hidden>
        <rect
          x="2"
          y="4"
          width="12"
          height="8"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path d="M5.5 7.25h5M5.5 9.5h3" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  if (kind === "meeting")
    return (
      <svg viewBox="0 0 16 16" fill="none" className={c} aria-hidden>
        <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 4.75V8l2.25 1.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" fill="none" className={c} aria-hidden>
      <path
        d="M6.25 2.5 5 13.5M11 2.5 9.75 13.5M2.75 5.75h10.5M2.25 10.25h10.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function sourceLine(a?: Artifact, fallbackId?: string) {
  if (!a) return fallbackId ?? "unattributed source";
  if (a.channel) return a.channel.startsWith("#") ? a.channel : `#${a.channel}`;
  if (a.title) return a.title;
  return a.kind;
}

function dayStamp(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
      d.getUTCMonth()
    ]
  }`;
}

/* ── the card ─────────────────────────────────────────────────────────── */

export default function RoleCard({
  role,
  artifacts = [],
  companyName,
}: {
  role?: DerivedRole;
  artifacts?: Artifact[];
  companyName?: string;
}) {
  if (!role) return <RoleCardSkeleton />;

  const byId = new Map(artifacts.map((a) => [a.id, a]));
  const evidence = role.evidence ?? [];

  return (
    <article className="flex flex-col gap-9 pb-14">
      {/* ── header ── */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Label>Derived role</Label>
          <span className="h-3 w-px bg-line" />
          <span className="text-[11px] text-faint">
            reconstructed from {companyName ?? "the company"}&rsquo;s own record
          </span>
        </div>
        <h1 className="text-[28px] leading-[1.12] font-semibold tracking-[-0.022em] text-balance sm:text-[32px]">
          {role.title}
        </h1>
        <p className="max-w-[62ch] text-[16px] leading-[1.62] text-muted">
          {role.summary}
        </p>
      </header>

      {/* ── evidence: the proof it isn't invented ── */}
      {evidence.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Label>Evidence</Label>
            <Pill tone="accent">
              <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden>
                <path
                  d="M3.5 8.4 6.4 11.3 12.5 5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {evidence.length} quote{evidence.length === 1 ? "" : "s"} verified
              against source
            </Pill>
          </div>
          <p className="-mt-1 max-w-[60ch] text-[13px] leading-[1.6] text-faint">
            Every claim above points at a message someone actually wrote. Nothing
            here was inferred from a job description, because there isn&rsquo;t
            one.
          </p>

          <ol className="flex flex-col gap-3">
            {evidence.map((e, i) => {
              const a = byId.get(e.artifactId);
              return (
                <li
                  key={`${e.artifactId}-${i}`}
                  className="group overflow-hidden rounded-lg border border-line bg-surface"
                >
                  <div className="flex gap-0">
                    <div className="w-[3px] shrink-0 bg-accent/55 transition-colors group-hover:bg-accent" />
                    <div className="min-w-0 flex-1 px-4 py-3.5 sm:px-5">
                      <blockquote className="text-[15px] leading-[1.6] font-medium tracking-[-0.005em] break-words hyphens-auto text-ink">
                        <span className="mr-0.5 text-accent">&ldquo;</span>
                        {e.quote}
                        <span className="ml-0.5 text-accent">&rdquo;</span>
                      </blockquote>

                      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] tracking-tight text-accent-ink">
                          <KindIcon kind={a?.kind} />
                          {sourceLine(a, e.artifactId)}
                        </span>
                        {a?.author && (
                          <>
                            <span className="text-line-strong">/</span>
                            <span className="font-medium text-ink">
                              {a.author}
                            </span>
                          </>
                        )}
                        {a?.authorRole && (
                          <span className="text-faint">{a.authorRole}</span>
                        )}
                        {a?.timestamp && (
                          <>
                            <span className="text-line-strong">/</span>
                            <span className="tnum text-faint">
                              {dayStamp(a.timestamp)}
                            </span>
                          </>
                        )}
                      </div>

                      {e.why && (
                        <p className="mt-2.5 border-t border-line pt-2.5 text-[13px] leading-[1.55] text-muted">
                          <span className="font-medium text-ink">
                            Why this matters:{" "}
                          </span>
                          {e.why}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* ── responsibilities ── */}
      {role.responsibilities?.length > 0 && (
        <section className="flex flex-col gap-3">
          <Label>What the job actually is</Label>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {role.responsibilities.map((r, i) => (
              <li key={i} className="flex gap-3.5 py-3">
                <span className="tnum mt-[3px] w-5 shrink-0 font-mono text-[11px] text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[14.5px] leading-[1.55] text-ink">{r}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── first week outcomes ── */}
      {role.firstWeekOutcomes?.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <Label>Ramped looks like this</Label>
            <span className="text-[11px] text-faint">
              outcomes by end of week one — not a reading list
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {role.firstWeekOutcomes.map((o, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-line bg-surface-2/60 px-4 py-3"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className="mt-[3px] h-3.5 w-3.5 shrink-0 text-ok"
                  aria-hidden
                >
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
                  <path
                    d="M4.75 8.2 7 10.4l4.25-4.6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[14.5px] leading-[1.55]">{o}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── key people ── */}
      {role.keyPeople?.length > 0 && (
        <section className="flex flex-col gap-3">
          <Label>Who this role runs on</Label>
          <ul className="grid gap-2 sm:grid-cols-2">
            {role.keyPeople.map((p, i) => (
              <li
                key={i}
                className="rounded-lg border border-line bg-surface px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">
                    {p.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="truncate text-[14px] font-medium">
                    {p.name}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-[1.5] text-muted">{p.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── open questions ── */}
      {role.openQuestions?.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <Label className="!text-warn">The company hasn&rsquo;t settled this</Label>
          </div>
          <div className="rounded-lg border border-warn-line bg-warn-soft px-4 py-4 sm:px-5">
            <p className="text-[13px] leading-[1.6] text-warn">
              Not gaps in the derivation — genuine open decisions. The agent will
              not invent an answer to any of these, and will route them to a
              human if the hire hits one.
            </p>
            <ul className="mt-3.5 flex flex-col gap-2.5">
              {role.openQuestions.map((q, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-warn/70" />
                  <span className="text-[14px] leading-[1.55] text-ink">{q}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </article>
  );
}

/* ── loading ──────────────────────────────────────────────────────────── */

export function RoleCardSkeleton() {
  return (
    <div className="flex flex-col gap-8 pb-14" aria-busy>
      <div className="flex flex-col gap-4">
        <div className="skeleton h-2.5 w-24 rounded-full" />
        <div className="skeleton h-8 w-64 rounded-md" />
        <div className="flex flex-col gap-2">
          <div className="skeleton h-3.5 w-full rounded-full" />
          <div className="skeleton h-3.5 w-[92%] rounded-full" />
          <div className="skeleton h-3.5 w-[64%] rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="skeleton h-2.5 w-20 rounded-full" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-4">
            <div className="skeleton h-3.5 w-full rounded-full" />
            <div className="skeleton mt-2 h-3.5 w-[78%] rounded-full" />
            <div className="skeleton mt-4 h-2.5 w-36 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
