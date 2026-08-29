"use client";

import { useState } from "react";
import { Label } from "@/components/ui";

/**
 * What it saves, against what it costs.
 *
 * Every constant below is fixed and disclosed rather than hidden behind the
 * output, and the formula is printed in full underneath. A number a buyer
 * cannot take apart is a number they discount to zero, so the arithmetic is
 * the product here, not the total.
 *
 * The two savings stay separate because they are believed differently. Senior
 * time recovered is the half this product actually counts in production and
 * reports at /api/resolutions. Ramp acceleration is the larger half and rests
 * on a claim no demo can settle, so the page also states the ramp improvement
 * at which the whole thing stops paying for itself, which is the number a
 * sceptic is really asking for.
 *
 * It now lives behind a disclosure. The arithmetic is the best answer this
 * page has for a sceptic, but a sceptic is not the first reader, and two
 * sliders and a breakdown were the first thing anyone saw. The headline
 * sentence on the page carries the number; this carries the proof.
 *
 * Deliberately excluded: attrition savings and the cost of a bad hire. Both
 * are standard in this category's pitch decks and neither has a source we
 * would defend, so counting them would buy a bigger number at the price of the
 * one thing the page is for.
 */

// Fixed, disclosed constants.
const MULT = 1.46; // Swedish statutory employer cost on top of gross
const HOURS = 1808; // worked hours a year, after 25 vacation days
const DAYS = 226; // worked days a year
const QUESTIONS = 32; // per new hire, weeks 1-4, that reach a senior
const DEFLECT = 0.5; // share answered without a human
const RESUME = 25.4 / 60; // hours lost per interruption (CHI 2005)
const RAMP = 39; // days to a new engineer's 10th merged PR
const IMPROVE = 0.15; // ramp improvement, conservative for AI dev tools
const SHORTFALL = 0.4; // productivity gap while ramping
const JUNIOR = 0.8; // new hire salary as a share of the average

const eur = (n: number) =>
  "€" + Math.round(n).toLocaleString("en-US");

/** Cheaper of the two annual plans at this volume. */
function planCost(hires: number) {
  const team = 19_200 + 500 * Math.max(0, hires - 12);
  const scale = 38_400 + 300 * Math.max(0, hires - 40);
  return team <= scale
    ? { name: "team" as const, cost: team }
    : { name: "scale" as const, cost: scale };
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-4">
        <span className="text-[13px] text-muted">{label}</span>
        <span className="font-mono text-[14px] tabular-nums">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2.5 w-full accent-accent"
      />
    </label>
  );
}

export default function RoiCalculator() {
  const [hires, setHires] = useState(60);
  const [salary, setSalary] = useState(72_000);
  const [open, setOpen] = useState(false);

  const seniorHour = (salary * MULT) / HOURS;
  const newDay = (salary * JUNIOR * MULT) / DAYS;

  const softHours = QUESTIONS * DEFLECT * RESUME; // per hire
  const soft = softHours * seniorHour * hires;

  const daysPer = RAMP * IMPROVE;
  const hard = daysPer * newDay * SHORTFALL * hires;

  const total = soft + hard;
  const plan = planCost(hires);
  const months = total > 0 ? (plan.cost / total) * 12 : 0;
  const allDays = daysPer * hires + (softHours * hires) / 8;

  // Ramp improvement at which this stops paying for itself, holding all else.
  const perPoint = RAMP * 0.01 * newDay * SHORTFALL * hires;
  const breakEven = perPoint > 0 ? (plan.cost - soft) / perPoint : 0;

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
            {plan.name === "team" ? "Team" : "Scale"} fits you
          </span>
        </div>

        <div className="grid gap-8 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col gap-6">
            <Slider
              label="Engineers hired per year"
              value={hires}
              display={String(hires)}
              min={10}
              max={300}
              step={5}
              onChange={setHires}
            />
            <Slider
              label="Average engineer salary"
              value={salary}
              display={eur(salary)}
              min={45_000}
              max={140_000}
              step={2_000}
              onChange={setSalary}
            />
            <p className="text-[13px] leading-[1.6] text-muted">
              Recovers about{" "}
              <span className="font-medium text-ink">
                {Math.round(allDays).toLocaleString("en-US")} engineer-days
              </span>{" "}
              a year: senior hours not spent answering, plus new hires reaching
              full output earlier.
            </p>
          </div>

          <div>
            <Label>Per year</Label>
            <div className="mt-3 flex flex-col gap-3 border-y border-line py-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[13px] text-muted">
                  Senior time recovered
                  <span className="ml-1.5 rounded border border-ok-line bg-ok-soft px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ok">
                    measured
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[15px] tabular-nums">
                  {eur(soft)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[13px] text-muted">
                  Ramp acceleration
                  <span className="ml-1.5 rounded border border-line-strong px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-faint">
                    modelled
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[15px] tabular-nums">
                  {eur(hard)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
                <span className="text-[13px] text-muted">Your plan</span>
                <span className="shrink-0 font-mono text-[15px] tabular-nums text-muted">
                  −{eur(plan.cost)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
                  Recovered capacity
                </div>
                <div className="mt-1 text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                  {eur(total)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
                  Payback
                </div>
                <div className="mt-1 text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums text-accent-ink">
                  {months < 1 ? "<1 mo" : months.toFixed(1) + " mo"}
                </div>
              </div>
            </div>

            <p className="mt-4 text-[12.5px] leading-[1.55] text-faint">
              {breakEven <= 0
                ? "The senior time saved alone already covers the price, the ramp claim is upside, not load-bearing."
                : `This stops paying for itself below a ${breakEven.toFixed(1)}% ramp improvement.`}
            </p>
          </div>
        </div>

        <div className="border-t border-line bg-surface-2/40 px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted hover:text-ink"
          >
            <span aria-hidden className="inline-block w-3">
              {open ? "−" : "+"}
            </span>
            The arithmetic, in full
          </button>

          {open && (
            <>
              <pre className="mt-4 overflow-x-auto font-mono text-[11.5px] leading-[1.7] text-muted">
{`engineer cost/hour   ${eur(salary)} × ${MULT} ÷ ${HOURS}  =  ${eur(seniorHour)}
new hire cost/day    ${eur(salary * JUNIOR)} × ${MULT} ÷ ${DAYS}  =  ${eur(newDay)}

ramp    ${RAMP} days × ${IMPROVE * 100}%   = ${daysPer.toFixed(1)} days earlier × ${hires} hires
        × ${eur(newDay)}/day × ${SHORTFALL * 100}% shortfall   =  ${eur(hard)}

senior  ${QUESTIONS} questions × ${DEFLECT * 100}% × ${(RESUME * 60).toFixed(1)} min = ${softHours.toFixed(1)} h/hire
        × ${eur(seniorHour)} × ${hires} hires   =  ${eur(soft)}

total                                    ${eur(total)}
your plan                                ${eur(plan.cost)}/year`}
              </pre>
              <p className="mt-3 text-[12.5px] leading-[1.6] text-muted">
                <span className="text-ink">Where these come from.</span> 25.4
                minutes to resume interrupted work is the CHI 2005 figure, not the
                &ldquo;23 minutes&rdquo; that circulates without appearing in the
                paper it is attributed to. 39 days is time to a new engineer&rsquo;s
                tenth merged pull request. 1.46× is Swedish statutory employer
                cost. The 15% ramp improvement sits at the conservative end of the
                range observed for AI developer tools. Attrition and
                bad-hire costs are deliberately excluded: they are standard in this
                category&rsquo;s decks and neither has a source we would defend.
              </p>
            </>
          )}
        </div>
