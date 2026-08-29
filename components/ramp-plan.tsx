import type { RampPlan, RampTask, TaskStatus } from "@/lib/types";
import { Label, Pill } from "./ui";

const STATUS: Record<
  TaskStatus,
  { text: string; tone: "neutral" | "accent" | "warn" | "ok" }
> = {
  not_started: { text: "To do", tone: "neutral" },
  in_progress: { text: "In progress", tone: "accent" },
  done: { text: "Done", tone: "ok" },
  blocked: { text: "Blocked", tone: "warn" },
};

function Chev() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="chev h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-150"
      aria-hidden
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * `clamp` bounds Context, which is the longest field on the card and the one
 * that was being cut mid-word by the panel's own scroll — "…because if" with
 * nothing after it reads as broken rather than as continued. Clamping to whole
 * lines with a fade says "there is more" instead; the card expands to show it.
 */
function Field({
  label,
  clamp = false,
  children,
}: {
  label: string;
  clamp?: boolean;
  children: string;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <span className="label w-full shrink-0 pt-[3px] sm:w-24">{label}</span>
      <p
        className={`min-w-0 flex-1 text-[13.5px] leading-[1.6] text-muted${
          clamp ? " line-clamp-6" : ""
        }`}
      >
        {children}
      </p>
    </div>
  );
}

function Task({
  task,
  index,
  status,
  defaultOpen,
}: {
  task: RampTask;
  index: number;
  status: TaskStatus;
  defaultOpen: boolean;
}) {
  const s = STATUS[status] ?? STATUS.not_started;
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-lg border border-line bg-surface transition-colors open:border-line-strong"
    >
      <summary className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-2/60">
        <span className="tnum mt-[1px] w-6 shrink-0 font-mono text-[13px] text-faint">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] leading-[1.45] font-medium tracking-[-0.005em]">
            {task.title}
          </span>
          {/* Seven identical "To do" pills down a column say nothing seven
              times over, and they were the loudest thing in the panel. The
              default state keeps its word but loses the border and the fill,
              so a task that is genuinely in progress or blocked is the only
              one wearing a pill. */}
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            {status === "not_started" ? (
              <span className="tnum text-[11.5px] text-faint">
                {s.text}
                {typeof task.estimateMins === "number" &&
                  ` · ~${task.estimateMins} min`}
              </span>
            ) : (
              <>
                <Pill tone={s.tone}>{s.text}</Pill>
                {typeof task.estimateMins === "number" && (
                  <span className="tnum text-[11.5px] text-faint">
                    ~{task.estimateMins} min
                  </span>
                )}
              </>
            )}
          </span>
        </span>
        <span className="mt-1.5">
          <Chev />
        </span>
      </summary>

      <div className="flex flex-col gap-3.5 border-t border-line bg-surface-2/40 px-4 py-4">
        {task.why && <Field label="Why">{task.why}</Field>}
        {task.context && (
          <Field label="Context" clamp>
            {task.context}
          </Field>
        )}
        {task.doneWhen && (
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
            <span className="label w-full shrink-0 pt-[3px] sm:w-24">
              Done when
            </span>
            <p className="min-w-0 flex-1 border-l-2 border-ok/50 pl-3 text-[13.5px] leading-[1.6] text-ink">
              {task.doneWhen}
            </p>
          </div>
        )}
        {task.askIfStuck && (
          <div className="flex items-center gap-2.5 border-t border-line pt-3.5">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-3.5 w-3.5 shrink-0 text-faint"
              aria-hidden
            >
              <circle cx="8" cy="5.75" r="2.6" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M3.4 13.2c.6-2.2 2.4-3.3 4.6-3.3s4 1.1 4.6 3.3"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[12.5px] text-muted">
              Still stuck after the agent?{" "}
              <span className="font-medium text-ink">{task.askIfStuck}</span>
            </span>
          </div>
        )}
      </div>
    </details>
  );
}

export default function RampPlanView({
  plan,
  taskStatus = {},
  className = "",
}: {
  plan?: RampPlan;
  taskStatus?: Record<string, TaskStatus>;
  className?: string;
}) {
  if (!plan || !plan.days?.length) {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        <Label>Ramp plan</Label>
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-4">
            <div className="skeleton h-3.5 w-[70%] rounded-full" />
            <div className="skeleton mt-2.5 h-2.5 w-24 rounded-full" />
          </div>
        ))}
        <p className="text-[12.5px] text-faint">
          The plan is written after the role is derived, real tasks, not a
          reading list.
        </p>
      </div>
    );
  }

  const total = plan.days.reduce((n, d) => n + (d.tasks?.length ?? 0), 0);
  const mins = plan.days.reduce(
    (n, d) => n + (d.tasks ?? []).reduce((m, t) => m + (t.estimateMins ?? 0), 0),
    0,
  );

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label>First two days</Label>
        <span className="tnum text-[11.5px] text-faint">
          {total} tasks · ~{Math.round(mins / 60)}h of real work
        </span>
      </div>

      {plan.days.map((day, di) => (
        <section key={day.day} className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <span className="tnum shrink-0 rounded-md bg-ink px-2 py-1 text-[11px] font-semibold tracking-[0.02em] text-paper">
              DAY {day.day}
            </span>
            <span className="min-w-0 text-[14px] leading-snug font-medium tracking-[-0.005em] text-balance">
              {day.theme}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {(day.tasks ?? []).map((t, ti) => (
              <Task
                key={t.id ?? `${day.day}-${ti}`}
                task={t}
                index={ti}
                status={taskStatus[t.id] ?? "not_started"}
                // Nothing opens by itself. Expanded, the first task alone
                // puts two paragraphs of prose at the top of the column and
                // pushes the chat — the part you actually work in — off the
                // bottom of the screen.
                defaultOpen={false}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
