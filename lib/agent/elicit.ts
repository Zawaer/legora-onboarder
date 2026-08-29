/**
 * Knowledge elicitation: the part that turns the agent from a retriever into
 * something that compounds.
 *
 * ── THE PROBLEM THIS EXISTS TO FIX ───────────────────────────────────────────
 *
 * `supervise.ts` does the honest thing when the corpus is silent: it says so and
 * raises a blocker. That is correct and it is inert. The answer still is not
 * written down, the manager unblocks one person in a DM, and the next hire walks
 * into the identical wall six weeks later. Every escalation is a fact the
 * company knows and cannot retrieve.
 *
 * This module closes that loop. It writes the request that goes to the person
 * who would know, and it drafts the understanding back to them for correction.
 * `knowledge.ts` does the persisting; this file does the asking, because how you
 * ask is the entire ballgame.
 *
 * ── WHY THE QUESTIONS LOOK LIKE THIS, AND WHY YOU MUST NOT "SIMPLIFY" THEM ───
 *
 * The obvious implementation is to message the expert "how do you handle X?" or
 * "can you describe your process for X?". That implementation does not work, and
 * it does not work for a reason that is well established rather than a matter of
 * taste.
 *
 * Expertise is largely automatic and compiled. Experts have poor introspective
 * access to the cues they are actually reading, so a request for a *process*
 * gets you a reconstruction — a tidy, plausible, sanitised account of what a
 * competent person would presumably do, stripped of exactly the perceptual
 * detail a novice needs. You get the textbook back. The textbook is not what is
 * missing.
 *
 * So every probe here is anchored to a *specific past incident*. These are the
 * ACTA (Applied Cognitive Task Analysis) Knowledge Audit probes — Militello &
 * Hutton's six categories: noticing, past & future, the big picture, job smarts,
 * improvising, and self-monitoring. Each one asks about one time something
 * happened, not about how things are done.
 *
 * The follow-up chain is fixed and ordered, and the order matters:
 *
 *   1. "Can you give a specific example?"          — force an actual incident
 *   2. "What were the cues and strategies?"        — recover the perceptual detail
 *   3. "Why would this be difficult for someone
 *       new? What mistake would they make?"        — the highest-yield question
 *
 * Number three is the one that produces failure modes, and failure modes are
 * what a new hire actually needs. "Read the twelve documents first" is worth
 * more on day two than any description of a workflow. It is therefore in the
 * body of every request, not held back as an optional follow-up.
 *
 * ── NARRATION, NOT JUSTIFICATION ─────────────────────────────────────────────
 *
 * Every request explicitly asks for what happened, in sequence, and explicitly
 * says not to explain why it was right. Describing what you did is non-reactive;
 * being asked to explain *why* changes what people report — they optimise the
 * account for defensibility and the operational detail falls out. This is a
 * single sentence in the prompt and it is load-bearing. Do not delete it to save
 * a line.
 *
 * ── THE BUDGET ───────────────────────────────────────────────────────────────
 *
 * Under a minute of the expert's time, end to end, including the teachback. Past
 * that, experts stop replying, and a knowledge capture loop nobody replies to is
 * worse than none at all, because the hire is now waiting on something that will
 * never arrive. Two probes, one follow-up, one line to correct. That is the
 * whole ask, and every addition to it has to buy its way in.
 *
 * ── NO MODEL CALL IS REQUIRED TO ASK ─────────────────────────────────────────
 *
 * Request construction below is entirely deterministic. The probes are a fixed,
 * auditable set, selection is a function of the question's shape, and the anchor
 * is a verbatim quote from the corpus. That means the text that goes to a real
 * expert cannot be hallucinated, is instant, and can be read in review. Only the
 * teachback draft — which is a comprehension task — asks the model, and it falls
 * back to an extractive draft if the model is unavailable.
 */

import { z } from "zod/v4";
import { generate } from "@/lib/anthropic";
import {
  SIGNAL_WEIGHT,
  mentionsTopic,
  recencyWeight,
  topicTerms,
  type ExpertEvidence,
  type ExpertSignal,
  type RankExperts,
  type RankedExpert,
} from "@/lib/agent/experts";
import type { Artifact, Company, Person } from "@/lib/types";

/* ════════════════════════════════════════════════════ finding the expert ══ */

/**
 * `lib/agent/experts.ts` is the contract and `experts.impl.ts` is the
 * implementation, owned by another module and imported here through the shared
 * `RankExperts` type — so this file depends on the contract, never on the
 * internals.
 *
 * `setExpertRanker` exists so the ranker can also be replaced at runtime (a
 * test, or a future per-company strategy) without this module knowing about it.
 *
 * `rankExpertsFallback` below stays regardless, and it is not dead code: it runs
 * when the real ranker returns nobody or throws. Routing is the one part of this
 * feature with no graceful degradation — if we cannot name a person we cannot
 * ask anyone anything — so it gets a second implementation rather than a
 * try/catch that gives up.
 */
let injectedRanker: RankExperts | null = null;

export function setExpertRanker(rank: RankExperts | null): void {
  injectedRanker = rank;
}

export function activeRanker(): { rank: RankExperts; source: "injected" | "fallback" } {
  return injectedRanker
    ? { rank: injectedRanker, source: "injected" }
    : { rank: rankExpertsFallback, source: "fallback" };
}

/** Run the primary ranker, and fall back rather than returning nobody. */
function rankWithFallback(
  company: Company,
  topic: string,
  opts: { limit?: number; now?: Date; exclude?: string[] },
): { ranked: RankedExpert[]; source: "primary" | "fallback" } {
  const { rank, source } = activeRanker();
  try {
    const ranked = rank(company, topic, opts);
    if (ranked.length > 0) return { ranked, source: source === "injected" ? "primary" : "fallback" };
  } catch (err) {
    console.warn(`[elicit] expert ranker threw, falling back: ${(err as Error).message}`);
  }
  if (rank === rankExpertsFallback) return { ranked: [], source: "fallback" };
  return { ranked: rankExpertsFallback(company, topic, opts), source: "fallback" };
}

/**
 * A message someone is asking rather than telling.
 *
 * Restricted to Slack and tickets on purpose. Docs and meeting notes are full of
 * question marks — agendas, open items, headings — and treating those as
 * questions hands a `named` signal (the heaviest one there is) to every person
 * mentioned anywhere in a long document.
 *
 * That is not hypothetical: the artifacts this feature *writes* carry the hire's
 * original question in their first line, so before this restriction existed a
 * captured answer made everyone it mentioned an "expert" on whatever it was
 * about. The feature was poisoning its own routing, one capture at a time.
 */
function isQuestionShaped(artifact: Artifact): boolean {
  if (artifact.kind !== "slack" && artifact.kind !== "ticket") return false;
  const t = artifact.text.toLowerCase();
  return (
    t.includes("?") ||
    /\b(who owns|anyone know|does anyone|any idea|not sure who|who should|where do i|how do i)\b/.test(
      t,
    )
  );
}

/** Someone settling a question rather than adding to it. */
const DECISION_RE =
  /\b(we'?ll|we will|let'?s|i'?ll take|i'?ll own|decided|decision|going with|from now on|the rule is|policy is|do not|don'?t|always|never|i own|that'?s mine|my call)\b/i;

/** First name, lowercased. Cheap and good enough on a company roster. */
function firstNameOf(person: Person): string {
  return person.name.trim().split(/\s+/)[0].toLowerCase();
}

/** Does this artifact name that person — by handle or by first name? */
function namesPerson(artifact: Artifact, person: Person): boolean {
  const t = ` ${artifact.text.toLowerCase()} `;
  const handle = person.slackHandle.toLowerCase();
  if (handle.length > 1 && t.includes(handle)) return true;
  const first = firstNameOf(person);
  return first.length > 2 && new RegExp(`\\b${first}\\b`).test(t);
}

/** Trim a quote to something a human reads at a glance, on a word boundary. */
export function trimQuote(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const boundary = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(", "), cut.lastIndexOf(" "));
  return `${cut.slice(0, boundary > 60 ? boundary : max).trim()}…`;
}

/** "24 Aug" — short, stable, no locale surprises between server and client. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Everything searchable about one artifact, lowercased once. */
function haystack(artifact: Artifact): string {
  return `${artifact.title ?? ""} ${artifact.text}`.toLowerCase();
}

/**
 * Throw away the topic words that match everything.
 *
 * `topicTerms` already drops stopwords, but the words that actually ruin a
 * ranking here are domain-common rather than English-common: at a legal-tech
 * company "client", "extraction" and "workflow" appear in half the corpus, so a
 * question containing one of them makes every artifact "relevant" and the
 * ranking degenerates into electing whoever posts most — which is the exact bug
 * the signal weighting was written to avoid, arriving through the back door.
 *
 * So terms are kept in inverse document frequency order and anything appearing
 * in more than a third of the corpus is dropped. If that leaves nothing, the
 * three rarest are kept anyway: a blunt topic is better than no topic.
 */
type TopicIndex = { terms: string[]; df: Map<string, number> };

function topicIndex(company: Company, terms: string[]): TopicIndex {
  const df = new Map<string, number>();
  if (terms.length === 0) return { terms: [], df };

  const docs = company.artifacts.map(haystack);
  const n = Math.max(docs.length, 1);
  for (const t of terms) df.set(t, docs.reduce((c, d) => c + (d.includes(t) ? 1 : 0), 0));

  const present = terms.filter((t) => (df.get(t) ?? 0) > 0);
  const rare = present.filter((t) => (df.get(t) as number) <= Math.max(3, Math.floor(n / 3)));
  const ordered = (rare.length ? rare : present).sort(
    (a, b) => (df.get(a) as number) - (df.get(b) as number),
  );
  return { terms: rare.length ? ordered : ordered.slice(0, 3), df };
}

function distinctiveTerms(company: Company, terms: string[]): string[] {
  return topicIndex(company, terms).terms;
}

/** Which distinct topic terms this artifact actually contains. */
function hitTerms(artifact: Artifact, terms: string[]): string[] {
  const hay = haystack(artifact);
  return terms.filter((t) => hay.includes(t));
}

function hitCount(artifact: Artifact, terms: string[]): number {
  return hitTerms(artifact, terms).length;
}

/**
 * Is this artifact really about the topic, or does it just happen to contain one
 * ordinary word?
 *
 * This threshold is the difference between honest routing and confident
 * nonsense. Asked "what is the descaling schedule for the coffee machine in the
 * Reykjavik office", a one-word match on "office" or "schedule" is enough to
 * make a dozen artifacts look relevant and elect a senior engineer who has never
 * thought about a coffee machine — which is precisely the fabrication the
 * feature is supposed to refuse.
 *
 * So two terms, always — unless the topic itself is only one or two words wide,
 * where one hit is all there is to have.
 */
function isAboutTopic(artifact: Artifact, index: TopicIndex): boolean {
  const hits = hitTerms(artifact, index.terms).length;
  return index.terms.length <= 2 ? hits >= 1 : hits >= 2;
}

/**
 * The local ranker. Same contract, same signals, same rule as the real one:
 * **nobody is returned without evidence.** An unevidenced routing suggestion
 * costs a new hire a wasted interruption and the confidence to ask again, which
 * is a worse outcome than "we could not work out who knows this".
 *
 * The bug it is written against: counting messages elects the chattiest person
 * in the channel. Authority is answering-shaped, not talking-shaped, so a reply
 * to somebody else's question outweighs four messages of your own.
 */
export const rankExpertsFallback: RankExperts = (company, topic, opts = {}) => {
  const limit = opts.limit ?? 3;
  const now = opts.now ?? new Date();
  const exclude = new Set((opts.exclude ?? []).map((n) => n.trim().toLowerCase()));

  const index = topicIndex(company, topicTerms(topic));
  const terms = index.terms;
  if (terms.length === 0) return [];

  // `mentionsTopic` is the shared helper and it is deliberately permissive — one
  // term is a mention. That is the right contract for a filter and the wrong one
  // for a ranking, so the density test runs on top of it.
  const relevant = company.artifacts.filter(
    (a) => mentionsTopic(a, terms) && isAboutTopic(a, index),
  );
  if (relevant.length === 0) return [];

  const byName = new Map<string, Person>(
    company.people.map((p) => [p.name.trim().toLowerCase(), p]),
  );

  type Acc = {
    person: Person;
    score: number;
    evidence: ExpertEvidence[];
    counts: Record<ExpertSignal, number>;
    latest: string;
    /** Term hits on their single most on-topic artifact. */
    peak: number;
  };
  const acc = new Map<string, Acc>();

  const bump = (person: Person, artifact: Artifact, signal: ExpertSignal, hits: number) => {
    const key = person.name.trim().toLowerCase();
    if (exclude.has(key)) return;
    const row =
      acc.get(key) ??
      ({
        person,
        score: 0,
        evidence: [],
        counts: { answered: 0, named: 0, decided: 0, mentioned: 0 },
        latest: "",
        peak: 0,
      } satisfies Acc);

    if (hits > row.peak) row.peak = hits;

    // An artifact that touches three of the topic's distinctive words is worth
    // more than one that brushes a single word in passing, but not linearly —
    // otherwise one long document outweighs three people answering questions.
    const density = 1 + 0.4 * (Math.min(hits, 4) - 1);
    row.score += SIGNAL_WEIGHT[signal] * recencyWeight(artifact.timestamp, now) * density;
    row.counts[signal] += 1;
    if (artifact.timestamp > row.latest) row.latest = artifact.timestamp;
    // One line per artifact per person: the strongest signal wins, so a reply
    // that is also a decision is not double-quoted back at the reader.
    if (!row.evidence.some((e) => e.artifactId === artifact.id)) {
      row.evidence.push({
        artifactId: artifact.id,
        quote: trimQuote(artifact.text, 200),
        channel: artifact.channel,
        timestamp: artifact.timestamp,
        signal,
      });
    }
    acc.set(key, row);
  };

  // Questions, indexed by channel, so "answered" means "replied to somebody
  // else's question in the same place within a few days" rather than "posted".
  const questions = relevant.filter(isQuestionShaped);

  for (const artifact of relevant) {
    const author = byName.get(artifact.author.trim().toLowerCase());
    const hits = hitCount(artifact, terms);

    if (author) {
      const asking = isQuestionShaped(artifact);
      const answeredSomething =
        !asking &&
        questions.some(
          (q) =>
            q.id !== artifact.id &&
            q.author.trim().toLowerCase() !== artifact.author.trim().toLowerCase() &&
            (q.channel ?? "") === (artifact.channel ?? "") &&
            q.timestamp <= artifact.timestamp &&
            Date.parse(artifact.timestamp) - Date.parse(q.timestamp) < 3 * 86_400_000,
        );

      if (answeredSomething) bump(author, artifact, "answered", hits);
      else if (!asking && DECISION_RE.test(artifact.text)) bump(author, artifact, "decided", hits);
      else if (!asking) bump(author, artifact, "mentioned", hits);
    }

    // Being named inside somebody else's question is the strongest routing
    // signal there is: the team already knows where to send this.
    if (isQuestionShaped(artifact)) {
      for (const person of company.people) {
        if (person.name.trim().toLowerCase() === artifact.author.trim().toLowerCase()) continue;
        if (namesPerson(artifact, person)) bump(person, artifact, "named", hits);
      }
    }
  }

  const ranked: RankedExpert[] = [...acc.values()]
    .filter((row) => row.evidence.length > 0 && row.score > 0)
    // Weakest signal, never sufficient alone: being merely present in a topic
    // is not knowing it.
    .filter((row) => row.counts.answered + row.counts.named + row.counts.decided > 0)
    // And one coincidence is not a pattern. Either they turned up on this topic
    // more than once, or the single artifact they turned up in is squarely about
    // it. Without this, any question sharing two ordinary words with one message
    // elects whoever happened to write that message — with a citation, which
    // makes the wrong answer *more* convincing rather than less.
    .filter((row) => row.evidence.length >= 2 || row.peak >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => ({
      person: row.person,
      score: Number(row.score.toFixed(3)),
      // Strongest signals first, so the line a human reads is the convincing one.
      evidence: [...row.evidence].sort(
        (a, b) => SIGNAL_WEIGHT[b.signal] - SIGNAL_WEIGHT[a.signal] || b.timestamp.localeCompare(a.timestamp),
      ),
      why: whyLine(row.counts, row.latest, row.evidence),
    }));

  return ranked;
};

function whyLine(
  counts: Record<ExpertSignal, number>,
  latest: string,
  evidence: ExpertEvidence[],
): string {
  const parts: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
  if (counts.answered) parts.push(`answered ${plural(counts.answered, "question", "questions")} about this`);
  if (counts.named) parts.push(`was named ${times(counts.named)} by someone asking`);
  if (counts.decided) parts.push(`made ${plural(counts.decided, "call", "calls")} on it`);
  const where = evidence.find((e) => e.channel)?.channel;
  const when = latest ? `, most recently ${shortDate(latest)}` : "";
  const place = where ? ` in ${where}` : "";
  return parts.length ? `${parts.join(", ")}${place}${when}.` : "";
}

/* ═══════════════════════════════════════════════════════ the expert pick ══ */

/**
 * Where captured answers live in the corpus. Defined here rather than in
 * `knowledge.ts` so this module can recognise its own output without importing
 * the store (which imports this file).
 */
export const CAPTURED_CHANNEL = "Onboarder / captured knowledge";

/** A verbatim thing this person said, used to anchor the probe to an incident. */
export type Anchor = {
  artifactId: string;
  quote: string;
  channel?: string;
  timestamp: string;
};

export type ExpertPick = {
  person: Person;
  /** One line a human can read. Never a bare score. */
  why: string;
  evidence: ExpertEvidence[];
  /**
   * `ranked` — they demonstrably worked on this in the corpus.
   * `roster` — nobody has, but they are listed as owning it. Weaker, and the
   * request says so out loud rather than pretending otherwise.
   */
  routing: "ranked" | "roster";
  /**
   * `peer` — somebody who has touched this area and is *not* the person the
   * whole company already routes to. Asked first, always.
   * `expert` — the top-ranked person. Asked only when there is no peer left.
   */
  tier: "peer" | "expert";
  anchor?: Anchor;
};

export type ExpertChoice =
  | { pick: ExpertPick; alternatives: ExpertPick[]; reason: string }
  | { pick: null; alternatives: []; reason: string };

/**
 * Who to ask — and specifically, who to ask *first*.
 *
 * ── WHY THE BEST-RANKED PERSON IS THE LAST RESORT, NOT THE FIRST ─────────────
 *
 * This is the mistake Answer Garden made in 1994 and its own author spent the
 * next two years undoing. Route newcomers' questions to the identified expert
 * and the expert drowns: in Ackerman's study they were alarmed at *two questions
 * a week*, negotiated the right to refuse, and exercised it about half the time.
 * Answer Garden 2 was rebuilt specifically to route away from experts — peers
 * and chat first, timeouts, org experts last.
 *
 * A system that finds the single most knowledgeable person and points every
 * question at them has not solved routing. It has built a queue in front of one
 * human and called it a product. So: someone who has touched the area recently
 * and is *not* the top-ranked person gets asked first. The top-ranked person is
 * where a question goes after the peers have passed on it.
 *
 * Returns `null` — with a sentence saying why — rather than picking somebody
 * plausible. Naming the wrong person with confidence is the same failure as a
 * fabricated quote: instantly checkable, wrong, and it costs us every true thing
 * on the page.
 */
export function pickExpert(
  company: Company,
  topic: string,
  opts: { now?: Date; exclude?: string[] } = {},
): ExpertChoice {
  const { ranked } = rankWithFallback(company, topic, {
    // Wider than the one name we need, because the list below the top *is* the
    // peer pool — and it is also the onward-routing queue when somebody passes.
    limit: 6,
    now: opts.now,
    exclude: opts.exclude,
  });
  const terms = distinctiveTerms(company, topicTerms(topic));

  if (ranked.length > 0) {
    const toPick = (r: RankedExpert, tier: "peer" | "expert"): ExpertPick => ({
      person: r.person,
      why: r.why,
      evidence: r.evidence,
      routing: "ranked",
      tier,
      anchor: anchorFor(company, r.person, r.evidence, terms),
    });

    const [top, ...peers] = ranked;

    if (peers.length > 0) {
      const [first, ...restPeers] = peers;
      return {
        pick: toPick(first, "peer"),
        // The queue for when somebody passes: remaining peers first, and the
        // person everyone already leans on genuinely last.
        alternatives: [...restPeers.map((p) => toPick(p, "peer")), toPick(top, "expert")],
        reason:
          `${first.person.name} has worked on this and is not the person the team already routes ` +
          `everything to — ${top.person.name} is, which is exactly why they are not being asked first.`,
      };
    }

    return {
      pick: toPick(top, "expert"),
      alternatives: [],
      reason: `${top.person.name} is the only person in the corpus who has worked on this: ${top.why}`,
    };
  }

  // Nothing behavioural. Fall back to the roster — declared ownership — and be
  // explicit that this is a weaker claim.
  const roster = rosterMatch(company, topic, opts.exclude ?? []);
  if (roster.length > 0) {
    const [first, ...rest] = roster;
    return {
      pick: first,
      alternatives: rest,
      reason:
        `Nobody has answered a question about this anywhere in the corpus. ` +
        `${first.person.name} is listed as owning it, so this is a roster match rather than an observed one.`,
    };
  }

  return {
    pick: null,
    alternatives: [],
    reason:
      `Nobody in ${company.name}'s corpus has worked on this, and nobody on the roster lists it as ` +
      `something they own. Rather than guess a name, this needs a human to say who to ask.`,
  };
}

/**
 * Words that appear in half the ownership lines at any company and therefore
 * match everybody. "Elin owns the legal engineering *team*, so ask her about the
 * offsite expense policy" is the failure this prevents.
 */
const ROSTER_STOPWORDS = new Set(["team", "work", "stuff", "things", "people", "other", "general"]);

/** Declared ownership, matched on the roster. Evidence-free by construction, hence `routing: "roster"`. */
function rosterMatch(company: Company, topic: string, exclude: string[]): ExpertPick[] {
  const terms = topicTerms(topic).filter((t) => t.length >= 5 && !ROSTER_STOPWORDS.has(t));
  if (terms.length === 0) return [];
  const skip = new Set(exclude.map((n) => n.trim().toLowerCase()));

  const scored = company.people
    .filter((p) => !skip.has(p.name.trim().toLowerCase()))
    .map((person) => {
      const owned = person.owns.map((o) => o.toLowerCase());
      const hits = person.owns.filter((o) =>
        terms.some((t) => o.toLowerCase().includes(t)),
      );
      const roleHit = terms.some(
        (t) => person.role.toLowerCase().includes(t) || person.team.toLowerCase().includes(t),
      );
      const score = hits.length * 2 + (roleHit ? 1 : 0) + (owned.length ? 0 : 0);
      return { person, hits, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return scored.map((row) => ({
    person: row.person,
    why: row.hits.length
      ? `listed on the roster as owning "${row.hits[0]}".`
      : `is the ${row.person.role} — the closest role match on the roster.`,
    evidence: [],
    routing: "roster" as const,
    // A roster match is nobody's designated expert; it is a best guess at who
    // would know. Treated as a peer ask so it carries the same easy refusal.
    tier: "peer" as const,
  }));
}

/**
 * The incident to anchor the probe to: something this person actually said about
 * the topic, **in their own words**.
 *
 * Three things it gets right that the obvious version does not:
 *
 *   • `named` evidence is excluded. That quote is a *colleague's* sentence, and
 *     reading somebody else's message back to an expert as though it were theirs
 *     is a small lie that reads as a very large one.
 *
 *   • It ranks by signal before recency. The most recent thing a person wrote
 *     about a topic is often a meeting-minute header or an aside; the thing they
 *     *decided* is the incident worth anchoring to.
 *
 *   • It quotes the most topic-dense LINE, not the opening of the artifact.
 *     Meeting notes start with an attendance list, and opening a request to a
 *     busy person with "back on 28 Aug you wrote: present: elin, johan, marta"
 *     is the fastest possible way to be ignored.
 */
function anchorFor(
  company: Company,
  person: Person,
  evidence: ExpertEvidence[],
  terms: string[],
): Anchor | undefined {
  const byId = new Map(company.artifacts.map((a) => [a.id, a]));
  const own = evidence
    .filter((e) => e.signal !== "named")
    .map((e) => ({ artifact: byId.get(e.artifactId), signal: e.signal }))
    .filter((row): row is { artifact: Artifact; signal: ExpertSignal } => Boolean(row.artifact))
    .filter(
      (row) => row.artifact.author.trim().toLowerCase() === person.name.trim().toLowerCase(),
    )
    // A previously captured answer is not an incident. It is a write-up we
    // produced, and opening a request with "back on Tuesday you wrote: Question
    // this answers: …" quotes our own prose back at the expert as though it were
    // theirs. Their words are still in the corpus and still citable; they are
    // just not an anchor.
    .filter((row) => row.artifact.channel !== CAPTURED_CHANNEL)
    .sort((a, b) => anchorScore(b, terms) - anchorScore(a, terms));

  const best = own[0]?.artifact;
  if (!best) return undefined;
  return {
    artifactId: best.id,
    quote: bestLine(best, terms),
    channel: best.channel,
    timestamp: best.timestamp,
  };
}

/**
 * How good an anchor a given artifact is. Signal dominates — a decision beats an
 * aside — but a Slack message is preferred to a meeting note at equal signal,
 * because minutes are written *about* people in the third person and quoting
 * "you wrote: priya would have made the opposite call" back at Priya reads as a
 * machine that has not understood what it is looking at.
 */
const ANCHOR_KIND_BONUS: Record<Artifact["kind"], number> = {
  slack: 3,
  ticket: 2,
  doc: 1,
  meeting: 0,
};

function anchorScore(row: { artifact: Artifact; signal: ExpertSignal }, terms: string[]): number {
  return (
    SIGNAL_WEIGHT[row.signal] * 10 +
    ANCHOR_KIND_BONUS[row.artifact.kind] +
    Math.min(hitCount(row.artifact, terms), 4) +
    // Recency as a decimal tiebreak only: newer is nicer, never decisive.
    recencyWeight(row.artifact.timestamp, new Date("2026-09-01T00:00:00Z"))
  );
}

/**
 * The line inside an artifact that is actually about the topic. Falls back to
 * the head of the text when nothing stands out, which is the right answer for a
 * two-line Slack message.
 *
 * The length floor is doing real work: meeting notes and docs are full of short
 * section headers ("For whoever hits the next civil-law jurisdiction.") that
 * score well on topic terms and say nothing. An anchor has to carry a claim, or
 * the expert reads it and thinks the machine is quoting them at random.
 */
function bestLine(artifact: Artifact, terms: string[]): string {
  const candidates = artifact.text
    .split(/\n+|(?<=[.!?])\s{1,}(?=[A-Z"'“])/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 55 && l.split(/\s+/).length >= 10);

  let best = "";
  let bestScore = -1;
  for (const line of candidates) {
    const lower = line.toLowerCase();
    const hits = terms.reduce((c, t) => c + (lower.includes(t) ? 1 : 0), 0);
    // Long enough to carry a claim, short enough to read at a glance. A 400-char
    // paragraph with four hits is worse to quote than a 120-char one with two.
    const shape = line.length >= 80 && line.length <= 240 ? 1 : line.length > 300 ? -1 : 0;
    const score = hits * 2 + shape;
    if (score > bestScore) {
      bestScore = score;
      best = line;
    }
  }

  return trimQuote(bestScore > 0 && best ? best : artifact.text, 190);
}

/* ═════════════════════════════════════════════════════════════ the probes ══ */

export type ProbeId =
  | "noticing"
  | "past_future"
  | "big_picture"
  | "job_smarts"
  | "improvising"
  | "self_monitoring";

export type Probe = {
  id: ProbeId;
  /** The ACTA category name, shown so the request is auditable. */
  label: string;
  /** The question as it goes to the expert, already anchored. */
  text: string;
};

/**
 * The six ACTA Knowledge Audit categories. Every `text` builder produces a
 * question about **one time something happened**. If you find yourself writing
 * "how do you", "what is your process", or "in general" into one of these, stop:
 * that is the sanitised-answer failure this whole file exists to avoid.
 */
const PROBES: Array<{
  id: ProbeId;
  label: string;
  /** Words in the hire's question that make this probe the right one. */
  cues: RegExp;
  text: (ctx: { topic: string; anchored: boolean }) => string;
}> = [
  {
    id: "noticing",
    label: "Noticing / spotting anomalies",
    cues: /\b(wrong|miss|missed|error|fail|failed|broke|broken|off|spot|catch|weird|odd|bug|slip)\b/i,
    text: ({ anchored }) =>
      anchored
        ? "What did you notice first that told you something was off — before you could have explained why?"
        : "Think of the last time you looked at one of these and something felt off before you could say why. What did you notice first?",
  },
  {
    id: "past_future",
    label: "Past & future",
    cues: /\b(when|timing|order|first|next|before|after|deadline|sequence|stage|step|then)\b/i,
    text: ({ anchored }) =>
      anchored
        ? "At that moment, what had already happened that you were reading back from — and what did you expect to happen next that nobody else in the thread was expecting?"
        : "The last time this came up: what had already happened that you were reading back from, and what did you see coming that others didn't?",
  },
  {
    id: "big_picture",
    label: "The big picture",
    cues: /\b(why|context|whole|overall|who else|stakeholder|customer|client|team|owns|scope|goal)\b/i,
    text: ({ anchored }) =>
      anchored
        ? "When you picked that up, what was the state of the whole thing in your head — the client, the deadline, what else was in flight that a new person wouldn't have known about?"
        : "Last time you did one of these, what was the state of the whole thing in your head that wasn't written down anywhere?",
  },
  {
    id: "job_smarts",
    label: "Job smarts",
    cues: /\b(faster|quick|quicker|shortcut|easier|efficient|tool|script|template|reuse|trick)\b/i,
    text: () =>
      "The last time you did this for real: what did you actually do to get it done faster or cleaner than the by-the-book way?",
  },
  {
    id: "improvising",
    label: "Improvising",
    cues: /\b(edge case|edge-case|unusual|exception|non-standard|nonstandard|doesn'?t fit|no playbook|novel|first time|weird|custom|bespoke)\b/i,
    text: ({ anchored }) =>
      anchored
        ? "Where did the standard approach not fit that time, and what did you do instead?"
        : "Tell me about one time the standard approach didn't fit here. What did you do instead?",
  },
  {
    id: "self_monitoring",
    label: "Self-monitoring",
    cues: /\b(check|verify|confident|sure|double.?check|review|confirm|validate|trust|risk|safe)\b/i,
    text: () =>
      "Was there a point in that where you noticed you were about to get it wrong, or had to slow yourself down? What tipped you off?",
  },
];

/**
 * The fixed follow-up chain, in order. Not a menu — the order is the method.
 *
 * [2] is the highest-yield question in the set, and it is the one that produces
 * the failure modes a new hire actually needs, so it goes in the body of every
 * request rather than being held back. [0] and [1] are sent only when the answer
 * that comes back has not already covered them, because every unnecessary
 * follow-up spends the expert's goodwill.
 */
export const FOLLOW_UPS = [
  "Can you give me a specific example — one actual time this happened?",
  "What were you seeing or hearing that told you that, and what did you do about it?",
  "Why would this be difficult for someone new? What mistake would they make?",
] as const;

/** Stable, content-derived rotation so two identical requests never differ. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Two or three probes, chosen by the shape of what the hire actually asked.
 *
 * Cue-matched probes come first. When nothing matches — which is common, because
 * a stuck person's question rarely announces its own category — the deterministic
 * rotation fills up, so an unclassifiable question still gets a *varied* pair
 * rather than the same default two every single time.
 */
export function selectProbes(
  question: string,
  opts: { anchored?: boolean; count?: number } = {},
): Probe[] {
  const anchored = opts.anchored ?? false;
  // One, by default. A chain of three questions is a research interview, and a
  // research interview does not get answered by somebody between meetings. One
  // incident, one question, plus the failure-mode rider `buildRequest` adds.
  const want = Math.min(Math.max(opts.count ?? 1, 1), 3);
  const ctx = { topic: question, anchored };

  const matched = PROBES.filter((p) => p.cues.test(question));
  const rest = PROBES.filter((p) => !matched.includes(p));
  const offset = hash(question) % (rest.length || 1);
  const rotated = rest.map((_, i) => rest[(i + offset) % rest.length]);

  const chosen = [...matched, ...rotated].slice(0, want);
  return chosen.map((p) => ({ id: p.id, label: p.label, text: p.text(ctx) }));
}

/* ══════════════════════════════════════════════════════════ the request ═══ */

export type ElicitationRequestText = {
  probes: Probe[];
  /** The follow-ups held in reserve, in order. */
  followUps: string[];
  /** What actually goes to the expert. Verbatim. */
  text: string;
  /** Honest, and it has to stay honest — see the budget note at the top. */
  estimatedSeconds: number;
};

export type BuildRequestInput = {
  /** What the hire is stuck on, in their words or the blocker's. */
  question: string;
  expert: ExpertPick;
  /** Who is waiting. Used to make the ask concrete, never to rank the person. */
  hireName?: string;
  hireRole?: string;
  companyName: string;
  /** Overrides the question when the topic is narrower than the sentence. */
  topic?: string;
};

/**
 * The message the colleague receives.
 *
 * ── WHOSE MESSAGE THIS IS ────────────────────────────────────────────────────
 *
 * It is the new hire's, and every line of it is arranged to read that way. The
 * newcomer is named in the first sentence, the question is in their words, and
 * the machinery gets one short line near the end.
 *
 * This is not a stylistic preference. Marót et al. (2026, N=192) held the text
 * *identical* and varied only the attribution: feedback presented as coming from
 * an AI rather than a person reduced openness to asking for help (η²=0.17) and
 * willingness to correct mistakes (η²=0.14). A field study of 6,255 calls found
 * pre-disclosed bot callers cut compliance by 79.7%. A request that opens
 * "Onboarder requests knowledge capture" is a request that gets closed.
 *
 * So: no bot persona, no first-person system voice, no branding in the ask. What
 * it must never do is *pretend* a human typed it — the write-up step is stated
 * plainly at the bottom, because the honest version of "foreground the person"
 * is "the person really is asking, through a tool", not "hide the tool".
 *
 * ── AND WHY IT IS THIS SHORT ─────────────────────────────────────────────────
 *
 * Answerable in under two minutes, from memory, between meetings. If it needs
 * them to go and look anything up, it does not get answered — so it is one
 * incident, one question, with the failure-mode rider attached rather than
 * numbered as a third. The refusal is right there in the message and costs
 * nothing: an ask you cannot decline is an ask people learn to ignore.
 */
export function buildRequest(input: BuildRequestInput): ElicitationRequestText {
  const { question, expert } = input;
  const anchored = Boolean(expert.anchor);
  const probes = selectProbes(question, { anchored, count: 1 });

  const first = expert.person.name.trim().split(/\s+/)[0];
  const waiting = input.hireName?.trim();
  const waitingFirst = waiting?.split(/\s+/)[0];
  const waitingRole = input.hireRole?.trim();
  const who = waitingFirst ?? "Someone who just joined";

  const lines: string[] = [];

  // The newcomer, first, by name. Not the tool, not the company, not the ask.
  lines.push(
    waiting
      ? `${first} — ${waiting} started recently${waitingRole ? ` as a ${waitingRole}` : ""} and is stuck on something you've dealt with.`
      : `${first} — someone who just joined is stuck on something you've dealt with.`,
  );
  lines.push("");
  lines.push(`They're asking:`);
  lines.push(`  “${question.trim()}”`);
  lines.push("");
  lines.push(
    `It isn't written down anywhere — not in Slack, not in the docs, not in the tickets — so it's coming to you.`,
  );
  lines.push("");

  // The anchor. A verbatim line of their own, with its date and channel, so the
  // request is about a thing that happened rather than about a topic.
  if (expert.anchor) {
    const when = shortDate(expert.anchor.timestamp);
    const where = expert.anchor.channel ? ` in ${expert.anchor.channel}` : "";
    lines.push(`On ${when}${where} you wrote:`);
    lines.push(`  “${expert.anchor.quote}”`);
    lines.push("");
    lines.push(`Thinking of that one time — not how it's done in general:`);
  } else {
    lines.push(`Thinking of one time it actually came up — not how it's done in general:`);
  }

  lines.push(`  · ${probes[0]?.text ?? FOLLOW_UPS[0]}`);
  lines.push(`  · And what would ${who} have got wrong there?`);
  lines.push("");
  lines.push(
    `Two or three sentences off the top of your head is plenty — please don't go and look anything up. Just what happened: what you saw, what you did. Not why it was right.`,
  );
  lines.push("");
  lines.push(
    `If this isn't yours, say so and it goes to someone else — that's a genuinely useful answer and it costs you nothing.`,
  );
  lines.push("");
  lines.push(
    `Speak it if that's quicker. You'll get a short write-up of your answer back to check before it goes anywhere; ${
      waitingFirst ?? "they"
    } gets it either way.`,
  );

  return {
    probes,
    // The chain, held in reserve and used at most once — see `nextFollowUp`.
    followUps: [FOLLOW_UPS[0], FOLLOW_UPS[1], FOLLOW_UPS[2]],
    text: lines.join("\n"),
    // Honest, and it has to stay honest. Two sentences from memory is well
    // inside two minutes; the teachback is one more line.
    estimatedSeconds: 45,
  };
}

/**
 * Whether the answer that came back is missing something the chain is designed
 * to recover, and which follow-up to send if so. Returns `null` when the answer
 * is good enough — which is the common case and must stay the common case.
 *
 * Order is enforced: a thin answer gets [0] before it ever gets [1].
 */
export function nextFollowUp(answer: string): { index: number; text: string } | null {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;

  // Too short to contain an incident at all. The threshold is deliberately low:
  // a good answer here is two or three sentences, and asking somebody who just
  // gave you a useful thirty words for "a specific example" reads as the machine
  // not having read it.
  if (words < 15) return { index: 0, text: FOLLOW_UPS[0] };

  // No narration of an actual sequence — the "sanitised process description"
  // failure mode arriving in longer form.
  const narrates =
    /\b(i|we)\s+(saw|noticed|asked|checked|ran|opened|pulled|told|read|found|flagged|pushed|called|wrote|went|started|stopped|realised|realized|had to|ended up)\b/i.test(
      answer,
    ) || /\b(last (time|week|month)|back in|on the|when (i|we))\b/i.test(answer);
  if (!narrates && words < 60) return { index: 1, text: FOLLOW_UPS[1] };

  // The highest-yield content is missing: nothing about what a new person gets
  // wrong. This is the only one worth a second round trip — and it is asked at
  // most once, never as part of a chain, because the budget is two minutes.
  const failureModes =
    /\b(new|newcomer|junior|first time|mistake|wrong|assume[ds]?|trap|easy to|would miss|don'?t realise|don'?t realize|gotcha|pitfall|instead of)\b/i.test(
      answer,
    );
  if (!failureModes) return { index: 2, text: FOLLOW_UPS[2] };

  return null;
}

/* ════════════════════════════════════════════════════════════ teachback ═══ */

/**
 * ── WHY THE TEACHBACK IS NOT OPTIONAL ────────────────────────────────────────
 *
 * An expert's raw answer never goes into the corpus. It is spoken, elliptical,
 * full of referents only they hold, and — after transcription — occasionally
 * wrong about a proper noun in exactly the way that matters. Writing it down
 * verbatim produces an artifact that reads as authoritative and is not.
 *
 * So the loop is: draft back what was understood, they correct one line, the
 * corrected version is what gets stored. This is a comprehension check pointed
 * at *us*, not at them. The closest published comparison we have found put
 * curated-with-review at 83% comprehension against AI-only at 57%; the cost here
 * is one line of an expert's attention, which is inside the budget.
 *
 * The correction is applied to the draft, and the draft is never stored on its
 * own. `knowledge.ts` will not accept an unconfirmed teachback.
 */

export type TeachbackDraft = {
  /** One claim per line, numbered when shown. Never more than five. */
  lines: string[];
  /** Lines the drafter is unsure it got right. Surfaced first for correction. */
  uncertain: string[];
  /** How the draft was produced. Shown, because "the model wrote this" is relevant. */
  source: "model" | "extractive";
};

const TeachbackSchema = z.object({
  lines: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe(
      "What you understood, one concrete claim per line, in their register. Every line must be " +
        "supported by something they actually said. The last line must be what a new person would " +
        "get wrong, if they said anything about that.",
    ),
  uncertain: z
    .array(z.string())
    .describe(
      "Lines above you are least sure you got right, quoted exactly as written above. Empty array " +
        "if you are confident in all of them.",
    ),
});

const TEACHBACK_SYSTEM = `You are writing back to a busy expert to check you understood their answer, before it is written into their company's internal corpus where new hires will read it as fact.

THE ONE RULE: every line must be something they actually said. Not a reasonable inference, not the standard practice, not what an expert in their position would presumably do. If they did not say it, it does not go in. Where they were ambiguous, write your best reading of it and list that line in "uncertain" so they can fix it in one edit.

Write in their register, not yours. If they said "just read the twelve documents first", the line is "Read all twelve documents before touching a keyword list" — not "Adopt a document-first review methodology". Corporate paraphrase is how the specific detail a new hire needs gets sanded off.

Concrete over general. Names, numbers, thresholds, tools, the order things happen in. Drop the hedging and the filler; keep the specifics.

Three to five lines, one claim each, no preamble and no sign-off. If they said anything about what someone new would get wrong, that is the last line — it is the most valuable thing in the answer.`;

/**
 * Draft the understanding back.
 *
 * Asks the model, because "what did you understand" is a comprehension task and
 * an extractive summary is not one. Falls back to the extractive draft if the
 * model is unavailable, because a teachback that never renders is worse than a
 * blunt one — the expert is holding their phone, waiting.
 */
export async function draftTeachback(input: {
  question: string;
  answer: string;
  expertName: string;
  expertRole?: string;
  via: "voice" | "text";
}): Promise<TeachbackDraft> {
  try {
    const raw = await generate({
      system: TEACHBACK_SYSTEM,
      user: [
        `A new hire is stuck on: ${input.question}`,
        "",
        `${input.expertName}${input.expertRole ? ` (${input.expertRole})` : ""} answered${
          input.via === "voice" ? ", out loud, so expect transcription noise and false starts" : ""
        }:`,
        "",
        input.answer.trim(),
        "",
        "Write back what you understood.",
      ].join("\n"),
      schema: TeachbackSchema,
      label: "teachback draft",
      maxTokens: 1500,
    });

    const lines = raw.lines.map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      return { lines, uncertain: raw.uncertain.map((u) => u.trim()).filter(Boolean), source: "model" };
    }
  } catch (err) {
    console.warn(`[elicit] teachback draft fell back to extractive: ${(err as Error).message}`);
  }

  return extractiveTeachback(input.answer);
}

/**
 * The fallback. Sentence-splits the answer and keeps the first four substantive
 * ones. Blunt, but it is *their words*, so it cannot invent anything — which is
 * the property that matters when the model is not available.
 */
export function extractiveTeachback(answer: string): TeachbackDraft {
  const sentences = answer
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 4);

  const lines = (sentences.length ? sentences : [answer.trim()]).slice(0, 4);
  return { lines, uncertain: [], source: "extractive" };
}

/** Numbered, ready to show or speak. */
export function renderTeachback(draft: TeachbackDraft, expertName: string): string {
  const first = expertName.trim().split(/\s+/)[0];
  const numbered = draft.lines.map((l, i) => `${i + 1}. ${l}`).join("\n");
  const flag = draft.uncertain.length
    ? `\n\nLeast sure about: ${draft.uncertain.map((u) => `“${trimQuote(u, 80)}”`).join("; ")}`
    : "";
  return (
    `Here's what I understood, ${first}:\n\n${numbered}${flag}\n\n` +
    `Fix one line — reply with the number and what it should say. Or say "correct" and I'll write it down as is.`
  );
}

export type Correction = {
  /** 1-based, as shown to the expert. Omitted when they just corrected in prose. */
  line?: number;
  text: string;
};

/**
 * Apply the correction to the draft.
 *
 * A correction is never dropped. If it does not name a line, and we cannot
 * confidently work out which one it replaces, it is *appended* as an explicit
 * correction rather than silently discarded — losing the one edit an expert
 * spent their attention on is the fastest way to make sure they never reply
 * again.
 */
export function applyCorrection(draft: TeachbackDraft, correction: Correction): string[] {
  const lines = [...draft.lines];
  const text = correction.text.trim();
  if (!text) return lines;

  // Explicit line number, either passed in or written at the front of the
  // correction ("3. actually it's..." / "line 2: ...").
  let index = typeof correction.line === "number" ? correction.line - 1 : -1;
  let body = text;

  if (index < 0) {
    const m = text.match(/^(?:line\s*)?(\d{1,2})\s*[.):\-—]\s*(.+)$/is);
    if (m) {
      index = Number.parseInt(m[1], 10) - 1;
      body = m[2].trim();
    }
  }

  if (index >= 0 && index < lines.length) {
    lines[index] = body;
    return lines;
  }

  lines.push(`Correction from the expert: ${body}`);
  return lines;
}

/** The topic to route on, when the caller has only the hire's sentence. */
export function topicFrom(question: string): string {
  const terms = topicTerms(question);
  return terms.slice(0, 8).join(" ") || question.trim();
}
