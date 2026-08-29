/**
 * The supervision loop. This is the part that makes the product an agent rather
 * than a chat window with a company corpus bolted onto it.
 *
 * Two behaviours define it:
 *
 * 1. It opens. A new hire on day one does not know what they do not know, which
 *    is precisely why "ask me anything" fails them — the question they need to
 *    ask is one they cannot formulate. So the agent moves first, assigns work,
 *    and carries the context with it.
 *
 * 2. It decides when a human is needed, and defends that decision. Anything the
 *    corpus can answer, it answers itself. It escalates only when the corpus
 *    genuinely cannot resolve the question — because the promise being sold is
 *    "your team gets interrupted only when a human is actually required", and a
 *    tool that escalates generously is a tool that has broken that promise
 *    while appearing to work.
 *
 * ON MEASUREMENT — read this before adding a field:
 *
 * There is deliberately no score here. No completion percentage, no ramp
 * velocity, no "engagement", no rating of the person. Blockers describe the
 * obstacle and never the human in front of it: "the corpus does not say which
 * tenant the staging seed points at", never "the hire struggled with setup".
 *
 * This is not squeamishness, it is product survival. The buyer is a manager at
 * a company that hires for ownership and says so out loud. The first time this
 * dashboard shows them a number that ranks a person they just hired, it stops
 * being an onboarding tool and becomes a surveillance tool, and it gets removed
 * by the same culture that bought it — usually after the new hire notices first
 * and tells everyone. A blocker list makes the manager useful. A leaderboard
 * makes them a monitor. Only one of those gets renewed.
 */

import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { generate } from "@/lib/anthropic";
import { resolveOwner } from "@/lib/agent/plan";
import { renderCorpus } from "@/lib/agent/derive";
import { detectDrift, driftBlocker, renderDriftNote } from "@/lib/agent/drift";
import type {
  Blocker,
  ChatMessage,
  Company,
  DriftNote,
  HireState,
  RampPlan,
  RampTask,
  TaskStatus,
} from "@/lib/types";

const ResponseSchema = z.object({
  reply: z
    .string()
    .describe(
      "What to say to the new hire. Direct, specific, no preamble. If you can answer from the " +
        "corpus, answer — do not summarise that an answer exists.",
    ),
  answeredFromCorpus: z
    .boolean()
    .describe("True if the company's own artifacts contained enough to resolve what they asked."),
  taskStatus: z
    .enum(["unchanged", "not_started", "in_progress", "done", "blocked"])
    .describe("The status of their current task after this message. 'unchanged' if it did not move."),
  blockerSummary: z
    .string()
    .describe(
      "The obstacle in one sentence, describing the situation and never the person. Empty string " +
        "if nothing is blocking them.",
    ),
  needsHuman: z
    .boolean()
    .describe("True ONLY if no amount of reading the corpus could resolve this. See the rules."),
  suggestedPerson: z
    .string()
    .describe("Exact roster name to escalate to, chosen by what they own. Empty string if needsHuman is false."),
  minutesToUnblock: z
    .number()
    .int()
    .describe("Honest minutes of that person's time this would cost. 0 if needsHuman is false."),
});

/**
 * Handed to the drift check verbatim as its system prompt too, which is why it
 * is passed rather than re-declared there: byte-identical means the two
 * concurrent calls share one cached prefix instead of writing two. If you edit
 * this string, edit it here and nowhere else.
 */
const SYSTEM = `You are supervising someone through their first two days in a role that has never existed at their company before. You have the company's entire internal corpus — Slack, docs, tickets, meeting notes — the role you derived from it, and their ramp plan.

YOUR DEFAULT IS TO ANSWER

You have the corpus. Most of what a new hire asks in their first two days is answerable from it, and answering it is the whole reason this exists. Read for the answer before deciding you do not have one. If a thread from six weeks ago settles the question, quote it and say who said it and when — that is more useful than any summary, because it also tells them where to look next time.

When you answer, answer. Give the actual answer first, not a description of where an answer might live. Do not open with "great question". Do not restate what they asked. They are mid-task and reading this in a side panel.

WHEN THE CORPUS IS SILENT, SAY SO PLAINLY

If the corpus does not settle it, say that in one sentence and move to what to do about it. Never fill a gap with something that sounds right; a confident wrong answer on day one costs them half a day and their trust in you, in that order. "Nobody has written this down" is a real answer and they will respect it.

ESCALATION IS THE PRODUCT — SPEND IT LIKE MONEY

The promise this tool is sold on is: your team gets interrupted only when a human is genuinely required. Every unnecessary escalation is a withdrawal against that. A tool that escalates whenever it is unsure is not a supervisor, it is a routing table, and the customer already has one of those — it's called Slack.

Set needsHuman true ONLY when the answer does not exist anywhere in the corpus AND cannot be worked out, tried, or safely defaulted:
  - a credential, permission, or access grant only a person can issue
  - a decision the company has genuinely not made, where guessing wrong is expensive
  - something requiring judgement from someone with context that was never written down
  - an action with real consequences (touching production, contacting a customer) that needs a sign-off

Set needsHuman FALSE when the hire is merely uncertain, when the answer is in the corpus, when trying it and seeing what happens is cheap and reversible, or when a sensible default exists and you can name it. Being stuck is not the same as needing a human. Say what to try.

When you do escalate: name one person, chosen from what they actually own, and give an honest minutesToUnblock. Honest means honest — if it is a two-minute permission grant, say 2. Inflating it to sound important is how a manager learns to ignore the queue.

HOW YOU TALK ABOUT THE PERSON

You never assess them. No scores, no ratings, no percentages, no progress judgements, no "you're doing great", no "this is taking longer than expected". Blockers describe the obstacle, never the human: "staging credentials have not been issued", never "the hire cannot get set up". Their manager reads these. What the manager needs is a list of things in the way that they can clear — not an opinion about a person they hired three days ago.`;

export type SuperviseResult = {
  reply: string;
  blocker?: Blocker;
  taskStatus?: TaskStatus;
  /**
   * A divergence the agent volunteered — see `lib/agent/drift.ts`. Optional and
   * usually absent: the drift check is tuned to say nothing, and when it says
   * nothing this whole path is byte-for-byte what it was before.
   */
  drift?: DriftNote;
  /**
   * Set only when a drift note is consequential AND the hire cannot settle it
   * alone. A plain `Blocker`, so the manager screen and the Slack formatter
   * render it with no knowledge that drift detection exists.
   *
   * Kept separate from `blocker` rather than overwriting it: a turn can produce
   * both an escalation and a divergence, and collapsing them would silently
   * drop whichever arrived second.
   */
  driftBlocker?: Blocker;
};

/**
 * The agent's first move, before the hire has typed anything.
 *
 * Deliberately not a model call. Every word of it is already grounded — it is
 * the plan, read back — so generating it would add latency and a fresh chance
 * to hallucinate in exchange for nothing. It also means the very first thing a
 * judge sees cannot fail on a cold API.
 */
export function openingMessage(hire: HireState, plan: RampPlan): ChatMessage {
  const first = plan.days[0]?.tasks[0];
  const firstName = hire.name.trim().split(/\s+/)[0] || hire.name;

  const text = first
    ? [
        `${firstName} — you're the ${plan.role}. I read everything your team has written and worked out what this role actually is here, so you don't have to reverse-engineer it from standups.`,
        ``,
        `Day 1 is "${plan.days[0]?.theme ?? "first output"}". Start here:`,
        ``,
        `**${first.title}** (~${first.estimateMins} min)`,
        first.why,
        ``,
        `What you need to know: ${first.context}`,
        ``,
        `Done when: ${first.doneWhen}`,
        ``,
        `Ask me first — I have your team's Slack, docs and tickets and I can almost certainly answer it. If it turns out to be something only a person can settle, I'll tell you to go to ${first.askIfStuck} rather than have you guess.`,
      ].join("\n")
    : [
        `${firstName} — you're the ${plan.role}. I've derived the role from your team's own corpus, but I haven't got a first task for you yet.`,
        `Tell me what you're looking at and I'll work from there.`,
      ].join("\n");

  return {
    id: randomUUID(),
    role: "agent",
    text,
    at: new Date().toISOString(),
    taskId: first?.id,
  };
}

/**
 * One turn of supervision.
 *
 * The full corpus goes in on every turn rather than being retrieved against.
 * It is a few thousand tokens, it is stable, and it is the difference between
 * the agent knowing the company and the agent knowing three chunks that scored
 * well against the hire's phrasing — which, on day one, is exactly the phrasing
 * least likely to match how the company talks about itself.
 */
export async function respond(
  hire: HireState,
  company: Company,
  userText: string,
): Promise<SuperviseResult> {
  const task = currentTask(hire);

  // Two calls, issued together rather than one after the other.
  //
  // The reply is the product and it already takes 20-37 seconds; a serial drift
  // check would add its whole duration to that, and a demo that got twice as
  // slow to gain a feature has lost more than it gained. Concurrently, the cost
  // is max(reply, drift) — and the drift call is much the shorter of the two,
  // because it emits a couple of hundred output tokens against the reply's few
  // thousand and shares the same cached corpus prefix. The measured difference
  // is inside the turn-to-turn noise.
  //
  // `detectDrift` is documented never to throw, and the extra `.catch` here is
  // the belt to that braces: if this rejected it would take the reply down with
  // it through `Promise.all`, which is the one thing the addition must not do.
  const [raw, drift] = await Promise.all([
    generate({
      system: SYSTEM,
      corpus: renderCorpus(company),
      user: buildTurnPrompt(hire, task, userText),
      schema: ResponseSchema,
      label: `supervision turn for ${hire.name}`,
      history: recentHistory(hire),
      maxTokens: 16000,
    }),
    detectDrift(hire, company, task, userText, SYSTEM).catch(() => null),
  ]);

  const result: SuperviseResult = { reply: raw.reply };

  // Appended in code rather than folded into the model's reply, so the quote the
  // hire reads is the exact string that passed verification. It also keeps the
  // divergence visually separable from the answer — it is a different kind of
  // thing and should not be smuggled into a paragraph as if the agent had been
  // asked about it.
  if (drift) {
    result.drift = drift;
    result.reply = `${raw.reply}\n\n${renderDriftNote(drift, company)}`;
    if (drift.needsHuman) result.driftBlocker = driftBlocker(drift);
  }

  if (raw.taskStatus !== "unchanged" && task) {
    result.taskStatus = raw.taskStatus;
  }

  const summary = raw.blockerSummary.trim();
  if (summary.length > 0) {
    // needsHuman is the model's call, but who to ping is not: a suggested name
    // that isn't on the roster sends the hire to message someone who does not
    // work here, which is the same failure as a fabricated quote wearing a
    // different hat.
    const person = raw.needsHuman
      ? resolveOwner(company, raw.suggestedPerson, `${summary} ${task?.title ?? ""}`)
      : undefined;

    result.blocker = {
      id: randomUUID(),
      hireId: hire.id,
      taskId: task?.id,
      summary,
      raisedAt: new Date().toISOString(),
      needsHuman: raw.needsHuman,
      suggestedPerson: person?.name,
      // Clamped rather than trusted. A blocker claiming three hours of a
      // colleague's time will not get actioned; one claiming zero reads as
      // noise. Both make the queue less useful than it should be.
      minutesToUnblock: raw.needsHuman ? clampMinutes(raw.minutesToUnblock) : undefined,
      resolved: false,
    };
  }

  return result;
}

/**
 * Is this obstacle already sitting open on the hire's list?
 *
 * The prompt shows the model every open blocker, and the model — correctly —
 * keeps reporting one that is still in the way. Asked an unrelated question
 * while the hire is waiting on an access grant, it restates the access grant.
 * Appending that verbatim turns one escalation into a new row every turn, so
 * the manager screen fills with copies of a single obstacle, each with its own
 * minute estimate and sometimes a different needsHuman verdict — and the "how
 * many minutes of your time" total silently multiplies.
 *
 * One open obstacle is one row. Re-raising is not new information.
 */
export function isDuplicateBlocker(existing: Blocker[], candidate: Blocker): boolean {
  const key = blockerKey(candidate.summary);
  return existing.some((b) => !b.resolved && blockerKey(b.summary) === key);
}

function blockerKey(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The task the hire is on: the first one not yet finished, in plan order. */
export function currentTask(hire: HireState): RampTask | undefined {
  for (const day of hire.plan?.days ?? []) {
    for (const task of day.tasks) {
      if ((hire.taskStatus[task.id] ?? "not_started") !== "done") return task;
    }
  }
  return undefined;
}

function clampMinutes(mins: number): number {
  if (!Number.isFinite(mins) || mins <= 0) return 5;
  return Math.min(120, Math.max(1, Math.round(mins)));
}

/**
 * The last few turns only. The corpus is the expensive, stable part of the
 * prompt and it is already in the user turn; replaying forty messages of chat
 * on top of it buys context the agent mostly does not need and pushes the
 * cacheable prefix around.
 */
function recentHistory(hire: HireState): Anthropic.MessageParam[] {
  return hire.messages.slice(-8).map((m) => ({
    role: m.role === "agent" ? ("assistant" as const) : ("user" as const),
    content: m.text,
  }));
}

/**
 * The volatile tail: who this is, what they are on, what they just said. The
 * company description, roster and corpus are NOT repeated here — they are in
 * the cached prefix, and restating them would double the corpus in the request
 * while making the cheap half of the prompt expensive.
 */
function buildTurnPrompt(
  hire: HireState,
  task: RampTask | undefined,
  userText: string,
): string {
  const role = hire.derivedRole;

  const openBlockers = hire.blockers
    .filter((b) => !b.resolved)
    .map((b) => `- ${b.summary}${b.needsHuman ? ` (waiting on ${b.suggestedPerson ?? "someone"})` : ""}`)
    .join("\n");

  return [
    role
      ? [
          `<derived_role title="${role.title}">`,
          role.summary,
          `Responsibilities: ${role.responsibilities.join("; ")}`,
          `Still unresolved at the company: ${role.openQuestions.join("; ") || "none recorded"}`,
          `</derived_role>`,
        ].join("\n")
      : `<derived_role>not yet derived</derived_role>`,
    ``,
    `<hire name="${hire.name}" role="${hire.roleTitle}" started="${hire.startedAt}" />`,
    ``,
    task
      ? [
          `<current_task id="${task.id}" status="${hire.taskStatus[task.id] ?? "not_started"}">`,
          `Title: ${task.title}`,
          `Why: ${task.why}`,
          `Context they were given: ${task.context}`,
          `Done when: ${task.doneWhen}`,
          `Owner of this area: ${task.askIfStuck}`,
          `</current_task>`,
        ].join("\n")
      : `<current_task>none — every task in the plan is done</current_task>`,
    ``,
    openBlockers ? `<open_blockers>\n${openBlockers}\n</open_blockers>` : `<open_blockers>none</open_blockers>`,
    ``,
    `<message_from_hire>`,
    userText,
    `</message_from_hire>`,
  ].join("\n");
}
