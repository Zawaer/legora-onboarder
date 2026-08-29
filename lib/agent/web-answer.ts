/**
 * The web rung, and the rendering that keeps it legible as a web rung.
 *
 * WHERE IT SITS
 *
 *   corpus hit              -> verbatim internal citation      (unchanged)
 *   corpus miss + GENERAL   -> answered from here, no human touched
 *   corpus miss + INTERNAL  -> the existing escalation ladder  (unchanged)
 *
 * The corpus always wins: nothing in this file runs until the supervision turn
 * has already come back saying the company's own artifacts could not resolve
 * the question. `lib/web/contract.ts` has the argument for why.
 *
 * WHY THE RENDERING IS THE HARD PART, NOT THE SEARCH
 *
 * The product's whole differentiator is that a quote is verbatim, attributed to
 * a named person, with a channel and a date. That claim is only worth something
 * while the reader can tell, without effort, which sentences carry it. A web
 * answer that renders like an internal one does not merely add a weak answer —
 * it retroactively weakens every strong one, because the reader can no longer
 * distinguish them by looking. So:
 *
 *   - the answer opens with WEB_PREAMBLE, before its first word of content
 *   - it closes with WEB_ESCAPE_HATCH, verbatim, always
 *   - it never carries a `>` line, so it can never pick up the accent-ruled
 *     blockquote the renderer reserves for verified internal citations
 *   - it is never merged with the model's own reply: a web-answered turn
 *     *replaces* that reply rather than appending to it
 *   - no colleague's name is attached to any of it
 *
 * The last two are enforced structurally rather than by prompt, because a rule
 * a model is asked to follow is a rule that fails on some percentage of turns,
 * and the acceptable percentage here is zero.
 *
 * NOTHING HERE IS EVER WRITTEN BACK TO THE CORPUS. A web answer is not
 * institutional knowledge and must not become citable as such; the elicitation
 * loop in `lib/agent/knowledge.ts` is the only thing that adds to a corpus, and
 * this file has no path to it.
 */

import { classifyQuestion } from "@/lib/agent/classify";
import { searchWeb } from "@/lib/web/linkup";
import {
  MIN_CONFIDENCE_FOR_WEB,
  WEB_ESCAPE_HATCH,
  WEB_PREAMBLE,
  type Classification,
  type WebAnswer,
  type WebSource,
} from "@/lib/web/contract";

/** Two or three links is what a person clicks. More reads as a results page. */
const MAX_SOURCES_SHOWN = 3;

export type WebRungOutcome =
  /** Answered from the web. `reply` replaces the model's reply wholesale. */
  | { kind: "answered"; reply: string; classification: Classification; sources: WebSource[] }
  /**
   * Fall through to the existing human escalation path, untouched.
   * `classification` is null only when the classifier itself could not run.
   */
  | { kind: "fallthrough"; classification: Classification | null; why: string };

/**
 * Run the rung for a question the corpus could not answer.
 *
 * Never throws, and never returns an error for the hire to read. Every failure
 * mode — the classifier, a missing key, a timeout, an unusable answer — comes
 * back as `fallthrough`, which means the turn behaves exactly as it did before
 * this rung existed. A question must never be swallowed by a feature that was
 * added to save someone five minutes.
 *
 * The classifier runs on *every* corpus miss, including ones that will not
 * reach the web: it is what the "% of corpus misses that were GENERAL" number
 * divides by, and a denominator sampled only from the cases that succeeded is
 * not a denominator. That is one small model call, on the miss path only.
 *
 * No timeout is imposed here. `searchWeb` owns the deadline and reads it from
 * the contract at call time, so raising it is a one-line change in one file
 * rather than a hunt for a second copy of the number.
 */
export async function webRung(
  question: string,
  insufficientContext?: string,
): Promise<WebRungOutcome> {
  let classification: Classification;
  try {
    // Documented to fail closed to INTERNAL rather than throw. The catch is the
    // belt to that braces: if it ever did throw, the cost must be an ordinary
    // escalation, not a dead turn.
    classification = await classifyQuestion(question, insufficientContext);
  } catch (err) {
    console.warn("[web-rung] classifier failed; escalating to a human:", err);
    return { kind: "fallthrough", classification: null, why: "classifier failed" };
  }

  if (classification.class !== "GENERAL") {
    return { kind: "fallthrough", classification, why: "classified INTERNAL" };
  }

  // Re-checked here even though the classifier already applies the same policy.
  // This is the threshold that decides whether a colleague is spent, and it is
  // cheap to assert twice at the point of no return.
  if (!(classification.confidence >= MIN_CONFIDENCE_FOR_WEB)) {
    return {
      kind: "fallthrough",
      classification,
      why: `confidence ${classification.confidence} below ${MIN_CONFIDENCE_FOR_WEB}`,
    };
  }

  let answer: WebAnswer;
  try {
    answer = await searchWeb(question);
  } catch (err) {
    // Logged, never surfaced. The hire sees the escalation they would have seen
    // last week; nobody has to learn what Linkup is because it had a bad minute.
    console.warn(
      `[web-rung] web search failed (${err instanceof Error ? err.message : String(err)}); escalating to a human.`,
    );
    return { kind: "fallthrough", classification, why: "web search failed" };
  }

  const reply = renderWebAnswer(answer);
  if (!reply) {
    console.warn("[web-rung] web search returned nothing usable; escalating to a human.");
    return { kind: "fallthrough", classification, why: "unusable web answer" };
  }

  return { kind: "answered", reply, classification, sources: usableSources(answer.sources) };
}

/**
 * Strip anything that would let this text borrow the internal citation's
 * clothes.
 *
 * `>` is the renderer's marker for a verified internal quote and gets the
 * accent rule. A web answer that happened to quote a Stack Overflow post with a
 * leading `>` would render identically to a sentence a named colleague actually
 * wrote in Slack six weeks ago. That is the exact confusion this whole rung is
 * designed to be immune to, so the character is removed rather than escaped.
 */
function sanitise(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*>+\s?/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function usableSources(sources: WebSource[]): WebSource[] {
  const seen = new Set<string>();
  const out: WebSource[] = [];

  for (const s of sources ?? []) {
    const url = (s?.url ?? "").trim();
    // http(s) only, and parsed rather than pattern-matched: a `javascript:` or
    // `data:` href rendered as a link in a chat the hire trusts is a real hole,
    // and this text originates outside the building by definition.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
    if (seen.has(parsed.href)) continue;
    seen.add(parsed.href);

    // Square brackets would break out of the link syntax below; the title is
    // upstream text and gets no benefit of the doubt.
    const title = (s.title ?? "").replace(/[\[\]]/g, "").trim() || parsed.hostname;
    out.push({ title, url: parsed.href });
    if (out.length >= MAX_SOURCES_SHOWN) break;
  }

  return out;
}

/**
 * The rendered turn. Plain text, because that is what every surface consumes —
 * the chat renderer, the Slack formatter, a copy-paste into a ticket. The
 * structure is what carries the distinction, and it survives all three.
 *
 * Returns "" when there is nothing worth showing, which the caller treats as a
 * failure and escalates. An answer with no sources is not a web answer, it is
 * an assertion, and an unsourced assertion about how something works is the one
 * thing this product exists to not do.
 */
export function renderWebAnswer(answer: WebAnswer): string {
  const body = sanitise(answer?.answer ?? "");
  const sources = usableSources(answer?.sources ?? []);
  if (!body || sources.length === 0) return "";

  return [
    // Announces itself before its first word of content. Not after, not beside.
    WEB_PREAMBLE,
    ``,
    body,
    ``,
    `Sources:`,
    ...sources.map((s) => `- [${s.title}](${s.url})`),
    ``,
    // Verbatim, always. This is the line that converts a misclassification into
    // a two-second correction by the only person who always knows better than
    // the classifier: the one who asked.
    WEB_ESCAPE_HATCH,
  ].join("\n");
}

/**
 * What the classifier gets to see besides the question.
 *
 * The contract asks for "the retrieved-but-insufficient snippets", so that "why
 * do retries live in the consumer" can stop looking general once you can see
 * the corpus is full of this team arguing about their own retry placement. This
 * agent does not retrieve — the whole corpus goes in on every turn — so the
 * honest local equivalent is the task the hire is on and the corpus-derived
 * material they were handed for it. That is real company text, selected for
 * this moment, which is exactly the shape the contract is describing.
 *
 * NOT THE AGENT'S OWN REPLY. Measured, on the live turn this was first built
 * against:
 *
 *   nothing                          GENERAL 0.93   INTERNAL 0.98
 *   task title only                  GENERAL 0.92   INTERNAL 0.95
 *   task title + task context        GENERAL 0.95   INTERNAL 0.95   ← this
 *   the agent's composed reply       INTERNAL 0.92  INTERNAL 0.95   ← inverted
 *
 * The reply inverts the signal, and it does so systematically rather than by
 * luck. The supervision prompt tells the model to reach into the corpus and
 * cite whoever it can, so its answer to "rebase or merge before a PR" comes
 * back naming a colleague and a ticket — the model being useful, not the
 * question being about this company. Feeding that back as evidence makes the
 * classifier read the agent's helpfulness as company-specificity, and it fails
 * in the one direction the whole rung exists to avoid: sending a plainly
 * general question to a human anyway.
 *
 * Truncated, because the classifier is a small fast model and this is context,
 * not the question.
 */
export function classifierContext(task?: {
  title: string;
  context?: string;
}): string | undefined {
  if (!task) return undefined;

  const parts = [`The hire is currently working on: ${task.title}`];
  const context = task.context?.trim();
  if (context) {
    parts.push(
      `The corpus material they were given for it:\n${context.slice(0, 1200)}`,
    );
  }
  return parts.join("\n\n");
}
