/**
 * Where two ramps touch.
 *
 * Shipped on /manager because a manager onboarding a cohort has exactly one
 * question this product can answer that a task board cannot: are these two
 * people about to walk into each other. The answer is already written — it is a
 * sentence inside one of the plans, put there by the planner when it divided
 * the work — and this screen only carries it up to where the manager is.
 *
 * Three things this component deliberately does not do, and must never start
 * doing. There is no score. There is no ranking. There is no comparison of the
 * two people: not who is further along, not who has more tasks, not who has
 * more blockers, not an overlap percentage. A cohort view is the most natural
 * place in the whole product to smuggle a metric about a person in, which is
 * why the rule is written here as well as in the type it renders. The number in
 * the header is a count of sentences, the same way the roster's number is a
 * count of blockers: a queue, never a mark against anybody.
 *
 * Blockers-shaped on purpose — the same card, the same rule down the left, the
 * same register — but neutral rather than amber, because nobody is stuck. The
 * page's promise is "we only interrupt you when you are actually needed", and
 * this is not an interruption. It is what two plans already agreed on the page.
 */

import type { AdjoiningScope } from "@/lib/agent/cohort";
import { Label, Pill, initials } from "./ui";

export default function AdjoiningScopeList({ items }: { items: AdjoiningScope[] }) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3.5 border-t border-line pt-10">
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 rounded-full bg-line-strong" />
        <Label>Where two ramps touch</Label>
        <span className="tnum text-[11px] text-faint">{items.length}</span>
        <span className="ml-auto hidden text-[11.5px] text-faint sm:block">
          not a blocker, nothing is waiting on you here
        </span>
      </div>

      <p className="max-w-[70ch] text-[13.5px] leading-[1.6] text-muted">
        More than one person is ramping at this company, so the plans were
        written against each other: nobody was handed work somebody else already
        holds. Where the scope still runs alongside, the plan says so in the
        task itself. These are those sentences, unedited, both people have
        already read them.
      </p>

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="overflow-hidden rounded-xl border border-line bg-surface"
            style={{ boxShadow: "var(--shadow)" }}
          >
            <div className="flex">
              <div className="w-[3px] shrink-0 bg-line-strong" />
              <div className="min-w-0 flex-1 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                  <Avatar name={item.hireName} />
                  <span className="text-[13.5px] font-medium">{item.hireName}</span>
                  <span className="text-[12px] text-faint">alongside</span>
                  <Avatar name={item.otherHireName} />
                  <span className="text-[13.5px] font-medium">
                    {item.otherHireName}
                  </span>
                </div>

                {/* The product value, verbatim from the plan the hire reads. */}
                <p className="mt-3 max-w-[68ch] text-[15px] leading-[1.55] font-medium tracking-[-0.005em] text-ink">
                  {item.note}
                </p>

                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  <Pill>{item.taskTitle}</Pill>
                  <span className="font-mono text-[11px] text-faint">
                    {item.taskId}
                  </span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[10.5px] font-semibold text-muted">
      {initials(name)}
    </span>
  );
}
