"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui";

/**
 * The scroll-driven product story.
 *
 * The rest of the page describes what the agent does. This shows it: the panel
 * pins while the text scrolls past it, and the panel's state changes as each
 * step arrives, so a reader watches an empty workspace turn into a person doing
 * real work without clicking anything.
 *
 * State is driven by which step is in the reading band, not by scroll maths.
 * An IntersectionObserver with a narrow rootMargin fires when a step reaches
 * the middle third of the viewport, which is where someone is actually reading
 * rather than where the element happens to be. Scroll-position arithmetic gets
 * this wrong on short viewports and wrong again on a trackpad fling.
 *
 * Everything degrades to a plain list. Without JS the steps are visible, the
 * panel shows its final state, and nothing is hidden: the page still says what
 * it needs to say, which is the same rule the reveal system follows.
 */

type Step = {
  eyebrow: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    eyebrow: "Step one",
    title: "It reads what the company already wrote.",
    body: "Slack, docs, tickets, meeting notes. Nobody prepares anything, and nobody writes a brief. The material already exists because the work already happened.",
  },
  {
    eyebrow: "Step two",
    title: "The role comes out of the evidence.",
    body: "Not a job description someone wrote from memory. What this person will actually do, drawn from what the team has been doing, with every claim pointing at the message it came from.",
  },
  {
    eyebrow: "Step three",
    title: "Two days of real work, not a reading list.",
    body: "Each task carries why it matters, what finished looks like, and enough context to start without interrupting anyone.",
  },
  {
    eyebrow: "Step four",
    title: "Questions get answered where they are asked.",
    body: "From the company's own messages when the answer exists, from the web when the question is not about this company, and from a named person only when it genuinely needs one.",
  },
  {
    eyebrow: "Step five",
    title: "The manager sees blockers. Nothing else.",
    body: "No scores, no ranking, no completion percentage. Only what someone is stuck on and who can clear it.",
  },
];

export default function Story() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        // The last step to enter the reading band wins. Taking the first would
        // make the panel jump backwards when two steps are on screen at once.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => Number((e.target as HTMLElement).dataset.step));
        if (visible.length) setActive(Math.max(...visible));
      },
      // The middle third: where a step is being read, not merely present.
      { rootMargin: "-35% 0px -45% 0px", threshold: 0 },
    );

    for (const el of stepRefs.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      data-reveal
      className="border-b border-line py-14 lg:py-20"
      aria-label="How it works, step by step"
    >
      <Label>What actually happens</Label>
      <h2 className="mt-4 max-w-[22ch] text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[38px]">
        An empty workspace becomes somebody doing real work.
      </h2>

      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* The steps. Ordinary flow: they scroll. */}
        <ol className="flex flex-col">
          {STEPS.map((s, i) => (
            <li key={s.eyebrow}>
              <div
                data-step={i}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                className={`border-l-2 py-8 pl-5 transition-colors duration-500 lg:py-14 ${
                  i === active ? "border-ink" : "border-line"
                }`}
              >
                <span
                  className={`font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-500 ${
                    i === active ? "text-ink" : "text-faint"
                  }`}
                >
                  {s.eyebrow}
                </span>
                <h3
                  className={`mt-2.5 max-w-[24ch] text-[20px] leading-[1.25] font-semibold tracking-[-0.015em] transition-opacity duration-500 sm:text-[23px] ${
                    i === active ? "opacity-100" : "opacity-45"
                  }`}
                >
                  {s.title}
                </h3>
                <p
                  className={`mt-2.5 max-w-[46ch] text-[14.5px] leading-[1.6] text-muted transition-opacity duration-500 ${
                    i === active ? "opacity-100" : "opacity-40"
                  }`}
                >
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* The panel. Pinned, and it changes as the steps go by. */}
        <div className="hidden lg:block">
          <div className="sticky top-28">
            <Panel active={active} />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The pinned panel.
 *
 * Every state is rendered and only opacity changes, so the panel never resizes
 * as it switches. A sticky element that changes height drags the page under the
 * reader's cursor, which is the fastest way to make a scroll story feel broken.
 */
function Panel({ active }: { active: number }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-line-strong bg-surface"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-2/70 px-5 py-3">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
          {["Reading", "Role", "Plan", "Questions", "Manager"][active]}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-faint">
          {active + 1} / {STEPS.length}
        </span>
      </div>

      <div className="relative min-h-[330px]">
        {STATES.map((render, i) => (
          <div
            key={i}
            aria-hidden={i !== active}
            className={`absolute inset-0 px-5 py-5 transition-all duration-500 ${
              i === active
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-2 opacity-0"
            }`}
          >
            {render()}
          </div>
        ))}
      </div>
    </div>
  );
}

const row = (left: string, right: string, key: string) => (
  <div key={key} className="flex items-baseline justify-between gap-4 py-2">
    <span className="text-[13.5px] text-muted">{left}</span>
    <span className="shrink-0 font-mono text-[12.5px] tabular-nums text-ink">{right}</span>
  </div>
);

const STATES: (() => React.ReactNode)[] = [
  () => (
    <>
      <Label>What it read</Label>
      <div className="mt-3 divide-y divide-line border-y border-line">
        {row("Slack messages", "63", "a")}
        {row("People", "14", "b")}
        {row("Documents and tickets", "14", "c")}
        {row("Days covered", "22", "d")}
      </div>
      <p className="mt-4 text-[13px] leading-[1.6] text-faint">
        And it says what it could not see: no DMs, no meetings, no calls.
      </p>
    </>
  ),
  () => (
    <>
      <Label>Derived role</Label>
      <p className="mt-3 text-[17px] leading-snug font-semibold">Legal Engineer</p>
      <blockquote className="mt-3 border-l-2 border-accent pl-3.5 text-[13.5px] leading-[1.55] text-muted">
        &ldquo;the person starting sept 1 is ex-M&amp;A, 6 years, london&hellip; no
        coding at all&rdquo;
      </blockquote>
      <p className="mt-2 font-mono text-[11.5px] text-accent-ink">
        #legal-eng · Elin Sandberg · 27 Aug
      </p>
      <p className="mt-4 text-[13px] leading-[1.6] text-faint">
        Every quote checked word for word against the message it came from.
      </p>
    </>
  ),
  () => (
    <>
      <Label>Day 1</Label>
      <p className="mt-3 text-[14.5px] leading-snug font-medium">
        Write the list of every place we are wrong on three Nordkap SPAs
      </p>
      <p className="mt-2.5 border-l-2 border-ok/50 pl-3 text-[13px] leading-[1.55] text-muted">
        <span className="text-ink">Done when</span> a doc exists with one
        numbered row per divergence, each citing the clause it came from.
      </p>
      <p className="mt-4 text-[13px] leading-[1.6] text-faint">
        Ask Johan Lindqvist if stuck. About five minutes of his time.
      </p>
    </>
  ),
  () => (
    <>
      <Label>Three questions</Label>
      <div className="mt-3 flex flex-col divide-y divide-line border-y border-line">
        <p className="py-2.5 text-[13px] leading-[1.5]">
          <span className="text-ink">In the messages.</span>{" "}
          <span className="text-muted">Quoted, with the person and the date.</span>
        </p>
        <p className="py-2.5 text-[13px] leading-[1.5]">
          <span className="text-ink">Not about this company.</span>{" "}
          <span className="text-muted">Answered from the web. Nobody interrupted.</span>
        </p>
        <p className="py-2.5 text-[13px] leading-[1.5]">
          <span className="text-ink">Only your team knows.</span>{" "}
          <span className="text-muted">One named person, asked once.</span>
        </p>
      </div>
    </>
  ),
  () => (
    <>
      <Label>Manager view</Label>
      <div className="mt-3 rounded-lg border border-warn-line bg-warn-soft px-3.5 py-3">
        <p className="text-[13.5px] leading-[1.5] text-ink">
          Cannot see the Nordkap workspace under SSO.
        </p>
        <p className="mt-1.5 font-mono text-[11.5px] text-warn">
          Johan Lindqvist · about 5 min
        </p>
      </div>
      <p className="mt-4 text-[13px] leading-[1.6] text-faint">
        Nine other questions were answered without anyone being interrupted. No
        scores, no ranking, no percentage complete.
      </p>
    </>
  ),
];
