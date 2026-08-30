/**
 * The web rung: the shared contract.
 *
 * WHY THIS EXISTS
 *
 * Our one structural risk is expert fatigue. Published response rates for
 * "please answer this newcomer's question" systems settle around 10-20% at
 * steady state, concentrated on a handful of people who quickly learn to ignore
 * it. Ackerman's Answer Garden experts panicked at two questions a week.
 *
 * So every question routed to a human spends a scarce, non-renewable resource —
 * and a large share of what a new hire asks is not institutional knowledge at
 * all. "How do I read env vars in a Next.js server component" has nothing to do
 * with this company, and it must never cost a colleague anything.
 *
 * This rung sits between "the corpus cannot answer" and "escalate to a human":
 *
 *   corpus hit              -> verbatim internal citation      (unchanged)
 *   corpus miss + GENERAL   -> answered from the web, no human touched
 *   corpus miss + INTERNAL  -> the existing escalation ladder  (unchanged)
 *
 * THE ASYMMETRY THAT DECIDES EVERYTHING BELOW
 *
 * Wrongly web-answering an internal question produces a confident, plausible,
 * wrong answer about how this company works — the failure that loses a user
 * permanently, and the exact thing `ground.ts` exists to prevent everywhere
 * else. Wrongly escalating a general question costs a colleague a few minutes.
 *
 * One of those is recoverable. So the classifier defaults to INTERNAL whenever
 * it is not sure, and "not sure" is set deliberately high.
 */

/** Nothing below this is confident enough to keep a human out of the loop. */
export const MIN_CONFIDENCE_FOR_WEB = 0.75;

/**
 * Hard ceiling. This sits on the latency path of a live chat turn.
 *
 * Was 5s by guess; raised to 8s on measurement. Linkup `search` at
 * `depth: "standard"`, 8 real calls from this machine (5 repeats of one query +
 * 3 distinct ones): min 2.41s, median 2.86s, p90 3.66s, max 3.66s, with a 3.80s
 * observed separately. A 5s cap leaves ~1.3s of headroom over p90, so a normal
 * bad-network day starts tripping it.
 *
 * That matters more than it looks, because the timeout is not free: firing it
 * falls through to human escalation, which is the exact cost this rung exists to
 * avoid. A cap that trips on a slow-but-fine call spends a colleague's attention
 * to save three seconds. Meanwhile a whole chat turn already runs 20-37s, so the
 * extra seconds are not what the hire notices.
 *
 * 8s is ~2.2x the measured p90: it absorbs a doubling in upstream latency and
 * still fails fast enough to escalate inside the same turn. Re-measure before
 * moving it again, and keep the numbers here.
 */
export const WEB_TIMEOUT_MS = 8_000;

export type QuestionClass = "GENERAL" | "INTERNAL";

export type Classification = {
  /**
   * GENERAL — answerable by anyone with the same stack, no knowledge of THIS
   * company required.
   * INTERNAL — the answer depends on this company's people, history,
   * conventions or decisions.
   */
  class: QuestionClass;
  confidence: number;
  /** One short sentence. Shown in logs and the dashboard, never to the hire. */
  reason: string;
};

export type WebSource = { title: string; url: string };

export type WebAnswer = {
  answer: string;
  sources: WebSource[];
};

/**
 * Classify a question that the corpus could not answer.
 *
 * Receives the retrieved-but-insufficient snippets as well as the question:
 * "why do retries live in the consumer" looks general until you can see that
 * the corpus is full of this team arguing about their own retry placement.
 */
export type ClassifyQuestion = (
  question: string,
  insufficientContext?: string,
) => Promise<Classification>;

/** One function, so the provider is swappable. Throws on failure; caller falls through. */
export type SearchWeb = (query: string) => Promise<WebAnswer>;

/**
 * How a resolved question was answered. Written for every question, so the
 * dashboard can report what fraction of corpus misses never touched a person.
 */
export type ResolutionRecord = {
  questionId: string;
  hireId: string;
  companySlug: string;
  classification: QuestionClass | null;
  confidence: number | null;
  resolvedBy: "corpus" | "web" | "peer" | "expert";
  latencyMs: number;
  at: string;
};

/**
 * The sentence that makes a misclassification recoverable.
 *
 * Required, not decorative. When the classifier is wrong, this converts a
 * confidently wrong answer into a two-second correction by the one person who
 * always knows better than the classifier: the person who asked.
 */
export const WEB_ESCAPE_HATCH =
  "If this is actually about how *we* do it, say so and I'll ask someone.";

/**
 * The lead-in. A web answer must announce itself as not-from-the-company before
 * its first word of content.
 *
 * Our entire differentiator is that a quote is verbatim and attributed. If a web
 * answer renders like an internal one, that distinction stops being legible and
 * the trust model collapses — so internal and web content are never blended in
 * one block, a web source never appears in the citation component, and no web
 * answer is ever attributed to a colleague.
 */
export const WEB_PREAMBLE =
  "Nobody here has written this down, but it isn't company-specific. Here's the general answer:";
