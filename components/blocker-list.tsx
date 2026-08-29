import type { Blocker } from "@/lib/types";
import { Label, Pill, agoFrom } from "./ui";

export type HireRef = { name: string; roleTitle?: string };

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function Avatar({ name, tone }: { name: string; tone: "warn" | "ok" }) {
  return (
    <span
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold ${
        tone === "warn"
          ? "bg-warn/15 text-warn"
          : "bg-ok-soft text-ok"
      }`}
    >
      {initials(name)}
    </span>
  );
}

export default function BlockerList({
  blockers,
  people = {},
  now,
}: {
  blockers: Blocker[];
  people?: Record<string, HireRef>;
  /** Pinned "now" so relative times don't drift between server and client. */
  now?: number;
}) {
  const at = now ?? Date.now();
  const needsHuman = blockers.filter((b) => b.needsHuman && !b.resolved);
  const handled = blockers.filter((b) => !b.needsHuman || b.resolved);

  const minutes = needsHuman.reduce(
    (sum, b) => sum + (b.minutesToUnblock ?? 0),
    0,
  );

  if (blockers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
        <p className="text-[15px] font-medium">Nobody is blocked.</p>
        <p className="mx-auto mt-1.5 max-w-[46ch] text-[13.5px] leading-relaxed text-muted">
          When the agent hits something it genuinely can&rsquo;t resolve from
          company context, it will appear here — and nowhere else.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {/* ── the only number on this page that is about a manager's time ── */}
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        <Stat
          value={String(needsHuman.length)}
          label="need you"
          tone={needsHuman.length > 0 ? "warn" : "muted"}
        />
        <Stat value={String(handled.length)} label="the agent handled" tone="ok" />
        <Stat
          value={minutes > 0 ? `${minutes} min` : "0 min"}
          label="of your time, honestly estimated"
          tone="muted"
        />
      </div>

      {/* ── needs a human ── */}
      <section className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-warn" />
          <Label className="!text-warn">Needs a human</Label>
          <span className="tnum text-[11px] text-faint">
            {needsHuman.length}
          </span>
        </div>

        {needsHuman.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13.5px] text-muted">
            Nothing is waiting on you right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {needsHuman.map((b) => {
              const who = people[b.hireId];
              return (
                <li
                  key={b.id}
                  className="overflow-hidden rounded-xl border border-warn-line bg-surface"
                  style={{ boxShadow: "var(--shadow)" }}
                >
                  <div className="flex">
                    <div className="w-[3px] shrink-0 bg-warn" />
                    <div className="min-w-0 flex-1 px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Avatar name={who?.name ?? b.hireId} tone="warn" />
                        <span className="text-[13.5px] font-medium">
                          {who?.name ?? b.hireId}
                        </span>
                        {who?.roleTitle && (
                          <span className="truncate text-[12px] text-faint">
                            {who.roleTitle}
                          </span>
                        )}
                        <span className="tnum ml-auto text-[11.5px] text-faint">
                          raised {agoFrom(b.raisedAt, at)}
                        </span>
                      </div>

                      <p className="mt-3 max-w-[68ch] text-[15px] leading-[1.55] font-medium tracking-[-0.005em] text-ink">
                        {b.summary}
                      </p>

                      <div className="mt-3.5 flex flex-wrap items-center gap-2">
                        {b.suggestedPerson && (
                          <Pill tone="warn">
                            <svg
                              viewBox="0 0 16 16"
                              fill="none"
                              className="h-3 w-3"
                              aria-hidden
                            >
                              <circle
                                cx="8"
                                cy="5.75"
                                r="2.6"
                                stroke="currentColor"
                                strokeWidth="1.3"
                              />
                              <path
                                d="M3.4 13.2c.6-2.2 2.4-3.3 4.6-3.3s4 1.1 4.6 3.3"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                              />
                            </svg>
                            {b.suggestedPerson} can unblock this
                          </Pill>
                        )}
                        {typeof b.minutesToUnblock === "number" && (
                          <Pill>
                            <svg
                              viewBox="0 0 16 16"
                              fill="none"
                              className="h-3 w-3"
                              aria-hidden
                            >
                              <circle
                                cx="8"
                                cy="8"
                                r="5.9"
                                stroke="currentColor"
                                strokeWidth="1.3"
                              />
                              <path
                                d="M8 4.9V8l2.2 1.4"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="tnum">
                              ~{b.minutesToUnblock} min to unblock
                            </span>
                          </Pill>
                        )}
                        {b.taskId && (
                          <span className="font-mono text-[11px] text-faint">
                            {b.taskId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── agent handled it ── */}
      <section className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-ok" />
          <Label className="!text-ok">The agent handled it</Label>
          <span className="tnum text-[11px] text-faint">{handled.length}</span>
          <span className="ml-auto hidden text-[11.5px] text-faint sm:block">
            resolved from company context — no interruption sent
          </span>
        </div>

        {handled.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13.5px] text-muted">
            Nothing resolved yet today.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {handled.map((b) => {
              const who = people[b.hireId];
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:px-5"
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-4 w-4 shrink-0 text-ok"
                    aria-hidden
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="7"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                    <path
                      d="M4.75 8.2 7 10.4l4.25-4.6"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="min-w-0 flex-1 text-[14px] leading-snug text-ink">
                    {b.summary}
                  </span>
                  <span className="text-[12px] text-muted">
                    {who?.name ?? b.hireId}
                  </span>
                  <span className="tnum w-16 text-right text-[11.5px] text-faint">
                    {agoFrom(b.raisedAt, at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
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
  const color =
    tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-ink";
  return (
    <div className="bg-surface px-5 py-4">
      <div className={`tnum text-[26px] leading-none font-semibold tracking-[-0.02em] ${color}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[12.5px] text-muted">{label}</div>
    </div>
  );
}
