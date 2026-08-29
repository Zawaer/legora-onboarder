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
import { renderCorpus } from "@/lib/agent/derive";
import { rankExperts } from "@/lib/agent/experts.impl";
import type { CohortPeer } from "@/lib/agent/cohort";
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
 * The extra rules that only apply when somebody else is already ramping here.
 *
 * Appended to SYSTEM rather than folded into it, so a company with exactly one
 * starter gets the prompt it got before any of this existed, byte for byte —
 * and so the difference between "planned alone" and "planned alongside" is one
 * readable block instead of a conditional threaded through prose.
 *
 * The cost, stated rather than hidden: the system prompt is part of the cached
 * prefix, so a cohort run and a solo run do not share a prompt-cache entry and
 * the corpus behind it is re-created once per variant. That is the right trade.
 * The alternative is putting the division rule in the volatile user turn, where
 * it lands after fifteen thousand tokens of corpus and reads like a footnote —
 * and this rule is the one that stops two people being handed the same ticket.
 */
const COHORT_RULES = `

OTHER PEOPLE ARE STARTING HERE AT THE SAME TIME

The <already_assigned> block in the user message lists the other people currently ramping at this company and the work each of them is already holding. Read it as a ledger of what is taken. Nobody has agreed anything with you and nobody is going to answer you: those plans are already written and they will not change because of what you write now. All of the dividing is yours to do.

1. NEVER ASSIGN WORK SOMEBODY IN THAT BLOCK ALREADY HOLDS. Not the same task reworded, not "the other half" of it unless the corpus itself already splits it that way. If the obvious first task for this role is taken, it is taken — go back to the corpus and find the next-best genuinely outstanding piece of work. There will be one: a corpus of this size always holds more unfinished work than two people can clear in four days. A second-best real task is worth more than a first-best duplicate, because a duplicate ends with two people discovering each other in the same file on Wednesday.

2. WHERE THE SCOPE ADJOINS, SAY SO — inside the task's own \`context\` field, naming the person. One plain sentence: what the other starter is holding, what this hire is on instead, and what to check before touching the thing they share. Like this:

   "Anna has the Nordkap schedule; you're on the Ardent variants — check with her before touching the shared playbook."

   Write that sentence wherever two tasks touch the same ticket, document, playbook, customer, dataset or person. Do not write it where the scope does not actually adjoin — an invented adjacency is worse than none. This sentence is the most valuable thing in the plan, because the one collision a new hire cannot see coming is another new hire.

3. NEVER INVENT A COLLEAGUE. Every name you write comes from the <people> roster or from <already_assigned>. Nobody else works here.

Do not rank, compare, or characterise the other starters: not their seniority, not their pace, not who got the more interesting work, not who is further along. You are dividing work between people, not grading them.`;

/**
 * Build the plan.
 *
 * Task ids and the `askIfStuck` name are assigned here rather than trusted from
 * the model: ids key the whole status-tracking system and must be unique and
 * stable, and a fabricated colleague is the same class of failure as a
 * fabricated quote — it sends a new hire to Slack-message someone who does not
 * work here.
 *
 * `peers` is what the other people mid-ramp at this company are already
 * holding. Optional, and empty is the same as absent: with no peers the system
 * prompt and the user prompt are byte-identical to what they were before
 * cohorts existed, so every caller that has never heard of this keeps getting
 * exactly the plan it got yesterday. See lib/agent/cohort.ts for what this
 * mechanism is and — more importantly — what it is not.
 */
export async function buildRampPlan(
  company: Company,
  role: DerivedRole,
  peers: CohortPeer[] = [],
): Promise<RampPlan> {
  const raw = await generate({
    system: peers.length > 0 ? SYSTEM + COHORT_RULES : SYSTEM,
    // The corpus rides along here too. The system prompt tells the model to
    // start the hire on work the team has visibly been putting off — which is
    // an empty instruction if it can only see the derived summary. It costs a
    // couple of seconds of prefill and it is what makes the `context` field
    // specific enough to work from without tapping anyone on the shoulder.
    corpus: renderCorpus(company),
    user: buildPlanPrompt(company, role, peers),
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

  const owner = bestByOwnership(people, topic);
  if (owner) return owner;

  // `owns` is empty on every ingested corpus — lib/ingest/parse.ts leaves it
  // that way on purpose — so on a customer's own Slack the line above can never
  // fire and this used to fall through to `people[0]`, the most prolific poster.
  // Derive it from behaviour instead: who answered, who got named, who decided.
  // Guarded on nobody having any `owns` at all, so the seeded roster's routing
  // is byte-identical to what it was before this existed.
  if (people.every((p) => p.owns.length === 0)) {
    const derived = rankExperts(company, topic, { limit: 1 })[0];
    if (derived) return derived.person;
  }

  return people[0]!;
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

/**
 * The ledger of what is already taken.
 *
 * Returns nothing at all when nobody else is ramping, which is what keeps the
 * solo prompt byte-identical: an empty array contributes no lines to the join.
 *
 * Placed after `</role>` and immediately before the ask, because it is the last
 * thing the model should be holding when it starts choosing tasks.
 */
function renderPeers(company: Company, peers: CohortPeer[]): string[] {
  if (peers.length === 0) return [];

  const lines = peers.flatMap((p) => [
    `- ${p.name} — ${p.roleTitle}. Already holding:`,
    ...(p.taskTitles.length > 0
      ? p.taskTitles.map((t) => `    · ${t}`)
      : [`    · (plan not written yet)`]),
  ]);

  return [
    `<already_assigned note="Other people mid-ramp at ${company.name} right now. This work is taken; it is not available to hand out again.">`,
    ...lines,
    `</already_assigned>`,
    ``,
  ];
}

function buildPlanPrompt(company: Company, role: DerivedRole, peers: CohortPeer[] = []): string {
  const roster = company.people
    .map((p) => `- ${p.name} (${p.slackHandle}) — ${p.role}, ${p.team}. Owns: ${p.owns.join("; ") || "unspecified"}`)
    .join("\n");

  const evidence = role.evidence
    .map((e) => `- [${e.artifactId}] "${e.quote}" — ${e.why}`)
    .join("\n");

  return [
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
    ...renderPeers(company, peers),
    `Write day 1 and day 2. Real work only. The person starts tomorrow and nobody has time to sit with them.`,
  ].join("\n");
}
