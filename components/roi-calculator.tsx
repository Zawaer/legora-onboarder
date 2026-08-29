"use client";

import { useState } from "react";
import { Label } from "@/components/ui";

/**
 * The pricing calculator.
 *
 * A calculator like this is only worth anything if a sceptic can take it apart,
 * so every assumption is an editable field with its source written next to it,
 * and every default is deliberately set at the low end of what we can defend.
 * A number a buyer can push *up* themselves is believed; a number we picked for
 * them is not.
 *
 * The two savings are kept apart on purpose, because they are believed very
 * differently:
 *
 *   - Interruptions avoided is the floor. It is the thing the product actually
 *     counts in production (`/api/resolutions`), so it is the half we can show
 *     evidence for rather than argue for.
 *   - Ramp time saved is the larger number and the softer one. It rests on a
 *     claim about how much faster someone gets productive, which no demo can
 *     settle in a weekend.
 *
 * Presenting them as one blended figure would let the soft half borrow the hard
 * half's credibility. Split, the pitch gets stronger rather than weaker: the
 * floor alone already pays for the product, so the ramp claim can be argued on
 * its merits instead of load-bearing the whole case.
 */

const PRICE_PER_HIRE = 249;

const money = (n: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));

function Field({
  label,
  value,
  onChange,
  suffix,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  min?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2">
      <span className="text-[13px] leading-snug text-muted">{label}</span>
      <span className="flex shrink-0 items-baseline gap-1.5">
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
          className="w-20 rounded-md border border-line bg-paper px-2 py-1 text-right font-mono text-[13px] tabular-nums text-ink focus:border-accent focus:outline-none"
        />
        {suffix && <span className="w-10 font-mono text-[11px] text-faint">{suffix}</span>}
      </span>
    </label>
  );
}

export default function RoiCalculator() {
  const [employees, setEmployees] = useState(400);
  const [hiresPerWeek, setHiresPerWeek] = useState(3);
  const [open, setOpen] = useState(false);

  // Assumptions. All editable, all defaulted low.
  const [dayRate, setDayRate] = useState(460);
  const [daysSaved, setDaysSaved] = useState(4);
  const [questions, setQuestions] = useState(12);
  const [minutes, setMinutes] = useState(10);
  const [seniorRate, setSeniorRate] = useState(75);

  const hiresPerYear = hiresPerWeek * 52;
  const cost = hiresPerYear * PRICE_PER_HIRE;

  const rampSaving = hiresPerYear * daysSaved * dayRate;
  const interruptSaving =
    hiresPerYear * questions * (minutes / 60) * seniorRate;
  const total = rampSaving + interruptSaving;
  const multiple = cost > 0 ? total / cost : 0;

  // The share of the company that is inside its first month at any moment.
  const newShare = employees > 0 ? (hiresPerWeek * 4) / employees : 0;

  return (
    <div
      className="overflow-hidden rounded-xl border border-line-strong bg-surface"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-2/70 px-5 py-3">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
          What it is worth to you
        </span>
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
          {money(PRICE_PER_HIRE)} per hire
        </span>
      </div>

      <div className="grid gap-8 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        {/* ── the two inputs a buyer actually knows off the top of their head ── */}
        <div>
          <Label>Your company</Label>
          <div className="mt-3 divide-y divide-line border-y border-line">
            <Field label="People today" value={employees} onChange={setEmployees} />
            <Field
              label="New hires per week"
              value={hiresPerWeek}
              onChange={setHiresPerWeek}
            />
          </div>

          <p className="mt-4 text-[13px] leading-[1.6] text-muted">
            That is{" "}
            <span className="font-medium text-ink">
              {hiresPerYear.toLocaleString("en-IE")} people a year
            </span>
            , and at any moment{" "}
            <span className="font-medium text-ink">
              {(newShare * 100).toFixed(1)}%
            </span>{" "}
            of your company is inside its first month.
          </p>
        </div>

        {/* ── the result ── */}
        <div>
          <Label>Per year</Label>

          <div className="mt-3 flex flex-col gap-3 border-y border-line py-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[13px] text-muted">
                Senior time not spent answering
                <span className="ml-1.5 rounded border border-ok-line bg-ok-soft px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ok">
                  measured
                </span>
              </span>
              <span className="shrink-0 font-mono text-[15px] tabular-nums">
                {money(interruptSaving)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[13px] text-muted">
                Ramp time saved
                <span className="ml-1.5 rounded border border-line-strong px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-faint">
                  modelled
                </span>
              </span>
              <span className="shrink-0 font-mono text-[15px] tabular-nums">
                {money(rampSaving)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
              <span className="text-[13px] text-muted">What you pay us</span>
              <span className="shrink-0 font-mono text-[15px] tabular-nums text-muted">
                −{money(cost)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
                Net
              </div>
              <div className="mt-1 text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                {money(total - cost)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
                Return
              </div>
              <div className="mt-1 text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums text-accent-ink">
                {multiple.toFixed(1)}×
              </div>
            </div>
          </div>

          <p className="mt-4 text-[12.5px] leading-[1.55] text-faint">
            The measured line alone is {(interruptSaving / Math.max(cost, 1)).toFixed(1)}× the price. Every
            assumption below is editable — push them to numbers you believe.
          </p>
        </div>
      </div>

      {/* ── the arithmetic, open to inspection ── */}
      <div className="border-t border-line bg-surface-2/40 px-5 py-4 sm:px-7">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted hover:text-ink"
        >
          <span aria-hidden className="inline-block w-3">
            {open ? "−" : "+"}
          </span>
          Assumptions and where they come from
        </button>

        {open && (
          <div className="mt-4 grid gap-x-10 gap-y-1 sm:grid-cols-2">
            <div className="divide-y divide-line">
              <Field
                label="Fully-loaded cost per person, per day"
                value={dayRate}
                onChange={setDayRate}
                suffix="EUR"
              />
              <Field
                label="Days of ramp saved per hire"
                value={daysSaved}
                onChange={setDaysSaved}
                suffix="days"
              />
            </div>
            <div className="divide-y divide-line">
              <Field
                label="Questions per hire that never reach a colleague"
                value={questions}
                onChange={setQuestions}
                suffix="qs"
              />
              <Field
                label="Minutes each, including the context switch"
                value={minutes}
                onChange={setMinutes}
                suffix="min"
              />
              <Field
                label="Senior hourly cost"
                value={seniorRate}
                onChange={setSeniorRate}
                suffix="EUR"
              />
            </div>

            <p className="mt-3 text-[12.5px] leading-[1.6] text-muted sm:col-span-2">
              <span className="text-ink">Where these come from.</span> The daily
              cost is a fully-loaded figure for an engineer at a company of this
              size in the Nordics. Days saved defaults to 4 against a two-week
              ramp — the low end, not the ceiling. The questions figure is the
              one thing here the product measures rather than assumes: it counts
              every question resolved from your own material or from the web
              without a colleague being interrupted, and reports it at{" "}
              <code className="font-mono text-[12px] text-accent-ink">
                /api/resolutions
              </code>
              . Ten minutes per interruption is conservative; the research on
              context switching puts the true cost higher.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
