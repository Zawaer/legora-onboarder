/**
 * Drift detection: catching the confident wrong turn, before anyone reviews it.
 *
 * WHY THIS EXISTS
 *
 * Everything else in this agent is reactive. The hire asks, the agent answers;
 * the hire gets stuck, the agent escalates. That covers the questions a new
 * person knows to ask, and it is genuinely most of the value.
 *
 * It does not cover the expensive failure. The expensive failure at a company
 * hiring at this pace is not the question someone asks — it is the thing
 * they do confidently, correctly-seeming, and wrong, for two weeks, because
 * nobody happened to look. A manager with six reports catches that by reviewing
 * the work. A manager with fifty does not catch it at all, and the correction
 * arrives from a customer instead. This is the file that makes "the agent is
 * the manager's proxy" a mechanism rather than a slogan.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HIGH PRECISION, LOW RECALL — DELIBERATELY, AND NOT NEGOTIABLE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This check is tuned to miss things. That is the correct setting, and it is
 * worth writing down why, because the tempting change to make on any given
 * afternoon is to loosen it.
 *
 * The two failure modes are not symmetric:
 *
 *   • A miss costs what the product costs today — nothing. The hire proceeds
 *     exactly as they would have without this feature, and the reactive path
 *     still catches them the moment they ask about it.
 *
 *   • A false positive costs the product. A tool that second-guesses a new hire
 *     on thin evidence — "have you considered", "the team usually" — is a tool
 *     that reads as an anxious manager looking over a shoulder. The buyer here
 *     hires for ownership and says so out loud. The first time this interrupts
 *     someone to tell them something that is not true, they stop reading it;
 *     the second time, they tell their cohort; and the feature is dead inside a
 *     week whether or not anyone files a bug. It also lands on a person three
 *     days into a job, which is precisely when unfounded doubt is cheapest to
 *     create and most expensive to carry.
 *
 * So: one wrong flag is worse than ten missed ones, and the gates below are
 * ordered so that anything uncertain falls through to silence. Six of them have
 * to pass before a single word reaches the hire:
 *
 *   1. length      — too short to have described an approach at all (in code)
 *   2. approach    — did they state what they are DOING, not ask a question
 *   3. strength    — the corpus CONTRADICTS it, not "differs" or "is silent"
 *   4. grounding   — every quote verified verbatim against the real artifact
 *   5. assessment  — no scoring/rating language, checked in code, fail closed
 *   6. repeat      — we have not already said this to this person
 *
 * Gate 4 is the one that cannot be argued with, and it is why this is safe to
 * run unattended: the model can be as confident as it likes about a divergence,
 * but if it cannot produce a real sentence that a real person really wrote, the
 * note does not exist. Ungrounded doubt is strictly worse than silence.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * It is not an assessment, and there is no field here that could become one. No
 * score, no severity, no "accuracy", no count of how often someone diverged, no
 * history the manager could read as a track record. The product bans ranking a
 * person in three places already (`lib/types.ts`, `lib/agent/supervise.ts`,
 * `lib/slack/format.ts`) and this feature is by far the most natural loophole —
 * "we're only measuring how often the corpus disagreed with them" is a
 * performance review with extra steps. `findAssessmentLanguage`, reused from
 * the Slack formatter rather than re-implemented, is the runtime guard.
 *
 * The output is phrased as what the corpus says, with the receipt attached, and
 * it is addressed to the hire so they can course-correct themselves. That is
 * what ownership means here: the person doing the work gets the information
 * first, and their manager is only interrupted when they genuinely cannot act
 * on it alone.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { generate } from "@/lib/anthropic";
import { renderCorpus } from "@/lib/agent/derive";
import { groundEvidence } from "@/lib/agent/ground";
import { expandToSentence } from "@/lib/agent/sentence";
import { resolveOwner } from "@/lib/agent/plan";
// Reused, not reimplemented. The ban on assessment language is written once and
// this is the third surface that honours it; a second copy of the pattern list
// is a second copy that drifts out of date.
import { findAssessmentLanguage } from "@/lib/slack/format";
import type {
  Artifact,
  Blocker,
  Company,
  DriftNote,
  Evidence,
  HireState,
  RampTask,
} from "@/lib/types";

/**
 * Gate 1, in code rather than in tokens.
 *
 * "ok", "thanks", "who owns this?", "done" cannot contain a described approach,
 * so they cannot contain a divergence from one. Cheaper to not ask.
 */
const MIN_CHARS_TO_DESCRIBE_AN_APPROACH = 24;

/** At most two quotes reach the hire. A wall of citations reads as a telling-off. */
const MAX_QUOTES_SHOWN = 2;

const EvidenceSchema = z.object({
  artifactId: z
    .string()
    .describe("The exact id of the artifact this quote comes from, copied character for character."),
  quote: z
    .string()
    .describe(
      "A verbatim, contiguous substring of that artifact's text — the sentence that actually does " +
        "the contradicting. Copy it; do not paraphrase, tidy or re-punctuate it. Use '...' only to " +
        "elide the middle of a long passage.",
    ),
  why: z.string().describe("One sentence: what this passage settles."),
});

const DriftSchema = z.object({
  describesAnApproach: z
    .boolean()
    .describe(
      "True only if the hire STATED how they are doing the work or intend to do it. A question " +
        "they asked is not an approach — the main reply handles questions. Confusion, a status " +
        "update, or a request for help is not an approach.",
    ),
  strength: z
    .enum(["contradicted", "differs", "silent"])
    .describe(
      "'contradicted' = the corpus rules this approach out: someone with standing said not to do " +
        "it, the company tried it and moved off it, or a written convention forbids it. 'differs' " +
        "= the corpus does it another way but has not ruled this one out. 'silent' = the corpus " +
        "does not settle it. Only 'contradicted' is ever surfaced; when unsure, you are not in " +
        "'contradicted'.",
    ),
  observation: z
    .string()
    .describe(
      "What the corpus shows, naming who said it and when. ONE sentence, two at most — the quote " +
        "does the work, this only frames it. Describes the company, never the person reading it: " +
        "'the team moved off that in June', never 'you're doing this wrong', and never anything " +
        "resembling a score or rating. Empty string if strength is not 'contradicted'.",
    ),
  whyItMatters: z
    .string()
    .describe(
      "ONE sentence, two at most: what the corpus shows being done instead, and where to read it. " +
        "Concrete and actionable, not a lecture. Empty string if nothing is raised.",
    ),
  evidence: z
    .array(EvidenceSchema)
    .describe(
      "One or two citations, and they must be the passage that does the contradicting — not " +
        "background colour. Empty array if nothing is raised.",
    ),
  hireCanResolveAlone: z
    .boolean()
    .describe(
      "True if reading the cited artifact is enough for them to correct course themselves. This " +
        "is the normal case.",
    ),
  consequential: z
    .boolean()
    .describe(
      "True only if continuing would reach a customer, production, or a decision that is expensive " +
        "to reverse. Wasted effort on reversible work is not consequential.",
    ),
  suggestedPerson: z
    .string()
    .describe(
      "Exact roster name, only when hireCanResolveAlone is false AND consequential is true. Empty " +
        "string otherwise.",
    ),
});

/**
 * The check, as instructions.
 *
 * Note where this lives: in the USER turn, not the system prompt. That is a
 * caching decision and it is load-bearing — see `detectDrift` below.
 */
const INSTRUCTIONS = `<task_override>
This turn is NOT a supervision reply. Do not answer the hire, do not write to them, do not assign work. You are performing one narrow check and returning structured output. Everything above about how to reply to a new hire still governs your VALUES here — never assess the person, never invent a citation — but not your output.
</task_override>

THE CHECK

The hire has just said something. Two questions, in order:

1. Did they state a concrete approach — how they are doing the work, or how they plan to do it? Not a question they asked. Not confusion. Not a status update. A stated intent.
2. If so: does the corpus you were given genuinely CONTRADICT it?

If the answer to either is no, set strength and return empty fields. That is the expected outcome of most turns and it is not a failure.

WHAT CONTRADICTION MEANS HERE

Contradiction is the corpus ruling the approach out. It looks like:
  - someone with standing over that area said explicitly not to do it that way
  - the company tried this exact thing, it failed, and they wrote down why
  - a written convention, checklist or decision forbids it
  - a boundary someone owns has been drawn around it in writing

Contradiction is NOT:
  - the corpus being silent. Silence is not disagreement.
  - the corpus doing it differently without anyone ruling this way out. Two workable approaches is not drift.
  - a decision the company has openly NOT made. If two people are visibly arguing about it and nobody broke the tie, the hire is not diverging from a practice — there is no practice. That is a genuinely open question and picking a side is theirs to do.
  - your own opinion about what would be better. You are reporting what this company wrote down, not advising.
  - a stylistic or nice-to-have preference.
  - something the hire has already been told in this conversation.

YOU ARE HEAVILY BIASED TOWARD SAYING NOTHING

Raising nothing costs nothing: they carry on exactly as they would have, and they can still ask. Raising something thin costs the whole feature — a tool that second-guesses a new hire on weak evidence gets ignored within a day, and it plants doubt in someone three days into a job who has no way to weigh it. Ten missed divergences are cheaper than one wrong flag. If you are reaching, you are wrong. Return 'silent'.

THE QUOTE IS THE CLAIM

Every citation must be a verbatim contiguous substring of the artifact you attribute it to, and it must be the sentence that actually does the contradicting. A quote that merely mentions the topic is not evidence that the approach is ruled out.

A downstream check verifies every quote against the real artifact text and drops the entire note if none survive. You cannot get an invented quote past it — you can only lose the observation it was supporting. If you cannot find a real sentence that rules the approach out, then it is not ruled out, and you should be returning 'silent'.

HOW IT IS PHRASED

This goes to the new hire, not to their manager, and it is information, not a verdict. Write what the corpus shows and who wrote it: "Marta closed the Milan escalation without a keyword list and wrote up why." Never "that is wrong", never "you should not", never a score, rating, percentage or any judgement of the person. They are an adult who was hired for their judgement; hand them the evidence and let them use it.

WHO SEES IT

Default: the hire alone, and hireCanResolveAlone is true. Reading the cited artifact is normally the whole fix, and them fixing it themselves is the point.

Set hireCanResolveAlone false ONLY when reading the evidence genuinely is not enough — it needs a permission, a decision only a named person can make, or context nobody wrote down. Set consequential true ONLY when carrying on would reach a customer, reach production, or commit something expensive to reverse. Both must be true before a human is interrupted, and that combination should be rare.`;

/**
 * Look for a divergence. Returns null far more often than not.
 *
 * ON COST AND LATENCY — why this is a second call and not a wider schema:
 *
 * A supervision turn is already 20-37 seconds because the whole corpus goes in.
 * Two options were available and neither is free:
 *
 *   (a) Fold the fields into `ResponseSchema` in supervise.ts. Zero extra calls.
 *       But it rewrites the schema of the one path that is verified and demoed,
 *       and it asks a single generation to both answer warmly and adjudicate
 *       coldly — the second job leaks into the first, and the reply starts
 *       hedging. The brief's first instruction is not to break what works.
 *
 *   (b) A second call, issued CONCURRENTLY with the main one. Wall-clock cost
 *       is max(main, drift) rather than main + drift, and drift is the shorter
 *       of the two by a wide margin: it emits a few hundred output tokens
 *       against the main reply's few thousand, and output tokens are where the
 *       seconds are. Measured impact on a chat turn is inside the noise.
 *
 * (b), with one detail that makes it cheap as well as fast: this call reuses the
 * supervision system prompt and the byte-identical corpus block, so it shares
 * the cached prefix with the main call instead of paying to write a second one.
 * All ~15k tokens of corpus come back as a cache read. The drift-specific
 * instructions sit in the volatile user turn, after both cache breakpoints,
 * where they cost a few hundred tokens and invalidate nothing.
 *
 * That is also why INSTRUCTIONS opens by overriding the system prompt rather
 * than replacing it: keeping the prefix byte-identical is worth more than a
 * bespoke system message, and the values in the supervision prompt — answer
 * from the corpus, never assess the person, spend escalation like money — are
 * exactly the ones this check needs anyway.
 *
 * NEVER THROWS. A drift check that fails must be indistinguishable from a drift
 * check that found nothing, because the reply path is the product and this is
 * an addition to it. Callers get null and carry on.
 */
export async function detectDrift(
  hire: HireState,
  company: Company,
  task: RampTask | undefined,
  userText: string,
  system: string,
): Promise<DriftNote | null> {
  // Gate 1.
  if (userText.trim().length < MIN_CHARS_TO_DESCRIBE_AN_APPROACH) return null;

  try {
    const raw = await generate({
      system,
      corpus: renderCorpus(company),
      user: buildDriftPrompt(hire, task, userText),
      schema: DriftSchema,
      label: `drift check for ${hire.name}`,
      // A quarter of the main reply's ceiling: the output is two sentences and
      // a quote, and this call is racing that reply.
      //
      // Not lower, though. This was 2000 and a long "nothing to raise" answer
      // hit the cap; structured output that runs out of tokens comes back
      // unparseable, which lands here as a caught error and silently costs a
      // real finding. Observed worst case is ~1400, so this is 3x headroom over
      // the largest note actually seen and still nowhere near the reply's.
      maxTokens: 4000,
    });

    return buildNote(raw, hire, company, task);
  } catch (err) {
    // Logged, not surfaced. The hire sees a normal reply either way.
    console.warn("[drift] check failed, continuing without it:", err);
    return null;
  }
}

/**
 * Apply gates 2-6 to a model response. Exported for the test harness so the
 * gates can be exercised without spending a model call.
 */
export function buildNote(
  raw: z.infer<typeof DriftSchema>,
  hire: HireState,
  company: Company,
  task: RampTask | undefined,
): DriftNote | null {
  // Gate 2 and 3.
  if (!raw.describesAnApproach) return null;
  if (raw.strength !== "contradicted") return null;

  const observation = raw.observation.trim();
  const whyItMatters = raw.whyItMatters.trim();
  if (observation.length === 0) return null;

  // Gate 4. The same verifier the role derivation uses, with no relaxation:
  // a note is only as real as the sentences it can point at.
  const evidence = groundEvidence(raw.evidence, company);
  if (evidence.length === 0) return null;

  // Gate 5, fail closed. If the model reached for assessment vocabulary about
  // the person, we do not edit it into shape — silently rewriting a judgement
  // into something acceptable is how the ban stops meaning anything. We drop
  // the note and log it, so a regression shows up in the terminal rather than
  // in front of a new hire.
  const flagged = findAssessmentLanguage(`${observation} ${whyItMatters}`);
  if (flagged) {
    console.warn(`[drift] dropped a note containing assessment language: "${flagged}"`);
    return null;
  }

  const note: DriftNote = {
    id: randomUUID(),
    hireId: hire.id,
    taskId: task?.id,
    observation,
    whyItMatters,
    evidence,
    raisedAt: new Date().toISOString(),
    // Both conditions, as the brief requires: consequential AND not resolvable
    // alone. Either one on its own goes to the hire and stops there.
    needsHuman: raw.consequential && !raw.hireCanResolveAlone,
    resolved: false,
  };

  if (note.needsHuman) {
    // Same rule as an escalation blocker: the model may nominate, but the name
    // has to exist on the roster or the hire is sent to message a stranger.
    note.suggestedPerson = resolveOwner(
      company,
      raw.suggestedPerson,
      `${observation} ${task?.title ?? ""}`,
    ).name;
  }

  // Gate 6.
  if (isDuplicateDrift(hire.driftNotes ?? [], note)) return null;

  return note;
}

/**
 * Have we already said this to this person?
 *
 * Two turns in a row about the same approach will produce the same finding from
 * the same artifacts, and repeating it is not new information — it is nagging,
 * which is exactly the register this feature must not land in. Matched on the
 * cited artifacts as well as the wording, because the model rephrases freely
 * but cites the same passage.
 */
export function isDuplicateDrift(existing: DriftNote[], candidate: DriftNote): boolean {
  const text = normaliseKey(candidate.observation);
  const sources = artifactKey(candidate.evidence);
  return existing.some(
    (n) =>
      !n.resolved && (normaliseKey(n.observation) === text || artifactKey(n.evidence) === sources),
  );
}

function normaliseKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function artifactKey(evidence: Evidence[]): string {
  return [...new Set(evidence.map((e) => e.artifactId))].sort().join("|");
}

/**
 * Promote a drift note to a blocker, so the manager screen and the Slack
 * formatter need to know nothing about this feature.
 *
 * Reusing `Blocker` here rather than teaching two consumers a new type is the
 * whole reason the escalation path is safe to add: `components/blocker-list.tsx`
 * and `lib/slack/format.ts` render this exactly as they render any other
 * escalation, and the existing dedupe in the chat route applies to it unchanged.
 *
 * `minutesToUnblock` is deliberately conservative rather than model-supplied.
 * The manager's "how many minutes of your time" total is a promise; a made-up
 * number inside it devalues the honest ones next to it.
 */
export function driftBlocker(note: DriftNote): Blocker {
  return {
    id: randomUUID(),
    hireId: note.hireId,
    taskId: note.taskId,
    summary: note.observation,
    raisedAt: note.raisedAt,
    needsHuman: true,
    suggestedPerson: note.suggestedPerson,
    minutesToUnblock: 10,
    resolved: false,
  };
}

/**
 * The note as the hire reads it, appended to the agent's reply.
 *
 * Built in code rather than asked for as prose, on purpose: the quote that
 * reaches the screen is then byte-identical to the one that passed
 * verification, instead of a second pass at writing it out. A verifier the
 * model can paraphrase around afterwards is not a verifier.
 *
 * Markdown matches `openingMessage` — the web panel shows it as written, and
 * Slack's `toMrkdwn` converts it.
 */
export function renderDriftNote(note: DriftNote, company: Company): string {
  const byId = new Map<string, Artifact>(company.artifacts.map((a) => [a.id, a]));

  const shown = note.evidence.slice(0, MAX_QUOTES_SHOWN);
  const lead = shown[0] ? byId.get(shown[0].artifactId) : undefined;

  /*
   * The person speaks, not the system.
   *
   * Landis, Fisher & Menges (JAP 2020, workplace, N=131 + 97 + 629) found that
   * unsolicited advice with *identical content* gets attributed to wanting to
   * flaunt knowledge (γ=.24) and expose differences (γ=.15), and those
   * attributions mediate drops in learning (b=−.29) and performance (b=−.33).
   * Friendship does not moderate it (p=.673), so being friendlier is not the
   * escape hatch — softening the wording only changes the register, not who the
   * reader thinks is showing off.
   *
   * Marót et al. (2026, N=192, identical text) isolates the active ingredient:
   * the same feedback attributed to AI rather than a person reduced openness to
   * ask for help (η²=0.17) and willingness to correct mistakes (η²=0.14). Those
   * are precisely the behaviours the rest of this product depends on — a drift
   * note that suppresses asking has damaged the loop it sits inside. The same
   * study found human-written-then-AI-refined performed comparably to human,
   * which is exactly this: a real sentence a real colleague wrote, surfaced.
   *
   * So the lead line names the author, the room and the date, and the system
   * says as little as possible. And the tone stays flat — Hao et al. (45,865
   * first issues) found retention peaks at neutral, with strongly positive as
   * costly as harsh, so there is no warm framing here on purpose.
   */
  const lines: string[] = lead
    ? [
        `${lead.author} wrote this${lead.channel ? ` in ${lead.channel}` : ""} on ${shortDate(lead.timestamp)}:`,
      ]
    : [`From your team's own material:`];

  for (const item of shown) {
    const a = byId.get(item.artifactId);
    // Shown as the passage it sits in, not the fragment. A verified quote can
    // still mislead by stopping one sentence early — see lib/agent/sentence.ts.
    const shown = a ? expandToSentence(item.quote, a.text) : item.quote;
    lines.push(``, `> ${shown.trim()}`);
    // Every quote after the first still needs its own attribution — a reader
    // skimming must never have to guess which of two people said which line.
    if (a && a !== lead) {
      lines.push(`— ${a.author}${a.channel ? `, ${a.channel}` : ""}, ${shortDate(a.timestamp)}`);
    }
  }

  /*
   * The decision is the grammatical subject, never the hire. "The team settled
   * this in August" describes a fact about the company; "you're doing it wrong"
   * describes a fact about the reader, and only one of those is ours to assert.
   */
  if (note.observation) lines.push(``, note.observation);
  if (note.whyItMatters) lines.push(``, note.whyItMatters);

  if (note.needsHuman && note.suggestedPerson) {
    lines.push(``, `${note.suggestedPerson} owns this one. It's on your manager's list.`);
  }

  return lines.join("\n");
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * `2026-08-11T12:09:00+02:00` → `11 Aug 2026`, read straight off the string.
 *
 * Not `new Date()`: converting to the server's zone can move a late-evening
 * Stockholm message onto the previous day, and a citation whose date is one off
 * from the Slack the manager is looking at is a citation they stop trusting.
 */
function shortDate(timestamp: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(timestamp);
  if (!m) return timestamp;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/**
 * The volatile tail. Same shape as the supervision turn's, minus the parts this
 * check has no use for — and it must stay short, because everything here lands
 * after the cache breakpoints and is charged at full input price.
 */
function buildDriftPrompt(
  hire: HireState,
  task: RampTask | undefined,
  userText: string,
): string {
  const alreadySaid = (hire.driftNotes ?? [])
    .filter((n) => !n.resolved)
    .map((n) => `- ${n.observation}`)
    .join("\n");

  return [
    INSTRUCTIONS,
    ``,
    `<hire name="${hire.name}" role="${hire.roleTitle}" started="${hire.startedAt}" />`,
    ``,
    task
      ? [
          `<current_task id="${task.id}">`,
          `Title: ${task.title}`,
          `Done when: ${task.doneWhen}`,
          `</current_task>`,
        ].join("\n")
      : `<current_task>none</current_task>`,
    ``,
    alreadySaid
      ? `<already_raised_with_them>\n${alreadySaid}\n</already_raised_with_them>`
      : `<already_raised_with_them>nothing yet</already_raised_with_them>`,
    ``,
    `<message_from_hire>`,
    userText,
    `</message_from_hire>`,
  ].join("\n");
}
