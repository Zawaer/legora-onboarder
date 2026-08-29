/**
 * The two-day ramp plan.
 *
 * Constraint that shapes everything below: the customer told us their new hires
 * have ownership from day one, and that nobody has spare time to hand-hold. So
 * a plan made of reading and shadowing is worse than no plan — it burns the
 * only two days where a new hire's attention is completely free, and it teaches
 * them that the way to get things done here is to wait.
 *
 * Every task is therefore a real, small, shippable piece of work, carrying
 * enough context in the task itself that it can be done without interrupting
 * anyone. The `askIfStuck` name is a fire escape, not a first step.
 */

import { z } from "zod/v4";
import { generate } from "@/lib/anthropic";
import type { Company, DerivedRole, Person, RampDay, RampPlan, RampTask } from "@/lib/types";

const TaskSchema = z.object({
  title: z.string().describe("An imperative, specific piece of work. Under twelve words."),
  why: z
    .string()
    .describe("Why this matters to this company right now, referencing something real from the role."),
  context: z
    .string()
    .describe(
      "Everything they need to start: where the thing lives, what has already been decided, " +
        "what the constraints are, what the team's prior attempt looked like. Several sentences. " +
        "Written so it can be done without asking anyone.",
    ),
  doneWhen: z
    .string()
    .describe("A single observable condition. Someone else could check it without asking them."),
  askIfStuck: z.string().describe("Exact name from the roster: whoever owns this area."),
  estimateMins: z.number().int().describe("Realistic minutes for someone on their first day. 30-180."),
});

const DaySchema = z.object({
  day: z.number().int().describe("1 or 2."),
  theme: z.string().describe("What this day is for, in a short phrase."),
  tasks: z.array(TaskSchema).describe("Between two and four tasks."),
});

const PlanSchema = z.object({
  days: z.array(DaySchema).describe("Exactly two entries: day 1 and day 2."),
});

const SYSTEM = `You write the first two days of work for someone starting a role that has never existed at their company before.

THE TASKS ARE REAL WORK

Not orientation. Not a reading list. Not "set up your laptop", not "read the handbook", not "have a coffee chat with three people", not "watch the recorded demo". Those fill time; they do not produce anything, and they teach a new hire that this is a company where you wait to be told.

Each task must produce an artifact that did not exist before they started it: a document, a draft, a fix, a written recommendation, a reproduced bug, a filled-in comparison, a first pass at something the team has been putting off. Something they could point at on Wednesday and say "I made that." Small enough to finish in one sitting, real enough that it would be missed if they did not do it.

Prefer work the corpus shows is genuinely outstanding — a question raised in a thread and never answered, a decision nobody had time to write up, a customer pattern nobody has collated. Starting on real backlog is what makes day one feel like joining rather than queuing.

CONTEXT IS THE ENTIRE POINT

The reason this works without a mentor is the context field. It has to contain what a colleague would have told them over the shoulder: where the thing is, what has already been tried, which decisions are already made and should not be relitigated, what the sharp edges are, what "good" looks like here. If your context field would leave a competent stranger with an obvious question they would have to interrupt someone to answer, it is not finished. Write it in specifics — names, systems, customers, prior attempts — not in categories.

doneWhen is one observable condition, checkable by someone else without asking the hire how it went. "Understands the pipeline" is not checkable. "A one-page doc in the team channel listing each stage and who owns it" is.

DAY SHAPE

Day 1 is orientation through production: tasks whose byproduct is understanding, where the understanding is a side effect of making something. Day 2 goes wider — touches another person's work, or hands something to the team, or commits to a recommendation.

askIfStuck names one real person from the roster: the one whose stated ownership actually covers this task. Not the manager by default. Not the same person every time if the tasks span different areas.`;

/**
 * Build the plan.
 *
 * Task ids and the `askIfStuck` name are assigned here rather than trusted from
 * the model: ids key the whole status-tracking system and must be unique and
 * stable, and a fabricated colleague is the same class of failure as a
 * fabricated quote — it sends a new hire to Slack-message someone who does not
 * work here.
 */
export async function buildRampPlan(company: Company, role: DerivedRole): Promise<RampPlan> {
  const raw = await generate({
    system: SYSTEM,
    user: buildPlanPrompt(company, role),
    schema: PlanSchema,
    label: `ramp plan for "${role.title}" at ${company.name}`,
  });

  const days: RampDay[] = [1, 2].map((n) => {
    const match = raw.days.find((d) => d.day === n) ?? raw.days[n - 1];
    const tasks = (match?.tasks ?? []).slice(0, 4).map(
      (t, i): RampTask => ({
        id: `d${n}-t${i + 1}`,
        title: t.title,
        why: t.why,
        context: t.context,
        doneWhen: t.doneWhen,
        askIfStuck: resolveOwner(company, t.askIfStuck, t.title + " " + t.why).name,
        estimateMins: clampEstimate(t.estimateMins),
      }),
    );
    return { day: n as 1 | 2, theme: match?.theme ?? (n === 1 ? "First output" : "First ownership"), tasks };
  });

  return { role: role.title, days };
}

/**
 * Map whatever the model wrote into a real colleague.
 *
 * Exact name first. Failing that, the person whose `owns` entries overlap the
 * task text most — which is the same signal a human would use when they say
 * "ask whoever looks after that". Falling back to nobody is not an option: a
 * task with no escape hatch is a task that ends in a silent stuck new hire,
 * and that is the exact failure this product exists to prevent.
 */
export function resolveOwner(company: Company, suggested: string, topic: string): Person {
  const people = company.people;
  if (people.length === 0) {
    throw new Error("Company has no people; cannot assign an escalation target.");
  }

  const wanted = suggested.trim().toLowerCase();
  const exact = people.find(
    (p) => p.name.toLowerCase() === wanted || p.slackHandle.toLowerCase() === wanted,
  );
  if (exact) return exact;

  const partial = people.find(
    (p) => wanted.length > 2 && (p.name.toLowerCase().includes(wanted) || wanted.includes(p.name.toLowerCase())),
  );
  if (partial) return partial;

  return bestByOwnership(people, topic) ?? people[0]!;
}

/** Crude keyword overlap against `owns`. Crude is fine; being wrong silently is not. */
function bestByOwnership(people: Person[], topic: string): Person | undefined {
  const words = new Set(
    topic
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3),
  );
  if (words.size === 0) return undefined;

  let best: { person: Person; score: number } | undefined;
  for (const person of people) {
    const owned = person.owns.join(" ").toLowerCase().split(/[^a-z0-9]+/);
    const score = owned.filter((w) => w.length > 3 && words.has(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { person, score };
  }
  return best?.person;
}

function clampEstimate(mins: number): number {
  if (!Number.isFinite(mins)) return 60;
  return Math.min(240, Math.max(15, Math.round(mins)));
}

function buildPlanPrompt(company: Company, role: DerivedRole): string {
  const roster = company.people
    .map((p) => `- ${p.name} (${p.slackHandle}) — ${p.role}, ${p.team}. Owns: ${p.owns.join("; ") || "unspecified"}`)
    .join("\n");

  const evidence = role.evidence
    .map((e) => `- [${e.artifactId}] "${e.quote}" — ${e.why}`)
    .join("\n");

  return [
    `<company name="${company.name}">`,
    company.description,
    `</company>`,
    ``,
    `<people>`,
    roster,
    `</people>`,
    ``,
    `<role title="${role.title}">`,
    role.summary,
    ``,
    `Responsibilities:`,
    ...role.responsibilities.map((r) => `- ${r}`),
    ``,
    `What ramped looks like:`,
    ...role.firstWeekOutcomes.map((o) => `- ${o}`),
    ``,
    `Verified evidence from the company's own corpus:`,
    evidence || "- (none survived verification)",
    ``,
    `Still unresolved inside the company:`,
    ...role.openQuestions.map((q) => `- ${q}`),
    `</role>`,
    ``,
    `Write day 1 and day 2. Real work only. The person starts tomorrow and nobody has time to sit with them.`,
  ].join("\n");
}
