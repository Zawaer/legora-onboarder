/**
 * The job description, checked against the traces.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A DIFFERENT CLAIM FROM `derive.ts`, AND A STRONGER ONE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `derive.ts` says: here is what this role *is*, reconstructed from evidence.
 * That is the interesting claim and it is also the unfalsifiable one. Nothing in
 * the published literature does it: the best measured result on the adjacent,
 * far easier task — binary "is A senior to B" from communication traces, with
 * hand-labelled supervision — tops out around 80%, and the unsupervised attempts
 * failed outright. So a synthesised role description is a confident paragraph
 * with no way for the reader to check it.
 *
 * That would merely be weak if it were inert. It is not inert. Jakesch et al.
 * (CHI 2023, N=1,506) put opinionated model output in front of people writing on
 * a topic and found they became roughly twice as likely to argue the model's
 * position afterwards (d≈0.5), the shift persisted past the task, and only about
 * 20% of them noticed they had been influenced. A generated description of
 * somebody's own team is therefore a persuasion channel that is considerably
 * stronger than its accuracy channel. Being 70% right is not a defence when the
 * remaining 30% is adopted as the reader's own opinion without them noticing.
 *
 * This module makes the falsifiable version of the claim instead:
 *
 *     We do not tell you what the role is. We take the description YOU wrote,
 *     break it into claims, and for each one show you what your own traces say —
 *     including where they say something incompatible, and including, loudly,
 *     where they say nothing at all.
 *
 * Every non-silent verdict is a quote a real person really wrote, verified
 * character by character. The reader can check any of it in four seconds by
 * opening Slack. That is the whole difference: a derivation asks to be believed,
 * a contradiction asks to be checked.
 *
 * It is also the thing retrieval cannot do. Glean, Company Knowledge and every
 * enterprise search box return what is written. The finding here is the *gap*
 * between what is written and what is happening, which is not a document and
 * therefore cannot be retrieved.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SILENCE IS A RESULT, NOT A FAILURE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A third verdict exists and it is first class. If a posting promises "providing
 * demos" and three weeks of the team's Slack, tickets, docs and meeting notes
 * never once touch it, that is a finding with two honest readings: either it is
 * not happening, or it happens somewhere we cannot see. We say both, and we say
 * which rooms we were looking in (`corpusCoverage`), so the reader can tell the
 * difference for themselves.
 *
 * A tool that only ever reports hits is a tool that manufactures hits. The
 * silent count is the number that makes the other two numbers trustworthy.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ASYMMETRY — same one as the drift detector, for the same reason
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A missed contradiction costs nothing: the reader is exactly where they were
 * without this feature. A false contradiction tells a hiring manager, in front
 * of a customer, that their own job posting is at odds with their own team — on
 * evidence that does not hold. The first one of those ends the conversation and
 * retroactively poisons every verdict next to it, including the true ones.
 *
 * So everything uncertain falls through to `silent`, and six gates sit between
 * the model and the screen:
 *
 *   1. blind extraction — claims are pulled from the posting by a call that has
 *      never seen the corpus, so the denominator is not chosen to flatter
 *   2. the claim is real  — the quoted line is verified as a substring of the
 *      pasted document, through `groundEvidence` itself
 *   3. the verdict is one of exactly three, and anything else becomes `silent`
 *   4. grounding         — every citation verified verbatim against the real
 *      artifact by `ground.ts`, unchanged; nothing survives → `silent`
 *   5. no verdict on the document — we report the traces, never "the JD is
 *      wrong"; a verdict that reaches for that vocabulary is downgraded
 *   6. no assessment of a named person, checked in code, fail closed
 *
 * Gate 4 is the one that cannot be argued with. The model may be as certain as
 * it likes that a posting is contradicted; if it cannot produce a sentence a
 * real colleague really wrote, the contradiction does not exist.
 */

import { z } from "zod/v4";
import { generate } from "@/lib/anthropic";
import { renderCorpus } from "@/lib/agent/derive";
import { groundEvidence, groundingReport } from "@/lib/agent/ground";
// Reused rather than re-listed: the ban on assessing a person is written once
// in lib/slack/format.ts and this is the fourth surface that honours it.
import { findAssessmentLanguage } from "@/lib/slack/format";
import type { Artifact, Company, Evidence } from "@/lib/types";

/* ════════════════════════════════════════════════════════════════ types ══ */

/**
 * Exactly three. There is deliberately no fourth for "partly" or "unclear":
 * every hedge a reader is offered is a hedge they will resolve in the direction
 * they already believed, and the point of this feature is to be checkable.
 */
export type JdVerdict = "supported" | "contradicted" | "silent";

export type JdClaim = {
  id: string;
  /** Verbatim from the pasted document. Verified as a substring of it. */
  quote: string;
  /**
   * The same claim as one plain sentence, never stronger than the quote. Shown
   * *next to* the quote, never instead of it, so a reader can check the
   * restatement as easily as they can check the citation.
   */
  proposition: string;
  verdict: JdVerdict;
  /**
   * What the traces show, naming who and when. Describes the company's own
   * material; never passes judgement on the document. Empty for `silent`.
   */
  observation: string;
  /**
   * For `silent` only: where this would have shown up if it were happening, in
   * one line. A statement about our visibility, not about the company.
   */
  blindSpot?: string;
  /** Verified verbatim citations. Always empty for `silent`. */
  evidence: Evidence[];
};

/** What we were actually able to look at. Computed in code, never by the model. */
export type JdCoverage = {
  artifacts: number;
  people: number;
  channels: string[];
  kinds: string[];
  /** ISO dates, earliest and latest artifact. Empty string on an empty corpus. */
  from: string;
  to: string;
};

export type JdCheck = {
  companySlug: string;
  companyName: string;
  claims: JdClaim[];
  summary: {
    total: number;
    supported: number;
    contradicted: number;
    silent: number;
    /**
     * Verdicts that were `supported` or `contradicted` until a gate took them
     * to `silent`. Surfaced rather than hidden: a run where this is large is a
     * run where the model was reaching, and the operator should know.
     */
    downgraded: number;
    /** Claims the model quoted that are not in the pasted document. Dropped. */
    inventedClaims: number;
    /** Citations that are not in the corpus they were attributed to. Dropped. */
    droppedCitations: number;
  };
  coverage: JdCoverage;
  /** Metadata for every artifact actually cited, so a citation can be attributed. */
  sources: Record<string, Pick<Artifact, "id" | "kind" | "author" | "timestamp"> & {
    channel?: string;
    title?: string;
  }>;
  generatedAt: string;
};

/** A pasted document longer than this is not a job description. */
export const MAX_JD_CHARS = 20_000;
/** Shorter than this and there is nothing to break into claims. */
export const MIN_JD_CHARS = 40;

/** Bound the output. A posting with more checkable claims than this is a book. */
const MAX_CLAIMS = 24;

/* ══════════════════════════════════════════════════════════ the prompts ══ */

/**
 * Pass one. Note what this prompt does NOT get: the corpus.
 *
 * That is the single most important design decision in this file. If the same
 * call could see the company's data while choosing which lines of the posting to
 * pull out, it would preferentially pull out the lines it could already tell
 * were contradictable — and the summary we hand back ("14 claims, 4
 * contradicted") would have a denominator selected to make the numerator look
 * good. Blind extraction costs one extra round trip and buys an honest
 * fraction, which is the only number on the page a reader cannot verify for
 * themselves.
 */
const EXTRACT_SYSTEM = `You break a job posting into separately checkable claims. That is the entire job. You are not evaluating anything.

You have not been shown the company's internal data, and you will not be. Choose the claims as if the person checking them were on your side.

WHAT COUNTS AS A CLAIM

A claim is a statement about what the role does, owns, decides, produces, or is expected to be able to do. "Acts as a liaison between clients and product development" is a claim. "Documents best practices" is a claim. "You will be the voice of the user internally" is a claim.

Split a compound line into separate claims when each half could turn out differently: "documenting best practices, and contributing to scalable playbooks" is two.

WHAT IS NOT A CLAIM

Benefits, salary, location, visa, equal-opportunity boilerplate, how to apply, how long the process takes, and prose about the company's mission, funding or market. None of that is about the work, so none of it is checkable against how the work is done.

Nor is a line so generic that every company on earth would satisfy it — "strong communicator", "thrives in a fast-paced environment", "team player". Those are not false, they are unfalsifiable, and putting them in the list pads the denominator with claims that could only ever come back silent.

THE TWO FIELDS

quote — a verbatim contiguous substring of the posting, copied character for character. Do not fix the punctuation, do not expand the abbreviation, do not stitch two lines together, do not add the bullet marker if it is not part of the sentence. A downstream check verifies every quote against the pasted text and discards any that is not there. Long enough to stand alone as a sentence a reader recognises.

proposition — the same claim as one plain sentence, in the third person, about the role. It must never be STRONGER than the quote. If the posting hedges, the hedge survives: "not necessarily a coder, but comfortable with technical conversations" becomes "The role does not require coding ability, but does require comfort with technical conversations" — not "The role does not involve writing code". If the posting says "contribute to", the proposition says contribute, not own. Overstating here is the single easiest way to manufacture a false finding later, because the check that follows will faithfully check whatever you wrote.

HOW MANY

As many as the posting genuinely makes, usually five to fourteen. A short posting gets a short list. Do not invent claims the posting implies but does not state — an implication you had to supply is your claim, not theirs.`;

/**
 * Pass two. The adjudicator.
 *
 * Lives in the system prompt (stable across every JD anyone pastes) with the
 * corpus behind its own cache breakpoint, so the volatile tail is just the
 * claim list. Two people checking two different postings against the same
 * company pay for the corpus once.
 */
const ADJUDICATE_SYSTEM = `You are given a company's complete internal corpus — Slack, docs, tickets, meeting notes — and a list of claims taken from a job posting for a role at that company. For each claim you return exactly one of three verdicts, and for two of the three you must produce a real quote.

You are not judging the posting. You are reporting what the company's own material shows. Those are different jobs and only the second one is yours.

THE THREE VERDICTS

supported — the corpus shows this actually happening, specifically, and you can point at it. Not "this is plausible", not "this is consistent with". Someone did this thing, or is visibly on the hook for it, in a passage you can quote.

contradicted — the corpus shows something incompatible with the claim AS WRITTEN. Three shapes count, and nothing else does:
  (a) somebody with standing over that area states the opposite in writing;
  (b) the work is visibly done in a way the claim rules out, or a thing the claim presupposes is visibly absent — the claim assumes an owner and the corpus shows nobody owns it, the claim assumes a process and the corpus shows it happens when somebody happens to notice;
  (c) the claim presents as settled something the corpus shows is openly unresolved: two named people disagreeing in writing, carried across meetings, with no decision recorded. A posting that states a boundary the company is still arguing about is contradicted by the argument, and the argument is quotable.

silent — everything else, and it is the correct answer far more often than either of the others. The corpus does not touch it. Or it touches the topic but does not settle this claim. Or you can construct a reading under which it is contradicted, which means you are reasoning rather than reading.

BIAS HARD TOWARD SILENT

A silent verdict costs nothing: the reader learns that their own material does not speak to this, which is itself worth knowing. A wrong contradiction tells a hiring manager that their own posting is at odds with their own team, on evidence that will not hold when they open Slack and look — and once one verdict falls over, every other verdict on the page falls with it, including the true ones.

Ten missed contradictions are cheaper than one invented one. If you are reaching, you are wrong. Return silent.

THE QUOTE IS THE VERDICT

Every citation must be a verbatim contiguous substring of the artifact you attribute it to, and it must be the passage that actually does the work — the sentence where the disagreement happens, the line where the owner turns out not to exist. A quote that merely mentions the topic is not evidence of anything. Use '...' only to elide the middle of a long passage.

A downstream check verifies every quote against the real artifact text and silently discards any that does not match. If nothing survives, your verdict is replaced with silent. You cannot get an invented quote past it; you can only lose the finding it was carrying. If you cannot find a real sentence, there is no finding.

Prefer two citations from different artifacts for a contradiction where the corpus offers them, and especially for shape (c), where the evidence is that two people said different things: quote both of them.

HOW TO PHRASE IT

Write what the traces show, name the person and the date, and let the juxtaposition do the work. The posting is quoted directly above your sentence on the page; the reader can see the gap without being told there is one.

  Good: "On 18 August Anders Wikström and Elin Sandberg went round twice on exactly this in the Ardent retro and the notes record no decision."
  Good: "Nina Ekström asked who owns the library on 13 August and got three different answers; it was still open at the sync on the 28th."
  Bad:  "The job description is wrong about this."
  Bad:  "The posting overstates the role's ownership."
  Bad:  "This is inaccurate."

Never pass judgement on the document. Never say it is wrong, misleading, overstated, aspirational or out of date — those are conclusions for the reader to draw from evidence you handed them, and they are conclusions you cannot support anyway: you have seen three weeks of one company's messages, not the company. One or two sentences. The quote is doing the work.

Never assess a person. No scores, no ratings, no judgement of anybody's performance. If a contradiction can only be phrased as a criticism of a named individual, it is not a finding about the role and you should return silent.

WHEN YOU RETURN SILENT

Say, in one short line, where this would have shown up if it were happening — the channel, the board, the kind of document. "Nothing in #legal-eng, #customer-escalations or the LEGAL-ENG board over these three weeks mentions running a demo." That line is about what we can see, not about what the company does, and it is what lets the reader tell "this is not happening" apart from "this happens somewhere you did not look".`;

/* ═══════════════════════════════════════════════════════════ the schemas ══ */

const ExtractedClaimsSchema = z.object({
  claims: z
    .array(
      z.object({
        quote: z
          .string()
          .describe(
            "A verbatim contiguous substring of the posting, copied character for character.",
          ),
        proposition: z
          .string()
          .describe(
            "The claim as one plain third-person sentence about the role. Never stronger than " +
              "the quote; hedges in the quote survive into it.",
          ),
      }),
    )
    .describe("The checkable claims the posting makes about the work, in the order they appear."),
});

const EvidenceSchema = z.object({
  artifactId: z
    .string()
    .describe("The exact id of the artifact this quote comes from, copied character for character."),
  quote: z
    .string()
    .describe(
      "A verbatim contiguous substring of that artifact's text — the passage that actually does " +
        "the supporting or the contradicting. Copy it; do not paraphrase, tidy or re-punctuate. " +
        "Use '...' only to elide the middle of a long passage.",
    ),
  why: z.string().describe("One sentence: what this passage settles about the claim."),
});

const AdjudicationSchema = z.object({
  verdicts: z
    .array(
      z.object({
        claimId: z.string().describe("The id of the claim this verdict is for, e.g. 'c3'."),
        verdict: z
          .enum(["supported", "contradicted", "silent"])
          .describe(
            "'supported' = the corpus shows it happening and you can quote it. 'contradicted' = " +
              "the corpus shows something incompatible with the claim as written and you can " +
              "quote it. 'silent' = anything else, including 'I could argue for it'.",
          ),
        observation: z
          .string()
          .describe(
            "What the traces show, naming who and when. One or two sentences. Describes the " +
              "company's own material and never passes judgement on the document. Empty string " +
              "when the verdict is 'silent'.",
          ),
        blindSpot: z
          .string()
          .describe(
            "For 'silent' only: one short line on where this would have shown up if it were " +
              "happening — the channel, the board, the kind of document. Empty string otherwise.",
          ),
        evidence: z
          .array(EvidenceSchema)
          .describe(
            "One or two citations for 'supported' and 'contradicted'; two from different " +
              "artifacts where the corpus offers them. Empty array for 'silent'.",
          ),
      }),
    )
    .describe("Exactly one verdict per claim you were given, in the same order."),
});

/* ═════════════════════════════════════════════════════════════ the check ══ */

/**
 * Break the posting into claims, then check each one against the corpus.
 *
 * Two calls, in order, because the first must not see the corpus (see
 * `EXTRACT_SYSTEM`). The second carries the whole corpus behind a cache
 * breakpoint exactly as `derive.ts` does — `renderCorpus` is imported rather
 * than re-implemented so the block is byte-identical to the one every other
 * step of the agent sends, and successive postings checked against the same
 * company read the cache instead of rewriting it.
 */
export async function checkJobDescription(
  company: Company,
  jobDescription: string,
): Promise<JdCheck> {
  const jd = jobDescription.trim();

  const extracted = await generate({
    system: EXTRACT_SYSTEM,
    user: [
      `Break this job posting into separately checkable claims about the work.`,
      ``,
      `<job_posting>`,
      jd,
      `</job_posting>`,
    ].join("\n"),
    schema: ExtractedClaimsSchema,
    label: `extract claims from a job description for ${company.name}`,
    // The output is a list of short pairs. Generous, but nowhere near the
    // corpus-sized generations elsewhere in the agent.
    maxTokens: 8000,
  });

  // Gate 2 runs BEFORE the expensive call: a claim that is not in the pasted
  // document is not a claim, and there is no reason to pay to adjudicate it.
  const { claims, invented } = acceptClaims(extracted.claims, jd);

  if (claims.length === 0) {
    return emptyCheck(company, invented);
  }

  const adjudicated = await generate({
    system: ADJUDICATE_SYSTEM,
    corpus: renderCorpus(company),
    user: buildAdjudicationPrompt(company, claims),
    schema: AdjudicationSchema,
    label: `check ${claims.length} job-description claims against ${company.name}`,
    // Up to 24 claims, each with an observation and two quotes. Deliberately
    // roomy: structured output that runs out of tokens comes back unparseable,
    // and losing the whole run to a cap is a far worse failure than a slightly
    // larger bill.
    maxTokens: 24000,
  });

  return buildCheck(company, claims, adjudicated.verdicts, invented);
}

/* ═════════════════════════════════════════════════════════════ the gates ══ */

type AcceptedClaim = { id: string; quote: string; proposition: string };

/**
 * Gate 2 — the claim has to actually be in the document.
 *
 * This runs the model's quote through `groundEvidence` itself, against a
 * one-artifact corpus containing the pasted text. Reusing the real verifier
 * rather than writing a second string comparison here is not tidiness: it is the
 * same normalisation (whitespace, case, the curly quotes and en-dashes a model
 * silently substitutes), the same 12-character floor, and the same refusal to
 * stitch two halves of a document into a sentence nobody wrote. A looser
 * second implementation is how a claim the posting never made ends up on screen
 * marked "contradicted", which is the worst output this feature can produce.
 */
export function acceptClaims(
  raw: { quote: string; proposition: string }[],
  jobDescription: string,
): { claims: AcceptedClaim[]; invented: number } {
  const document = jdAsCorpus(jobDescription);
  const claims: AcceptedClaim[] = [];
  const seen = new Set<string>();
  let invented = 0;

  for (const item of raw) {
    const quote = item.quote.trim();
    const proposition = item.proposition.trim();
    if (!quote || !proposition) {
      invented += 1;
      continue;
    }

    const verified = groundEvidence(
      [{ artifactId: JD_ARTIFACT_ID, quote, why: proposition }],
      document,
    );
    if (verified.length === 0) {
      invented += 1;
      continue;
    }

    // The same line pulled out twice under two paraphrases is one claim, and
    // counting it twice quietly inflates every number in the summary.
    const key = normaliseKey(quote);
    if (seen.has(key)) continue;
    seen.add(key);

    claims.push({ id: `c${claims.length + 1}`, quote, proposition });
    if (claims.length >= MAX_CLAIMS) break;
  }

  return { claims, invented };
}

/**
 * Gates 3-6, applied to the model's verdicts. Exported so the gates can be
 * exercised from a harness without spending a model call.
 */
export function buildCheck(
  company: Company,
  claims: AcceptedClaim[],
  raw: z.infer<typeof AdjudicationSchema>["verdicts"],
  invented = 0,
): JdCheck {
  const byId = new Map(raw.map((v) => [v.claimId.trim(), v]));
  const out: JdClaim[] = [];
  let downgraded = 0;
  let droppedCitations = 0;

  for (const claim of claims) {
    const verdict = byId.get(claim.id);

    // A claim the model simply did not answer for is silent. Not an error, and
    // certainly not an excuse to drop the claim from the denominator.
    if (!verdict) {
      out.push({ ...claim, verdict: "silent", observation: "", evidence: [] });
      continue;
    }

    const observation = verdict.observation.trim();
    const blindSpot = verdict.blindSpot.trim();

    // Gate 3. The enum is enforced by the schema; this is the belt to its
    // braces, and it is where an unanswerable verdict lands.
    if (verdict.verdict === "silent") {
      out.push({
        ...claim,
        verdict: "silent",
        observation: "",
        blindSpot: blindSpot || undefined,
        evidence: [],
      });
      continue;
    }

    // Gate 4. The same verifier the role derivation uses, with no relaxation.
    // A verdict is worth exactly as much as the sentences it can point at.
    const grounding = groundingReport(verdict.evidence, company);
    droppedCitations += grounding.droppedCount;

    if (grounding.keptCount === 0 || observation.length === 0) {
      downgraded += 1;
      out.push({
        ...claim,
        verdict: "silent",
        observation: "",
        blindSpot: blindSpot || undefined,
        evidence: [],
      });
      continue;
    }

    // Gate 5, fail closed. We do not rewrite a verdict on the document into an
    // acceptable sentence — silently editing it is how the rule stops meaning
    // anything, and the model has already shown it was reasoning about the
    // document rather than reading the corpus.
    const judged = findDocumentVerdict(`${observation} ${blindSpot}`);
    if (judged) {
      console.warn(`[jd] downgraded a verdict that judged the document: "${judged}"`);
      downgraded += 1;
      out.push({ ...claim, verdict: "silent", observation: "", evidence: [] });
      continue;
    }

    // Gate 6, fail closed. Narrower than the drift detector's use of the same
    // list, deliberately: this feature is about a role, so words like
    // "performance" and "score" legitimately describe eval numbers in the
    // corpus. What must never appear is assessment vocabulary attached to a
    // named colleague.
    const assessed = assessmentOfAPerson(observation, company);
    if (assessed) {
      console.warn(`[jd] downgraded a verdict assessing a person: "${assessed}"`);
      downgraded += 1;
      out.push({ ...claim, verdict: "silent", observation: "", evidence: [] });
      continue;
    }

    out.push({
      ...claim,
      verdict: verdict.verdict,
      observation,
      evidence: grounding.kept,
    });
  }

  return {
    companySlug: company.slug,
    companyName: company.name,
    claims: out,
    summary: {
      total: out.length,
      supported: out.filter((c) => c.verdict === "supported").length,
      contradicted: out.filter((c) => c.verdict === "contradicted").length,
      silent: out.filter((c) => c.verdict === "silent").length,
      downgraded,
      inventedClaims: invented,
      droppedCitations,
    },
    coverage: corpusCoverage(company),
    sources: sourcesFor(company, out),
    generatedAt: new Date().toISOString(),
  };
}

/* ═══════════════════════════════════════════════════════════════ guards ══ */

/**
 * Vocabulary that passes judgement on the pasted document rather than reporting
 * the corpus.
 *
 * Referring to the posting neutrally is fine and often the clearest phrasing —
 * "the posting says X; on 18 August two directors disagreed about exactly that".
 * What is banned is the conclusion: we are not entitled to tell somebody their
 * own job ad is wrong. We have three weeks of one company's messages. We can
 * show them the gap; the verdict on the document is theirs.
 */
const DOCUMENT_VERDICT: readonly RegExp[] = [
  /\b(?:job\s+description|job\s+posting|posting|listing|advert(?:isement)?|the\s+jd)\b[^.!?;]{0,70}?\b(?:is|are|was|were|isn'?t|aren'?t|seems|appears|reads\s+as)\b[^.!?;]{0,50}?\b(?:wrong|incorrect|inaccurate|false|misleading|mistaken|untrue|outdated|out\s+of\s+date|overstated|oversold|inflated|aspirational|wishful|fiction|fictional|optimistic)\b/i,
  /\b(?:contradicts|contradicting|disproves|refutes|debunks|undermines)\s+the\s+(?:job\s+description|job\s+posting|posting|listing|advert(?:isement)?|jd)\b/i,
  /\bthe\s+(?:job\s+description|job\s+posting|posting|listing|jd)\s+(?:overclaims|overstates|oversells|misrepresents|pretends|exaggerates|gets\s+this\s+wrong)\b/i,
  /\bthis\s+(?:claim|line|bullet)\s+is\s+(?:wrong|false|inaccurate|incorrect|untrue)\b/i,
];

/** The first document-judging phrase found, or `null`. Exported for the harness. */
export function findDocumentVerdict(text: string): string | null {
  for (const pattern of DOCUMENT_VERDICT) {
    const hit = pattern.exec(text);
    if (hit) return hit[0];
  }
  return null;
}

/**
 * Assessment vocabulary aimed at somebody on the roster.
 *
 * `findAssessmentLanguage` alone is too broad here: this corpus is full of
 * recall, precision and eval scores, and a verdict that legitimately quotes
 * "0.94 recall" should not be thrown away. Requiring a roster name in the same
 * sentence narrows it to the thing the product actually bans — ranking a person
 * — while still reusing the one shared pattern list rather than forking it.
 */
export function assessmentOfAPerson(text: string, company: Company): string | null {
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const phrase = findAssessmentLanguage(sentence);
    if (!phrase) continue;
    const named = company.people.some((p) => mentionsPerson(sentence, p.name));
    if (named) return phrase;
  }
  return null;
}

function mentionsPerson(sentence: string, name: string): boolean {
  const haystack = sentence.toLowerCase();
  // Full name, or the given name on its own — "Marta is underperforming" is the
  // sentence we are guarding against, and it never uses the surname.
  if (haystack.includes(name.toLowerCase())) return true;
  const first = name.trim().split(/\s+/)[0]?.toLowerCase();
  return Boolean(first && first.length >= 3 && new RegExp(`\\b${escapeRe(first)}\\b`).test(haystack));
}

function escapeRe(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ═══════════════════════════════════════════════════════════════ pieces ══ */

const JD_ARTIFACT_ID = "pasted-job-description";

/**
 * The pasted document, wrapped as a one-artifact `Company` so `groundEvidence`
 * can verify claim quotes against it. It never touches a real corpus and never
 * leaves this module.
 */
function jdAsCorpus(jobDescription: string): Company {
  return {
    slug: "__pasted-job-description__",
    name: "The pasted job description",
    description: "",
    people: [],
    artifacts: [
      {
        id: JD_ARTIFACT_ID,
        kind: "doc",
        author: "the posting",
        // Fixed, not `new Date()`: nothing here is time-varying, and a stable
        // string is one less thing that can quietly differ between two runs.
        timestamp: "1970-01-01T00:00:00.000Z",
        text: jobDescription,
      },
    ],
  };
}

/**
 * What we could actually see. Computed from the corpus rather than described by
 * the model, because "we tell you what we can't see" is only worth saying if
 * the saying of it cannot itself be hallucinated.
 */
export function corpusCoverage(company: Company): JdCoverage {
  const timestamps = company.artifacts
    .map((a) => a.timestamp)
    .filter(Boolean)
    .sort();

  return {
    artifacts: company.artifacts.length,
    people: company.people.length,
    channels: [...new Set(company.artifacts.map((a) => a.channel).filter(Boolean))] as string[],
    kinds: [...new Set(company.artifacts.map((a) => a.kind))],
    from: timestamps[0]?.slice(0, 10) ?? "",
    to: timestamps[timestamps.length - 1]?.slice(0, 10) ?? "",
  };
}

function sourcesFor(company: Company, claims: JdClaim[]): JdCheck["sources"] {
  const cited = new Set(claims.flatMap((c) => c.evidence.map((e) => e.artifactId)));
  const out: JdCheck["sources"] = {};
  for (const a of company.artifacts) {
    if (!cited.has(a.id)) continue;
    out[a.id] = {
      id: a.id,
      kind: a.kind,
      author: a.author,
      timestamp: a.timestamp,
      channel: a.channel,
      title: a.title,
    };
  }
  return out;
}

/**
 * The volatile tail: the claim list and nothing else.
 *
 * Everything expensive — the system prompt and the whole corpus — sits in front
 * of the cache breakpoints, so a second posting checked against the same company
 * pays for this block alone.
 */
function buildAdjudicationPrompt(company: Company, claims: AcceptedClaim[]): string {
  const list = claims
    .map(
      (c) =>
        [
          `<claim id="${c.id}">`,
          `posting says (verbatim): ${c.quote}`,
          `claim to check: ${c.proposition}`,
          `</claim>`,
        ].join("\n"),
    )
    .join("\n\n");

  return [
    `A job posting for a role at ${company.name} makes the claims below. For each one, return a verdict against the corpus you were given, with verbatim citations.`,
    ``,
    `Return exactly ${claims.length} verdict${claims.length === 1 ? "" : "s"}, one per claim id.`,
    ``,
    `<claims count="${claims.length}">`,
    list,
    `</claims>`,
  ].join("\n");
}

function emptyCheck(company: Company, invented: number): JdCheck {
  return {
    companySlug: company.slug,
    companyName: company.name,
    claims: [],
    summary: {
      total: 0,
      supported: 0,
      contradicted: 0,
      silent: 0,
      downgraded: 0,
      inventedClaims: invented,
      droppedCitations: 0,
    },
    coverage: corpusCoverage(company),
    sources: {},
    generatedAt: new Date().toISOString(),
  };
}

function normaliseKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
