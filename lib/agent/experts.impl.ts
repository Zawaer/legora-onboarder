/**
 * Implementation of the `experts.ts` contract.
 *
 * Two rules run through everything below.
 *
 * The first is that nobody is returned without evidence. Every candidate is
 * assembled with the spans it would cite, those spans are checked through the
 * same `ground.ts` substring verification the model's own citations go through,
 * and a candidate whose citations do not survive is dropped rather than shown
 * bare. "Ask Johan" with three messages under it is a routing decision a new
 * hire can check in four seconds; "ask Johan" on its own is our opinion.
 *
 * The second is that talking is not knowing. Authority is only ever accumulated
 * from answering, from being named by someone else, and from stating a
 * decision — `mentioned` exists to break ties and can never carry a person on
 * its own, which is what stops the busiest account in a channel from being
 * elected its expert. Repeats are collapsed per conversation, too: four replies
 * in one thread are one act of answering, not four.
 */

import {
  SIGNAL_WEIGHT,
  mentionsTopic,
  recencyWeight,
  topicTerms,
  type ExpertEvidence,
  type ExpertSignal,
  type RankExperts,
  type RankedExpert,
  type WhosWho,
} from "@/lib/agent/experts";
import { buildIndex, type CorpusIndex, type Utterance } from "@/lib/agent/experts-index";
import { groundEvidence } from "@/lib/agent/ground";
import type { Artifact, Company, Evidence, Person } from "@/lib/types";

/* ── tunables ──────────────────────────────────────────────────────────── */

const MAX_EVIDENCE = 3;
const MAX_QUOTE_CHARS = 200;
/** ground.ts drops anything under 12; a quote this short is unreadable anyway. */
const MIN_QUOTE_CHARS = 28;
/**
 * A reaction is not an answer. "👍" and "^^ this" are replies in a thread
 * somebody else started, which is the letter of the `answered` signal and the
 * opposite of its point — and they are exactly what the most-present person in
 * a channel produces most of.
 */
const MIN_ANSWER_CHARS = 60;
/**
 * How hard a partial topic match is discounted. Squarish: a message that hits
 * "clause" and "extraction" is worth five times one that only says "extraction",
 * because half a topic is usually a different topic.
 */
const COVERAGE_EXPONENT = 1.5;
/** Ordering for which evidence gets shown first. Lower is stronger. */
const SIGNAL_RANK: Record<ExpertSignal, number> = {
  answered: 0,
  named: 0,
  decided: 0,
  mentioned: 1,
};

/* ── the events an expert is made of ───────────────────────────────────── */

type Event = {
  signal: ExpertSignal;
  artifact: Artifact;
  /** Collapses repeats: one act of answering per conversation, not per message. */
  key: string;
  score: number;
  /** Where in the artifact this happened — the quote is cut from here. */
  start: number;
  end: number;
  /** Exact offset of the thing being cited, when we know it. */
  focus?: number;
  /** Words to centre the excerpt on, so the quote shows the thing it claims. */
  needles: string[];
  /** Who was speaking, when it was somebody else talking about this person. */
  speaker?: string;
};

type Candidate = { person: Person; events: Event[]; score: number };

/** How much this utterance counts for, between 0 (irrelevant) and 1. */
type Relevance = (utterance: Utterance, root?: Artifact) => number;

/* ── rankExperts ───────────────────────────────────────────────────────── */

export const rankExperts: RankExperts = (company, topic, opts = {}) => {
  const terms = topicTerms(topic);
  if (!terms.length) return [];

  const now = opts.now ?? new Date();
  const limit = Math.max(0, opts.limit ?? 3);
  if (!limit) return [];

  const index = buildIndex(company);
  if (!index.people.length || !index.artifacts.length) return [];

  const relevance = topicRelevance(index, terms);
  const excluded = excludeSet(opts.exclude);

  const candidates = collect(index, relevance, now, excluded);

  return candidates
    .map((c) => finish(c, company, topic, terms))
    .filter((e): e is RankedExpert => e !== undefined)
    .slice(0, limit);
};

/* ── whosWho ───────────────────────────────────────────────────────────── */

/**
 * The people a new hire in this role will actually run into.
 *
 * Same machinery, different lens: instead of "who knows this topic", the
 * question is "whose desk does this role's work land on", so relevance is by
 * *where the work happens* — the channels and documents the role title points
 * at — rather than by topic keywords. What each person is the go-to for is then
 * read back out of the artifacts they earned their signals in, so the reason
 * line says "extraction, Nordkap, recall" instead of a job title nobody wrote.
 */
export const whosWho: WhosWho = (company, roleTitle, opts = {}) => {
  const now = opts.now ?? new Date();
  const limit = Math.max(0, opts.limit ?? 10);
  if (!limit) return [];

  const index = buildIndex(company);
  if (!index.people.length || !index.artifacts.length) return [];

  const terms = topicTerms(roleTitle);
  // Weighted, not filtered. A legal engineer's week runs through #legal-eng,
  // but the people they will actually run into include the one who grants repo
  // access and the one who runs the eval harness — and those live elsewhere. A
  // hard channel filter produces a tidy list of six that leaves out half of
  // week one.
  const affinity = channelAffinity(index, terms, now);
  const relevance: Relevance = (u) => 0.4 + 0.6 * (affinity.get(channelKey(u.artifact)) ?? 0);

  const candidates = collect(index, relevance, now, new Set());

  const out: Array<{ person: Person; why: string; evidence: ExpertEvidence[] }> = [];
  for (const candidate of candidates) {
    if (out.length >= limit) break;
    const evidence = evidenceFor(candidate, company, []);
    if (!evidence.length) continue;
    out.push({
      person: candidate.person,
      why: whyGoTo(index, candidate, evidence, terms),
      evidence,
    });
  }
  return out;
};

/* ── collecting signals ────────────────────────────────────────────────── */

/**
 * Walk the index once and turn it into per-person events.
 *
 * `relevance` is 0 for artifacts that have nothing to do with the question and
 * between 0 and 1 otherwise, so a message that hits every word of the topic
 * counts for more than one that grazed a single word of it. Everything else is
 * the contract's own arithmetic: the signal's weight, decayed by age.
 */
function collect(
  index: CorpusIndex,
  relevance: Relevance,
  now: Date,
  excluded: Set<string>,
): Candidate[] {
  const events = new Map<number, Map<string, Event>>();

  const push = (person: number, event: Event) => {
    if (person < 0 || event.score <= 0) return;
    const bucket = events.get(person) ?? new Map<string, Event>();
    const existing = bucket.get(event.key);
    if (!existing || existing.score < event.score) bucket.set(event.key, event);
    events.set(person, bucket);
  };

  for (const u of index.utterances) {
    if (u.speaker < 0) continue;
    const root = index.byArtifactId.get(u.threadId);
    const weight = relevance(u, root);
    if (weight <= 0) continue;
    const decay = recencyWeight(u.artifact.timestamp, now);

    // Answering: replied inside a conversation somebody else opened, with
    // enough in the reply that it could have been the answer.
    if (u.isReply && u.threadAuthor !== u.speaker && u.end - u.start >= MIN_ANSWER_CHARS) {
      push(u.speaker, {
        signal: "answered",
        artifact: u.artifact,
        key: `answered:${u.threadId}`,
        score: SIGNAL_WEIGHT.answered * decay * weight,
        start: u.start,
        end: u.end,
        needles: [],
      });
    }

    // Stating a decision, or writing the reference document for the area.
    if (u.decidesAt !== undefined) {
      push(u.speaker, {
        signal: "decided",
        artifact: u.artifact,
        key: `decided:${u.artifact.id}:${u.start}`,
        score: SIGNAL_WEIGHT.decided * decay * weight,
        start: u.start,
        end: u.end,
        focus: u.decidesAt,
        needles: [],
      });
    }

    // Present in the topic. Never enough on its own; useful for ordering.
    push(u.speaker, {
      signal: "mentioned",
      artifact: u.artifact,
      key: `mentioned:${u.artifact.id}`,
      score: SIGNAL_WEIGHT.mentioned * decay * weight,
      start: u.start,
      end: u.end,
      needles: [],
    });
  }

  for (const ref of index.references) {
    const u = ref.utterance;
    const self = ref.person === u.speaker;
    // Their own name in their own message tells us nothing new — except when it
    // is an assignment line, which is the corpus stating ownership out loud.
    if (self && ref.kind !== "decided") continue;

    const root = index.byArtifactId.get(u.threadId);
    const weight = relevance(u, root);
    if (weight <= 0) continue;
    const decay = recencyWeight(u.artifact.timestamp, now);
    const speaker = index.people[u.speaker]?.name ?? u.artifact.author;

    push(ref.person, {
      signal: ref.kind,
      artifact: u.artifact,
      key: `${ref.kind}-by-other:${u.artifact.id}`,
      score: SIGNAL_WEIGHT[ref.kind] * decay * weight,
      start: u.start,
      end: u.end,
      // Quote the sentence their name is actually in, not the first line of a
      // meeting note that happens to list everyone who attended.
      focus: ref.start,
      needles: [],
      speaker,
    });
  }

  const candidates: Candidate[] = [];
  for (const [person, bucket] of events) {
    const list = [...bucket.values()];
    // The rule that keeps the loudest person in the channel out of the list:
    // presence alone is never authority.
    if (!list.some((e) => e.signal !== "mentioned")) continue;
    const name = index.people[person]!;
    if (excluded.has(name.name.toLowerCase()) || excluded.has(name.slackHandle.replace(/^@+/, "").toLowerCase())) {
      continue;
    }
    candidates.push({
      person: name,
      events: list.sort((a, b) => SIGNAL_RANK[a.signal] - SIGNAL_RANK[b.signal] || b.score - a.score),
      score: list.reduce((sum, e) => sum + e.score, 0),
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * How much of the topic this *utterance* covers.
 *
 * Credit is for what the person said, not for the ticket their one-line comment
 * happens to sit under. That distinction is most of the difference between
 * ranking the person who solved the Italian escalation and ranking the person
 * who is present in every thread: both appear in the same artifacts, only one
 * of them uses the words.
 *
 * The artifact (or the question being answered) still acts as the gate, at half
 * credit, because plenty of genuine answers never repeat the topic's words.
 */
function topicRelevance(index: CorpusIndex, terms: string[]): Relevance {
  const cache = new Map<string, number>();

  // A word used once in passing is a mention; a word used repeatedly is what
  // the message is about. "everyone is on nordkap or escalations" and a writeup
  // that says "italian" nine times both match the topic — they should not match
  // it equally.
  const cover = (text: string): number => {
    const haystack = text.toLowerCase();
    let mass = 0;
    for (const term of terms) {
      const hits = occurrences(haystack, term);
      if (hits) mass += hits >= 2 ? 1 : 0.6;
    }
    return mass === 0 ? 0 : Math.pow(mass / terms.length, COVERAGE_EXPONENT);
  };

  const artifactCoverage = (artifact: Artifact): number => {
    const hit = cache.get(artifact.id);
    if (hit !== undefined) return hit;
    const value = cover(`${artifact.title ?? ""} ${artifact.text}`);
    cache.set(artifact.id, value);
    return value;
  };

  void index;

  return (u, root) => {
    const own = artifactCoverage(u.artifact);
    // A reply that answers a question about the topic counts even when the
    // reply itself never repeats the words — which is most useful answers.
    const inherited = root && root.id !== u.artifact.id ? artifactCoverage(root) * 0.8 : 0;
    const gate = Math.max(own, inherited);
    if (gate <= 0) return 0;

    const said = cover(
      u.isHead
        ? `${u.artifact.title ?? ""} ${u.artifact.text.slice(u.start, u.end)}`
        : u.artifact.text.slice(u.start, u.end),
    );
    return Math.max(said, gate * 0.5);
  };
}

/** How many times a term appears. Capped — we only care about "once" vs "a lot". */
function occurrences(haystack: string, needle: string): number {
  let n = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1 && n < 3) {
    n += 1;
    at = haystack.indexOf(needle, at + needle.length);
  }
  return n;
}

function excludeSet(exclude?: string[]): Set<string> {
  return new Set((exclude ?? []).map((v) => v.trim().replace(/^@+/, "").toLowerCase()).filter(Boolean));
}

/* ── turning a candidate into a ranked expert ──────────────────────────── */

function finish(
  candidate: Candidate,
  company: Company,
  topic: string,
  terms: string[],
): RankedExpert | undefined {
  const evidence = evidenceFor(candidate, company, terms);
  if (!evidence.length) return undefined;
  return {
    person: candidate.person,
    score: round(candidate.score),
    evidence,
    why: whyExpert(candidate, evidence, topic),
  };
}

/**
 * Up to three excerpts, strongest signal first, each one verified.
 *
 * The excerpts are cut out of the artifact by offset rather than reconstructed,
 * so they are substrings by construction — and then run through `groundEvidence`
 * anyway, because "by construction" is exactly what the last system that
 * shipped fabricated records also believed.
 */
function evidenceFor(candidate: Candidate, company: Company, terms: string[]): ExpertEvidence[] {
  const seen = new Set<string>();
  const proposed: ExpertEvidence[] = [];

  // Ordered for a reader, not for the ranking: strongest signal first, and
  // within that, the excerpt with something in it. A verified one-liner is
  // still true and still worthless as a reason to interrupt somebody.
  const ordered = [...candidate.events].sort(
    (a, b) =>
      SIGNAL_RANK[a.signal] - SIGNAL_RANK[b.signal] ||
      b.score * substance(b) - a.score * substance(a),
  );

  for (const event of ordered) {
    if (proposed.length >= MAX_EVIDENCE * 2) break;
    if (seen.has(event.artifact.id)) continue;
    const quote = excerpt(event.artifact.text, event, [...event.needles, ...terms]);
    if (!quote) continue;
    seen.add(event.artifact.id);
    proposed.push({
      artifactId: event.artifact.id,
      quote,
      channel: event.artifact.channel,
      timestamp: event.artifact.timestamp,
      signal: event.signal,
    });
  }

  const asEvidence: Evidence[] = proposed.map((e) => ({
    artifactId: e.artifactId,
    quote: e.quote,
    why: e.signal,
  }));
  const kept = new Set(groundEvidence(asEvidence, company).map((e) => `${e.artifactId} ${e.quote}`));

  return proposed.filter((e) => kept.has(`${e.artifactId} ${e.quote}`)).slice(0, MAX_EVIDENCE);
}

/** How much there is to read in this span, from 0.3 (a line) to 1 (a paragraph). */
function substance(event: Event): number {
  return 0.3 + 0.7 * Math.min(1, (event.end - event.start) / 240);
}

/**
 * Cut a readable excerpt out of a span, centred on the first word that matters.
 *
 * Only ever a contiguous slice: stitching two halves of a message into one
 * sentence would pass a substring check per fragment and still be something
 * nobody wrote.
 */
function excerpt(text: string, event: Event, needles: string[]): string | undefined {
  const { start, end } = event;
  const span = text.slice(start, end);
  if (!span.trim()) return undefined;

  let at = -1;
  if (event.focus !== undefined && event.focus >= start && event.focus < end) {
    at = event.focus - start;
  } else {
    const lower = span.toLowerCase();
    for (const needle of needles) {
      if (needle.length < 3) continue;
      const found = lower.indexOf(needle.toLowerCase());
      if (found !== -1 && (at === -1 || found < at)) at = found;
    }
  }
  if (at === -1) at = 0;

  // Back up to the start of the sentence or line the match sits in.
  let from = 0;
  for (const boundary of ["\n", ". ", "? ", "! "]) {
    const b = span.lastIndexOf(boundary, at);
    if (b !== -1) from = Math.max(from, b + boundary.length);
  }
  while (from < span.length && /[\s>*·]/.test(span[from]!)) from += 1;
  if (from > at) from = 0;

  // Run to a sentence end if there is one in range, otherwise a word boundary.
  let stop = Math.min(span.length, from + MAX_QUOTE_CHARS);
  if (stop < span.length) {
    const ends = ["\n", ". ", "? ", "! "]
      .map((b) => span.lastIndexOf(b, stop))
      .filter((i) => i > from + MIN_QUOTE_CHARS);
    if (ends.length) stop = Math.max(...ends) + 1;
    else {
      const space = span.lastIndexOf(" ", stop);
      if (space > from + MIN_QUOTE_CHARS) stop = space;
    }
  }

  const quote = span.slice(from, stop).trim().replace(/[\s,;:·—–-]+$/, "");
  if (quote.length >= MIN_QUOTE_CHARS) return quote;

  const wider = span.slice(from, Math.min(span.length, from + MAX_QUOTE_CHARS)).trim();
  return wider.length >= 12 ? wider : undefined;
}

/* ── saying why, in words ──────────────────────────────────────────────── */

/**
 * A sentence a human can act on. No score, no rating, no number attached to a
 * person — counts of things they did, the channel they did them in, and when.
 */
function whyExpert(candidate: Candidate, evidence: ExpertEvidence[], topic: string): string {
  const subject = topic.trim().toLowerCase() || "this";
  const answered = candidate.events.filter((e) => e.signal === "answered");
  const named = candidate.events.filter((e) => e.signal === "named");
  const decided = candidate.events.filter((e) => e.signal === "decided");

  const clauses: string[] = [];

  if (answered.length) {
    clauses.push(
      `answered ${count(answered.length)} question${answered.length === 1 ? "" : "s"} about ${subject}` +
        placeSuffix(answered),
    );
  }

  if (named.length && clauses.length < 2) {
    const askers = unique(named.map((e) => e.speaker).filter(Boolean) as string[]).slice(0, 2);
    const who = askers.length ? askers.join(" and ") : "colleagues";
    clauses.push(
      clauses.length
        ? `and was the name ${who} reached for when asking about it`
        : `is the name ${who} reached for when asking about ${subject}`,
    );
  }

  if (decided.length && clauses.length < 2) {
    clauses.push(ownershipClause(candidate.person, decided, subject));
    // Their own statement plus somebody else's record of it is the strongest
    // pair of facts available, and worth both halves of the sentence.
    const recorded = decided.find((e) => e.speaker);
    const authored = decided.some((e) => !e.speaker && e.artifact.author === candidate.person.name);
    if (recorded?.speaker && authored && clauses.length < 2) {
      clauses.push(`and is who ${recorded.speaker} recorded as doing the work`);
    }
  }

  if (!clauses.length) clauses.push(`comes up throughout the record on ${subject}`);

  return sentence(`${clauses.join(", ")} ${whenPhrase(evidence.length ? evidence : [])}`.trim());
}

/**
 * whosWho's line: what this person is the go-to for, in the corpus's own words.
 *
 * Deliberately not their job title — the job titles on an ingested roster are
 * "Role not stated in the corpus · 14 messages", and even where they exist they
 * are the thing a new hire can already read off Slack. The useful sentence is
 * the one the org chart does not contain: what they answer about, and where.
 */
function whyGoTo(
  index: CorpusIndex,
  candidate: Candidate,
  evidence: ExpertEvidence[],
  roleTerms: string[],
): string {
  const strong = candidate.events.filter((e) => e.signal !== "mentioned");
  const answered = candidate.events.filter((e) => e.signal === "answered");
  const named = candidate.events.filter((e) => e.signal === "named");
  const decided = candidate.events.filter((e) => e.signal === "decided");
  const topics = distinctive(index, candidate.person, strong.length ? strong : candidate.events, roleTerms);
  const about = topics.length ? ` about ${list(topics)}` : "";
  const on = topics.length ? ` on ${list(topics)}` : "";

  let lead: string;
  if (named.length >= Math.max(answered.length, decided.length) && named.length) {
    const askers = unique(named.map((e) => e.speaker).filter(Boolean) as string[]).slice(0, 2);
    lead = `the name ${askers.length ? askers.join(" and ") : "people"} reach for${about}`;
  } else if (answered.length >= decided.length && answered.length) {
    lead = `answers ${count(Math.min(answered.length, 12))} thread${
      answered.length === 1 ? "" : "s"
    }${about}${placeSuffix(answered)}`;
  } else if (decided.length) {
    const authored = decided.filter((e) => !e.speaker && e.artifact.author === candidate.person.name);
    const titled = authored.find((e) => e.artifact.title);
    lead = titled
      ? `wrote ${shorten(titled.artifact.title!, 56)}, and is the standing reference${on}`
      : ownershipClause(candidate.person, decided, topics.length ? list(topics) : "this");
  } else {
    lead = `turns up throughout the record${about}`;
  }

  return sentence(`${lead} ${whenPhrase(evidence)}`.trim());
}

/**
 * Ownership, said accurately.
 *
 * "Wrote the Italian writeup" is only allowed when they are the artifact's
 * author. When the ownership signal came from somebody *else* recording it —
 * "marta reworking the retrieval step", in a retro Anders wrote — the sentence
 * has to say that instead. Getting this wrong attributes a colleague's document
 * to the wrong person on the strength of one regex, which is the same class of
 * mistake as a fabricated quote.
 */
function ownershipClause(person: Person, decided: Event[], subject: string): string {
  const authored = decided.filter((e) => !e.speaker && e.artifact.author === person.name);
  const titled = authored.find((e) => e.artifact.title);
  if (titled) return `wrote ${shorten(titled.artifact.title!, 60)}`;
  if (authored.length) return `settled how ${subject} is handled${placeSuffix(authored)}`;

  const recorded = decided.find((e) => e.speaker);
  if (recorded) {
    const where = recorded.artifact.title ? shorten(recorded.artifact.title, 48) : recorded.artifact.channel;
    return `is who ${recorded.speaker} recorded as doing the work${where ? `, in ${where}` : ""}`;
  }
  return `owns how ${subject} is handled${placeSuffix(decided)}`;
}

function placeSuffix(events: Event[]): string {
  const channels = unique(events.map((e) => e.artifact.channel).filter(Boolean) as string[]).slice(0, 2);
  if (!channels.length) return "";
  return ` in ${list(channels)}`;
}

function whenPhrase(evidence: ExpertEvidence[]): string {
  const months = unique(
    evidence
      .map((e) => new Date(e.timestamp))
      .filter((d) => !Number.isNaN(d.getTime()))
      .map((d) => `${MONTHS[d.getUTCMonth()]}`),
  );
  if (!months.length) return "";
  if (months.length === 1) return `in ${months[0]}`;
  return `across ${list(months.slice(0, 3))}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WORDS = [
  "no", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
];

/** Words, not digits: "answered three questions" reads as a fact, "3" as a metric. */
function count(n: number): string {
  return WORDS[n] ?? String(n);
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function sentence(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return `${trimmed[0]!.toUpperCase()}${trimmed.slice(1)}${/[.!?]$/.test(trimmed) ? "" : "."}`;
}

function shorten(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/* ── what someone is the go-to for ─────────────────────────────────────── */

const NOISE = new Set([
  "the", "and", "for", "with", "that", "this", "have", "has", "was", "were", "are", "you", "your",
  "our", "not", "but", "they", "them", "their", "there", "then", "than", "from", "what", "when",
  "which", "who", "whom", "why", "how", "all", "any", "can", "will", "would", "should", "could",
  "into", "just", "like", "also", "some", "more", "most", "only", "over", "even", "same", "one",
  "two", "three", "week", "weeks", "month", "day", "days", "today", "yesterday", "tomorrow",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "thing", "things",
  "actually", "really", "still", "here", "about", "because", "before", "after", "does", "doing",
  "done", "make", "made", "want", "wants", "need", "needs", "know", "knew", "think", "say", "said",
  "get", "got", "put", "take", "took", "taking", "give", "given", "goes", "went", "come", "came",
  "keep", "kept", "send", "sent", "hold", "held", "look", "looks", "tell", "told", "find", "found",
  "seen", "sure", "half", "full", "whole", "part", "side", "kind", "sort", "line", "lines", "point",
  "points", "case", "cases", "list", "note", "notes", "name", "names", "open", "close", "being",
  "been", "both", "each", "else", "ever", "while", "very", "much", "many", "every", "everyone",
  "someone", "nobody", "anyone", "please", "thank", "thanks", "sorry", "yeah", "okay", "going",
  "good", "back", "team", "people", "person", "work", "working", "time", "first", "second", "next",
  "last", "new", "document", "documents", "something", "anything", "nothing", "everything",
  "present", "attendees", "agenda", "action", "actions", "item", "items", "update", "updates",
  "quick", "honestly", "genuinely", "better", "worse", "wrong", "right", "happy", "maybe",
  "probably", "obviously", "basically", "literally", "anyway", "answer", "answers", "question",
  "questions", "call", "calls", "called", "afternoon", "morning", "evening", "tonight", "weekly",
  "sync", "meeting", "written", "write", "writes", "writing", "wrote", "read", "reads", "reading",
  "says", "fine", "nice", "great", "cool", "actual", "real", "sense", "point", "stuff",
]);

const DISTINCTIVE_CACHE = new WeakMap<CorpusIndex, Map<string, number>>();
const NAME_WORDS = new WeakMap<CorpusIndex, Set<string>>();

/**
 * Every spelling of a colleague's name, so nobody's specialism comes out as a
 * coworker. The de-hyphenated form matters: the roster says "Ji-won Park" and
 * the corpus says "jiwon".
 */
function personWords(index: CorpusIndex): Set<string> {
  const hit = NAME_WORDS.get(index);
  if (hit) return hit;
  const words = new Set<string>();
  for (const person of index.people) {
    for (const part of person.name.toLowerCase().split(/\s+/)) {
      words.add(part);
      words.add(part.replace(/-/g, ""));
    }
    words.add(person.slackHandle.replace(/^@+/, "").toLowerCase());
  }
  NAME_WORDS.set(index, words);
  return words;
}

/** Document frequency across the corpus, so common words stop being "topics". */
function documentFrequency(index: CorpusIndex): Map<string, number> {
  const hit = DISTINCTIVE_CACHE.get(index);
  if (hit) return hit;
  const df = new Map<string, number>();
  for (const artifact of index.artifacts) {
    for (const token of unique(tokens(artifact))) df.set(token, (df.get(token) ?? 0) + 1);
  }
  DISTINCTIVE_CACHE.set(index, df);
  return df;
}

/**
 * Words and adjacent word-pairs worth naming a subject after.
 *
 * The pairs are the point: single words out of a corpus this size produce
 * "documents" and "thursday", where the pairs produce "clause extraction",
 * "playbook library" and "eval harness" — which is what somebody is actually
 * the go-to for. A pair only forms between two words that both survived the
 * noise filter, so it can never span a phrase boundary.
 */
function tokens(artifact: Artifact): string[] {
  const words = `${artifact.title ?? ""} ${artifact.text}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => (w.length >= 4 && w.length <= 24 && !NOISE.has(w) && !/^\d/.test(w) ? w : ""));

  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (!word) continue;
    out.push(word);
    const next = words[i + 1];
    if (next) out.push(`${word} ${next}`);
  }
  return out;
}

/**
 * The few words that show up across this person's artifacts and not everywhere
 * else — what they are the go-to *for*, in the corpus's own vocabulary.
 *
 * Two filters do the real work. A word has to appear in more than one of their
 * artifacts, so a single vivid noun from one message ("dramatic", "docx") does
 * not become somebody's specialism; and it has to appear in more than one
 * artifact corpus-wide, so a typo cannot be maximally distinctive.
 */
function distinctive(
  index: CorpusIndex,
  person: Person,
  events: Event[],
  exclude: string[] = [],
  k = 3,
): string[] {
  const df = documentFrequency(index);
  const n = Math.max(1, index.artifacts.length);
  const seen = new Set<string>();
  const tf = new Map<string, number>();
  const spread = new Map<string, number>();

  for (const event of events) {
    // What *they* said, not the whole ticket their one line sits in. Scoring a
    // person's subject matter off every artifact they appear in gives the
    // person who appears in everything no subject matter at all.
    const key = `${event.artifact.id}:${event.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const own = event.artifact.author === person.name;
    const here = new Set<string>();
    for (const token of tokens({
      ...event.artifact,
      title: own ? event.artifact.title : undefined,
      text: event.artifact.text.slice(event.start, event.end),
    })) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
      here.add(token);
    }
    for (const token of here) spread.set(token, (spread.get(token) ?? 0) + 1);
  }

  const names = personWords(index);
  const scored = [...tf.entries()]
    .filter(
      ([token]) =>
        (df.get(token) ?? 0) >= 2 &&
        !token.split(" ").some((w) => names.has(w) || exclude.some((e) => e.length > 3 && w.startsWith(e))),
    )
    .map(([token, freq]) => ({
      token,
      spread: spread.get(token) ?? 0,
      // Pairs say more than words, and are rarer, so they need the nudge to
      // outrank the single words they are made of.
      score: freq * Math.log(n / (df.get(token) ?? 1)) * (token.includes(" ") ? 1.6 : 1),
    }))
    .sort((a, b) => b.score - a.score);

  // Only subjects they returned to more than once. Padding the list out of a
  // single message gives "answers questions about afternoon and transcript",
  // and a reason line that is visibly guessing costs more than a short one.
  const pool = scored.filter((t) => t.spread >= 2);

  // Never say "extraction" next to "clause extraction".
  const chosen: string[] = [];
  for (const { token } of pool) {
    if (chosen.length >= k) break;
    if (chosen.some((c) => c.includes(token) || token.includes(c))) continue;
    chosen.push(token);
  }
  return chosen;
}

/* ── where a role's work happens ───────────────────────────────────────── */

function channelKey(artifact: Artifact): string {
  return artifact.channel ?? `kind:${artifact.kind}`;
}

/**
 * How much each channel belongs to this role, from 0 to 1.
 *
 * Two signals, both facts about the corpus: the channel's own name matching the
 * role title (`#legal-eng` for a Legal Engineer), and how much of its recent
 * traffic talks about the role's words. A corpus with one `#imported` channel —
 * which is what a pasted export looks like — comes out flat, and whosWho then
 * ranks on behaviour alone, which is the honest answer for that input.
 */
function channelAffinity(index: CorpusIndex, terms: string[], now: Date): Map<string, number> {
  const scores = new Map<string, number>();
  if (!terms.length) return scores;

  for (const artifact of index.artifacts) {
    const key = channelKey(artifact);
    if (!scores.has(key)) scores.set(key, 0);
    if (mentionsTopic(artifact, terms)) {
      scores.set(key, scores.get(key)! + recencyWeight(artifact.timestamp, now));
    }
  }

  for (const key of [...scores.keys()]) {
    const name = key.toLowerCase();
    // A channel named after the role is about the role, however it is spelled:
    // "#legal-eng" for "Legal Engineer".
    if (terms.some((t) => name.includes(t) || (t.length > 4 && name.includes(t.slice(0, 4))))) {
      scores.set(key, scores.get(key)! + 3);
    }
  }

  const best = Math.max(...scores.values(), 0);
  if (best <= 0) return new Map();
  return new Map([...scores].map(([k, v]) => [k, Math.min(1, v / best)]));
}
