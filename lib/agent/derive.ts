/**
 * Role derivation: reconstructing a job from the evidence of it being done.
 *
 * The premise of the product is that at a company growing this fast, most new
 * roles have never existed before. There is no predecessor, no handover doc, no
 * job description worth the name. Retrieval can't help — the answer was never
 * written down. So the role has to be *inferred* from the residue the team
 * leaves behind: the threads they argue in, the tickets they file, the meetings
 * they take.
 *
 * That inference is the one thing here a human genuinely cannot do at speed,
 * and it is why this is an agent and not a search box.
 */

import { z } from "zod/v4";
import { generate } from "@/lib/anthropic";
import { groundingReport, type GroundingReport } from "@/lib/agent/ground";
import type { Company, DerivedRole } from "@/lib/types";

const EvidenceSchema = z.object({
  artifactId: z
    .string()
    .describe("The exact id of the artifact this quote comes from, copied character for character."),
  quote: z
    .string()
    .describe(
      "A verbatim, contiguous substring of that artifact's text. Copy it; do not paraphrase, " +
        "tidy, or re-punctuate it. Use '...' if you need to elide the middle of a long passage.",
    ),
  why: z.string().describe("One sentence: what this passage tells us about the role."),
});

const DerivedRoleSchema = z.object({
  summary: z
    .string()
    .describe("Two or three sentences on what this role actually is at this company, specifically."),
  evidence: z
    .array(EvidenceSchema)
    .describe("Between four and eight citations, drawn from different artifacts where possible."),
  responsibilities: z
    .array(z.string())
    .describe("What this person will own. Each one must be traceable to something in the corpus."),
  firstWeekOutcomes: z
    .array(z.string())
    .describe("What 'ramped' looks like as outcomes the team would notice — not things to read."),
  keyPeople: z
    .array(
      z.object({
        name: z.string().describe("Exact name from the people roster."),
        why: z.string().describe("What this new hire will specifically need them for."),
      }),
    )
    .describe("Three to five people from the roster, chosen from what they own and what they say."),
  openQuestions: z
    .array(z.string())
    .describe(
      "Things the corpus genuinely does not settle. Never empty — if you think it is, you have " +
        "stopped reading critically.",
    ),
});

const SYSTEM = `You reconstruct a role from evidence that the role is already being done, badly and by the wrong people.

You are given the complete internal corpus of a fast-growing company: Slack threads, docs, tickets, meeting notes. You are given a role title someone has decided to hire for. Nobody has written a job description, because this role has never existed here before. Your job is to work out what it actually is.

HOW TO WORK

Read the corpus for pressure, not for keywords. A role exists where work is spilling: a thread where three people argue about who owns something, a ticket that keeps getting reassigned, a doc that says "we should really have someone for this", a customer request nobody has capacity for. Those are the load-bearing signals. A message that merely contains the role title usually is not.

Attach the role to what the company is specifically doing. "Works with customers" is true of every company on earth and therefore tells the reader nothing. If the corpus shows a named customer, a named workflow, a named system, say that instead.

EVIDENCE IS NOT DECORATION

Every citation must be a verbatim contiguous substring of the artifact you attribute it to. Copy the characters. Do not fix the typo, do not expand the abbreviation, do not merge two messages, do not re-punctuate. If you are recalling a quote rather than copying one, you are inventing it.

A downstream check verifies every quote against the real artifact text and silently discards any that does not match. Inventing a quote does not get it past the check; it just costs you the claim it was supporting. Four real citations beat eight where one is fabricated.

WHAT NOT TO PRODUCE

Do not write a job description. Job descriptions are a genre with its own gravity — "cross-functional", "fast-paced", "strong communicator", "wear many hats" — and every sentence you spend in that genre is a sentence that would be equally true of a company you have never heard of. If a line you wrote would survive a find-and-replace of the company name, delete it.

Do not smooth over disagreement. If two people in the corpus clearly disagree about what this role owns, that disagreement IS the finding. Put it in openQuestions and name both positions.

OPEN QUESTIONS ARE A DELIVERABLE

openQuestions must not be empty, and must not be padded with generic unknowns ("what are the OKRs?"). List the specific things a competent reader of this corpus would still not know: which of two teams this person reports into, whether they own the thing end to end or hand it off, whether the tooling decision from three weeks ago is settled. "The company has not decided this yet" is a genuinely useful answer to give a hiring manager, and a far better one than a confident guess. Inventing an answer here is actively harmful: it tells them a decision has been made that has not.`;

/**
 * Derive the role, then verify every citation before anyone sees it.
 *
 * Grounding happens inside this function rather than being left to the caller,
 * deliberately. If verification were the caller's job, then the moment someone
 * wires up a second surface — a script, a preview page, a demo shortcut — the
 * unverified output escapes. There is one exit from this module and it is
 * checked.
 */
export async function deriveRole(company: Company, roleTitle: string): Promise<DerivedRole> {
  return (await deriveRoleWithGrounding(company, roleTitle)).role;
}

export type DeriveResult = { role: DerivedRole; grounding: GroundingReport };

/** Same derivation, but also hands back what the verification pass threw out. */
export async function deriveRoleWithGrounding(
  company: Company,
  roleTitle: string,
): Promise<DeriveResult> {
  const raw = await generate({
    system: SYSTEM,
    corpus: renderCorpus(company),
    user: `The role being hired for is: ${roleTitle}\n\nReconstruct what this role actually is at ${company.name}, citing artifact ids and verbatim quotes.`,
    schema: DerivedRoleSchema,
    label: `derive role "${roleTitle}" at ${company.name}`,
  });

  const grounding = groundingReport(raw.evidence, company);

  return {
    role: {
      title: roleTitle,
      summary: raw.summary,
      evidence: grounding.kept,
      responsibilities: raw.responsibilities,
      firstWeekOutcomes: raw.firstWeekOutcomes,
      keyPeople: raw.keyPeople.filter((p) => knownPerson(company, p.name)),
      openQuestions: raw.openQuestions,
    },
    grounding,
  };
}

function knownPerson(company: Company, name: string): boolean {
  const wanted = name.trim().toLowerCase();
  return company.people.some((p) => p.name.trim().toLowerCase() === wanted);
}

/**
 * The whole corpus, verbatim, in one block.
 *
 * No pre-filtering and no embedding search. The corpus for one company is a few
 * thousand tokens, and the signal we need — three people talking past each
 * other across two channels a week apart — is precisely the signal a top-k
 * retriever destroys, because no single chunk of it looks relevant on its own.
 * Chunking here would be optimising away the only hard part of the problem.
 *
 * Byte-stability is a requirement, not a nicety: this string is the cached
 * prompt prefix for every step of the agent, so the artifact order is sorted
 * rather than incidental and nothing time-varying is interpolated into it. One
 * `new Date()` in here and the cache silently never hits again.
 */
export function renderCorpus(company: Company): string {
  const artifacts = [...company.artifacts]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map(renderArtifact)
    .join("\n\n");

  const roster = company.people
    .map(
      (p) =>
        `- ${p.name} (${p.slackHandle}) — ${p.role}, ${p.team}. Go-to for: ${p.owns.join("; ") || "unspecified"}`,
    )
    .join("\n");

  return [
    `<company name="${company.name}" slug="${company.slug}">`,
    company.description,
    `</company>`,
    ``,
    `<people>`,
    roster,
    `</people>`,
    ``,
    `<corpus count="${company.artifacts.length}">`,
    artifacts,
    `</corpus>`,
  ].join("\n");
}

function renderArtifact(a: {
  id: string;
  kind: string;
  channel?: string;
  author: string;
  authorRole?: string;
  timestamp: string;
  title?: string;
  text: string;
}): string {
  const attrs = [
    `id="${a.id}"`,
    `kind="${a.kind}"`,
    a.channel ? `channel="${a.channel}"` : null,
    `author="${a.author}"`,
    a.authorRole ? `authorRole="${a.authorRole}"` : null,
    `at="${a.timestamp}"`,
    a.title ? `title="${a.title}"` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return `<artifact ${attrs}>\n${a.text}\n</artifact>`;
}
