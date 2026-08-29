/**
 * Is this question about *this company*, or about the stack anyone in the
 * industry shares?
 *
 * ── WHY THIS DECISION IS THE WHOLE FEATURE ───────────────────────────────────
 *
 * `lib/web/contract.ts` has the full argument; the short version is that the two
 * ways of being wrong here are not the same size.
 *
 *   Wrongly INTERNAL (the question was general, we asked a colleague anyway)
 *     → a few minutes of one person's time, and expert attention is the one
 *       resource this product cannot mint. Bad, bounded, recoverable.
 *
 *   Wrongly GENERAL (the question was about us, we answered it from the web)
 *     → a fluent, confident, plausible answer about how this company works,
 *       written by something that has never seen this company. It reads exactly
 *       like a good answer. The hire acts on it. This is the failure that
 *       `ground.ts` exists to prevent everywhere else in the product, and it
 *       does not lose a user politely — it loses them permanently, and it
 *       retroactively poisons every verbatim citation we ever showed them.
 *
 * One of those is recoverable and the other is not, so the tie does not go to
 * the middle. It goes to INTERNAL. Below `MIN_CONFIDENCE_FOR_WEB` (0.75) a
 * GENERAL verdict is overruled — a human is asked instead.
 *
 * ── WHY THE CLAMP IS IN CODE AND NOT IN THE PROMPT ───────────────────────────
 *
 * A threshold written into a prompt is a suggestion. It is subject to the
 * model's read of the room, it drifts silently when the prompt is edited for an
 * unrelated reason, and it cannot be unit-tested. The prompt below therefore
 * asks for one thing only — an honest, calibrated confidence — and the policy is
 * applied afterwards, in `applyPolicy`, where it is three lines you can read and
 * a number you can change with a diff. The model does not get a vote on the
 * threshold, and it must not be told to bias its own confidence toward INTERNAL
 * either: that would apply the asymmetry twice and quietly make the number
 * meaningless.
 *
 * ── WHY THE INSUFFICIENT SNIPPETS ARE PASSED IN ──────────────────────────────
 *
 * "Why do retries live in the consumer and not the handler" reads like a
 * distributed-systems question right up until you see that the corpus is full of
 * this team arguing about their own retry placement. The corpus that *failed to
 * answer* the question is still the strongest available evidence about whether
 * the question was ever ours — a near-miss on this exact topic, in this
 * company's own words, is close to proof that the answer is institutional and
 * merely unwritten. So the snippets go to the classifier even though they were
 * useless to the retriever.
 *
 * ── WHY IT FAILS CLOSED ──────────────────────────────────────────────────────
 *
 * Any error — no API key, a timeout, a malformed response, a refusal — returns
 * INTERNAL at confidence 0. A classifier that fails open silently starts
 * web-answering questions about the company, and it does it quietly, at the
 * exact moment something else is already broken.
 */

import { z } from "zod/v4";
import { FAST_MODEL, generate } from "@/lib/anthropic";
import {
  MIN_CONFIDENCE_FOR_WEB,
  type Classification,
  type ClassifyQuestion,
} from "@/lib/web/contract";

/**
 * A two-label decision on the latency path of a live chat turn. It does not need
 * a frontier model, and the hire would feel it if it used one. Exact id, no date
 * suffix — a suffixed id is a different (usually retired) model and a 404.
 */
export const CLASSIFIER_MODEL = FAST_MODEL;

/** Enough for a label, a number and one sentence, with room to not truncate. */
const MAX_TOKENS = 512;

/** Long questions are pasted stack traces; the first paragraph carries the intent. */
const MAX_QUESTION_CHARS = 2000;

/** Enough corpus to see what the team argues about, not enough to slow the call. */
const MAX_CONTEXT_CHARS = 6000;

const ClassificationSchema = z.object({
  class: z.enum(["GENERAL", "INTERNAL"]),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Your calibrated probability that the label above is correct, 0 to 1."),
  reason: z.string().describe("One short sentence. Read by us in logs, never by the new hire."),
});

const SYSTEM = `You route questions from a new hire that this company's own written record could not answer.

You output one label.

GENERAL — answerable by anyone working with the same technology, with no knowledge of THIS company. The answer would be identical at any other company using the same stack. Standard tooling, languages, protocols, public APIs, published standards, general engineering or legal practice.
  "How does Postgres handle concurrent schema migrations."
  "What is the difference between a debounce and a throttle."

INTERNAL — the answer depends on this company: its people, its history, its conventions, its codebase, its clients, or a decision someone here made. Even when the surface of the question is a general technology, if what is really being asked is "how do WE do it / why did WE do it that way / who here owns it", it is INTERNAL.
  "Who signs off on billing schema changes."
  "Why do retries live in the consumer and not the handler."

Rules, in order:

1. If the question names or implies a specific person, team, channel, service, repo, internal tool, client, ticket, or a past decision — INTERNAL. No exceptions. A general-sounding question with one internal noun in it is an internal question.

2. Read the corpus excerpts. They are the company's own writing, retrieved for this question and judged insufficient to answer it. They are still evidence: if this company has visibly been arguing about, deciding on, or working through this exact topic in its own words, then the real answer is institutional and merely unwritten, and the question is INTERNAL — however general the phrasing looks. A question phrased in industry-standard terms that lands squarely on a topic the excerpts show this team has already fought over is the single most common way an internal question disguises itself.

3. Ask: would a competent engineer at a different company, with the same stack, give the same correct answer? If yes, GENERAL. If they would have to ask someone here first, INTERNAL.

4. "I do not know the answer" is not evidence either way. Judge what kind of question it is, not whether you could answer it.

Report your confidence honestly and calibrated: the probability that the label you chose is the right one. Do not shade it in either direction to be safe — the policy that decides what happens with a borderline case is applied after you, by code that needs a real number to work with. An obvious case should read 0.95; a genuinely ambiguous one should read 0.5, and saying so is the useful answer.`;

function truncate(text: string, max: number): string {
  const clean = text.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max)}\n[…truncated]`;
}

function buildUser(question: string, insufficientContext?: string): string {
  const excerpts = insufficientContext?.trim()
    ? truncate(insufficientContext, MAX_CONTEXT_CHARS)
    : "(none — the retrieval returned nothing at all for this question)";

  return [
    "Corpus excerpts retrieved for this question and judged insufficient to answer it:",
    "<excerpts>",
    excerpts,
    "</excerpts>",
    "",
    "The new hire asked:",
    "<question>",
    truncate(question, MAX_QUESTION_CHARS),
    "</question>",
    "",
    "Classify the question.",
  ].join("\n");
}

/** The failure verdict, in one place so every catch below is identical. */
function failClosed(reason: string): Classification {
  return { class: "INTERNAL", confidence: 0, reason: `Classifier failed closed: ${reason}` };
}

/**
 * The asymmetry, applied. This is the part of the file that decides whether a
 * colleague gets interrupted, and it is deliberately boring.
 *
 * On a clamp, `confidence` stays the model's own sub-threshold number rather
 * than being zeroed or inverted. It is the reason the class was overruled, so
 * it is the number worth having in the log — and it stays distinguishable from
 * the hard 0 that `failClosed` writes, which means something entirely different.
 */
export function applyPolicy(raw: Classification): Classification {
  if (raw.class !== "GENERAL") return raw;
  if (raw.confidence >= MIN_CONFIDENCE_FOR_WEB) return raw;

  return {
    class: "INTERNAL",
    confidence: raw.confidence,
    reason:
      `Held back from the web: GENERAL at ${raw.confidence.toFixed(2)} is below the ` +
      `${MIN_CONFIDENCE_FOR_WEB} bar. (${raw.reason})`,
  };
}

/**
 * Classify a question the corpus could not answer. One model call, no retry:
 * a retry doubles the latency a hire is sitting through, and the fallback for a
 * failure — ask a human — is the behaviour this product already ships.
 */
export const classifyQuestion: ClassifyQuestion = async (
  question: string,
  insufficientContext?: string,
): Promise<Classification> => {
  if (!question.trim()) return failClosed("empty question");

  let raw: z.infer<typeof ClassificationSchema>;
  try {
    raw = await generate({
      system: SYSTEM,
      user: buildUser(question, insufficientContext),
      schema: ClassificationSchema,
      label: "question classification",
      model: CLASSIFIER_MODEL,
      maxTokens: MAX_TOKENS,
    });
  } catch (err) {
    return failClosed(err instanceof Error ? err.message : "unknown error");
  }

  // Belt and braces on the one value the policy branches on. A non-finite
  // confidence compares false against every threshold, so it would sail past
  // the clamp as a GENERAL rather than tripping it.
  if (!Number.isFinite(raw.confidence)) return failClosed("non-finite confidence");

  return applyPolicy({
    class: raw.class,
    confidence: raw.confidence,
    reason: raw.reason.trim() || "(no reason given)",
  });
};
