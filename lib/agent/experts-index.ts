/**
 * The behavioural index: who spoke, inside whose conversation, and who they named.
 *
 * `experts.ts` says what the signals mean. This file is the part that has to
 * survive contact with a real corpus, where none of that is labelled: an
 * ingested Slack export is a flat list of messages with no thread ids (the
 * parser keeps `thread_ts` only long enough to order replies and then drops it,
 * because `Artifact` has nowhere to put it), no mention markup that survived
 * normalisation, and no roster beyond "these names posted things".
 *
 * So conversations are reconstructed, conservatively, from three things that
 * are actually present in the text:
 *
 *   1. An explicit reply marker — the seed corpus writes `(thread)`, and chat
 *      exports pasted by hand usually keep something like it.
 *   2. Inline comment lines inside tickets, docs and meeting notes
 *      (`  priya — this also killed the overnight eval run`). Half the real
 *      answering in any corpus happens here rather than in chat, and the line
 *      is a verbatim substring of the artifact, so it cites cleanly.
 *   3. Proximity to a *question*: a message posted in the same channel shortly
 *      after somebody else asked something. Not "posted after any message" —
 *      that turns a busy channel into one long thread where everyone is
 *      answering, which is exactly the volume weighting we are trying to avoid.
 *
 * Everything here is deliberately biased towards missing a signal rather than
 * inventing one. A missed signal costs us a name in a list; an invented one
 * sends a stuck new hire to somebody who has never touched the thing.
 */

import type { Artifact, Company, Person } from "@/lib/types";

/* ── tunables ──────────────────────────────────────────────────────────── */

/** How long after a question a message can still be read as answering it. */
const ANSWER_WINDOW_MS = 3 * 60 * 60 * 1000;
/** How far back an explicit `(thread)` reply may look for its root. */
const THREAD_ROOT_MAX_MS = 48 * 60 * 60 * 1000;

/** Explicit reply markers, as they survive an export or a paste. */
const REPLY_MARKER = /^\s*(?:\(thread\)|\(in thread\)|\[thread\]|↳|>{1,2}\s*re:)\s*/i;

/**
 * A line that is somebody else speaking inside somebody else's artifact:
 * `  priya — the follow-a-cross-reference part is the expensive bit`.
 * The name has to resolve to a real person on the roster, so a stray
 * `note - remember to` line resolves to nobody and is ignored.
 */
const COMMENT_LINE = /^[ \t>*-]*([\p{L}][\p{L}\p{M}'.\-]{1,30})\s*(?:[—–]|-{1,2}|:)\s+(?=\S)/u;

/** Question-shaped without necessarily carrying a question mark. */
const QUESTION_OPENERS =
  /\b(?:who owns|who is|who's|who has|whos|anyone know|does anyone|anybody know|can someone|could someone|can anyone|any idea|what do i|what should|how do i|how does|how should|where do i|where is|why does|is there a|should we|do we have|thoughts\?|halp|help me)\b/i;

/** The author committing to the work, in the first person. */
const FIRST_PERSON_COMMIT =
  /\b(?:i(?:'| a)?m|i)\s+(?:going to\s+|gonna\s+|will\s+|'ll\s+)?(?:tak(?:e|ing)|own(?:ing)?|writ(?:e|ing)|do(?:ing)?|ship(?:ping)?|handl(?:e|ing)|driv(?:e|ing)|lead(?:ing)?|run(?:ning)?|fix(?:ing)?|pick(?:ing)? up)\b|\bi'll\b|\bi will\b|\bwe(?:'| a)?re (?:going to|not) \b|\bnot shipping\b|\bdecision:\b|\bwe decided\b|\bhard no\b/i;

/**
 * A line that opens with a decision verb: `approving all 7`, `NOT shipping: a
 * keyword list`, `rolled back to 4.1.13`.
 *
 * Without this, the person who unilaterally decides something and announces it
 * in one message — which is what owning an area looks like from the outside —
 * scores nothing at all, because nobody replied and nobody had to ask them.
 */
const DECISION_LINE =
  /(?:^|\n|[.!?]\s+|:\s*)\s*(?:not\s+)?(?:approv(?:ing|ed)|shipping|shipped|merg(?:ing|ed)|deploy(?:ing|ed)|roll(?:ing|ed)\s+back|revert(?:ing|ed)|reject(?:ing|ed)|clos(?:ing|ed)|pin(?:ning|ned))\b/i;

/** `assignee: marta`, `owner = nina`, `reviewer: priya`, `maintained by X`. */
const ASSIGN_BEFORE =
  /(?:assignee|assigned to|owner|owned by|reviewer|maintainer|maintained by|dri|lead|responsible)\s*(?:[:=]|\bby\b)?\s*$/i;
/**
 * `johan taking it`, `marta reworking the retrieval step`, `priya to take the
 * cross-ref one`, `johan wrote the instructions`.
 *
 * The gerund case is the one that earns its keep: minutes and retros record who
 * is doing what in exactly this shape, and it is the closest thing an ingested
 * corpus has to an `owns` field.
 */
const ASSIGN_AFTER =
  /^\s*(?:is\s+|has\s+|are\s+|had\s+)?(?:[a-z]{3,}ing\b|took|owns|owned|led|drove|reads|wrote|built|shipped|to\s+(?:take|own|write|do|run|fix|read|lead|present|raise|chase|sort|dig)\b)/i;
/** `ask priya`, `check with tobias`, `route it to marta`. */
const ROUTE_BEFORE =
  /\b(?:ask|asking|check with|talk to|speak to|go to|route(?:d| it)? to|escalate to|ping|defer to|see)\s+$/i;

/**
 * First names too common in English to use as a bare alias. Matching "will" or
 * "mark" as a colleague is not a small error — it invents evidence.
 */
const RISKY_FIRST_NAMES = new Set([
  "will", "mark", "grace", "rose", "art", "bill", "hope", "may", "june", "june",
  "sky", "faith", "joy", "dawn", "summer", "victor", "max", "chase", "case",
]);

/* ── shapes ────────────────────────────────────────────────────────────── */

/**
 * One span of one artifact, spoken by one person, inside one conversation.
 *
 * A plain Slack message is a single utterance covering the whole text. A ticket
 * with four comments is five: the body, plus one per commenter. Spans are
 * offsets into `artifact.text` so every quote taken from one is a literal
 * substring by construction, not by hope.
 */
export type Utterance = {
  artifact: Artifact;
  /** Index into `CorpusIndex.people`. -1 when the speaker is not on the roster. */
  speaker: number;
  /** Id of the artifact that opened this conversation. */
  threadId: string;
  /** Who opened it, as a roster index. -1 if unknown. */
  threadAuthor: number;
  /** True when this is a reply rather than the thing being replied to. */
  isReply: boolean;
  /** True for the artifact's own body — the span a title belongs to. */
  isHead: boolean;
  /** True when the root was question-shaped — a reply to it is an answer. */
  answersQuestion: boolean;
  /** Offset of the ownership/decision statement in `artifact.text`, if any. */
  decidesAt?: number;
  /** Question-shaped itself. */
  asks: boolean;
  start: number;
  end: number;
};

/** Somebody else's name appearing inside an utterance, and how it was used. */
export type Reference = {
  utterance: Utterance;
  /** Roster index of the person being referred to. */
  person: number;
  /** Offsets into `artifact.text`. */
  start: number;
  end: number;
  kind: "named" | "decided" | "mentioned";
};

export type CorpusIndex = {
  people: Person[];
  artifacts: Artifact[];
  utterances: Utterance[];
  references: Reference[];
  byArtifactId: Map<string, Artifact>;
  /** Utterances that belong to a given artifact, in document order. */
  byArtifact: Map<string, Utterance[]>;
};

/* ── building it ───────────────────────────────────────────────────────── */

const CACHE = new WeakMap<Company, CorpusIndex>();

/** Index a company once. Cached on the company object — corpora are immutable here. */
export function buildIndex(company: Company): CorpusIndex {
  const hit = CACHE.get(company);
  if (hit) return hit;
  const built = index(company);
  CACHE.set(company, built);
  return built;
}

function index(company: Company): CorpusIndex {
  const people = company.people ?? [];
  const artifacts = [...(company.artifacts ?? [])].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  const byArtifactId = new Map(artifacts.map((a) => [a.id, a]));
  const aliases = buildAliases(people);
  const authorIndex = buildAuthorIndex(people, aliases);

  const utterances: Utterance[] = [];
  const byArtifact = new Map<string, Utterance[]>();

  /** Most recent messages per channel, oldest last — for reply reconstruction. */
  const recent = new Map<string, Artifact[]>();

  for (const artifact of artifacts) {
    const channel = artifact.channel ?? `kind:${artifact.kind}`;
    const history = recent.get(channel) ?? [];
    const speaker = authorIndex(artifact.author);

    const marker = artifact.text.match(REPLY_MARKER);
    const bodyStart = marker ? marker[0].length : 0;
    const segments = splitComments(artifact, bodyStart, aliases);

    const root = findRoot(artifact, history, Boolean(marker), speaker, authorIndex);
    const rootAsks = root.artifact === artifact ? isQuestion(artifact.text) : isQuestion(root.artifact.text);

    const head: Utterance = {
      artifact,
      speaker,
      threadId: root.artifact.id,
      threadAuthor: authorIndex(root.artifact.author),
      isReply: root.artifact !== artifact,
      isHead: true,
      answersQuestion: root.artifact !== artifact && rootAsks,
      decidesAt: statesOwnership(artifact, artifact.text, bodyStart, segments.headEnd),
      asks: isQuestion(artifact.text.slice(bodyStart, segments.headEnd)),
      start: bodyStart,
      end: segments.headEnd,
    };
    utterances.push(head);

    const mine: Utterance[] = [head];
    for (const comment of segments.comments) {
      const body = artifact.text.slice(comment.start, comment.end);
      const utterance: Utterance = {
        artifact,
        speaker: comment.person,
        // A comment lives in the artifact it was written on, whatever thread
        // that artifact itself belongs to. Two comments by the same person on
        // one ticket are one act of answering, not two.
        threadId: artifact.id,
        threadAuthor: speaker,
        isHead: false,
        isReply: true,
        answersQuestion: true,
        decidesAt: statesOwnership(artifact, artifact.text, comment.start, comment.end),
        asks: isQuestion(body),
        start: comment.start,
        end: comment.end,
      };
      utterances.push(utterance);
      mine.push(utterance);
    }

    byArtifact.set(artifact.id, mine);
    history.push(artifact);
    recent.set(channel, history);
  }

  const references = collectReferences(utterances, aliases);

  return { people, artifacts, utterances, references, byArtifactId, byArtifact };
}

/* ── conversations ─────────────────────────────────────────────────────── */

type Root = { artifact: Artifact };

/**
 * What this utterance is replying to, if anything.
 *
 * An explicit marker looks back for the last non-reply in the channel. Without
 * one we only accept a *question* as a root, and only inside a few hours — the
 * difference between "answered someone" and "also talks in this channel".
 */
function findRoot(
  artifact: Artifact,
  history: Artifact[],
  explicit: boolean,
  speaker: number,
  authorIndex: (name: string) => number,
): Root {
  const at = Date.parse(artifact.timestamp);

  if (explicit) {
    for (let i = history.length - 1; i >= 0 && i > history.length - 200; i--) {
      const candidate = history[i]!;
      if (REPLY_MARKER.test(candidate.text)) continue;
      const gap = at - Date.parse(candidate.timestamp);
      if (Number.isFinite(gap) && gap > THREAD_ROOT_MAX_MS) break;
      return { artifact: candidate };
    }
    return { artifact };
  }

  // Slack only. A doc or a ticket is not a reply to the doc above it.
  if (artifact.kind !== "slack") return { artifact };

  for (let i = history.length - 1; i >= 0; i--) {
    const candidate = history[i]!;
    const gap = at - Date.parse(candidate.timestamp);
    if (!Number.isFinite(gap) || gap > ANSWER_WINDOW_MS) break;
    if (authorIndex(candidate.author) === speaker && speaker !== -1) continue;
    if (!isQuestion(candidate.text)) continue;
    return { artifact: candidate };
  }
  return { artifact };
}

type Comment = { person: number; start: number; end: number };

/**
 * Split an artifact into its body and any inline comments attributed to a
 * person on the roster. Offsets, so quotes stay verbatim.
 */
function splitComments(
  artifact: Artifact,
  bodyStart: number,
  aliases: AliasTable,
): { headEnd: number; comments: Comment[] } {
  const text = artifact.text;
  const comments: Comment[] = [];
  let headEnd = text.length;

  let offset = 0;
  for (const line of text.split("\n")) {
    const lineStart = offset;
    offset += line.length + 1;
    if (lineStart < bodyStart) continue;

    const match = line.match(COMMENT_LINE);
    if (!match) continue;
    const person = aliases.lookup(match[1]!);
    if (person === -1) continue;

    if (comments.length === 0) headEnd = lineStart;
    else comments[comments.length - 1]!.end = lineStart;
    comments.push({ person, start: lineStart, end: text.length });
  }

  return { headEnd: Math.max(bodyStart, headEnd), comments };
}

/* ── who is being talked about ─────────────────────────────────────────── */

function collectReferences(utterances: Utterance[], aliases: AliasTable): Reference[] {
  const out: Reference[] = [];

  for (const utterance of utterances) {
    const text = utterance.artifact.text;
    const span = text.slice(utterance.start, utterance.end);
    for (const found of aliases.scan(span)) {
      const start = utterance.start + found.start;
      const end = utterance.start + found.end;
      const before = text.slice(Math.max(0, start - 32), start);
      const after = text.slice(end, end + 32);

      let kind: Reference["kind"] = "mentioned";
      if (ASSIGN_BEFORE.test(before) || ASSIGN_AFTER.test(after)) kind = "decided";
      else if (ROUTE_BEFORE.test(before)) kind = "named";
      // "Named by someone else asking" means named *in the question*. A long
      // document with a question mark somewhere in it is not somebody asking
      // for a person, and a checklist of questions would otherwise make every
      // name in it a routing signal.
      else if (isQuestion(clause(text, start, end))) kind = "named";

      out.push({ utterance, person: found.person, start, end, kind });
    }
  }

  return out;
}

/* ── names ─────────────────────────────────────────────────────────────── */

type Found = { person: number; start: number; end: number };

type AliasTable = {
  lookup(token: string): number;
  scan(text: string): Found[];
};

/**
 * Full names, handles, and first names where the first name is unambiguous.
 *
 * Bare surnames are deliberately not aliases: "Park", "Berg" and "Alm" are all
 * surnames on the seeded roster and all ordinary English words, and a corpus
 * where "park" counts as a mention of Ji-won is worse than one where nothing
 * counts at all.
 */
function buildAliases(people: Person[]): AliasTable {
  const byToken = new Map<string, number | "ambiguous">();

  const add = (token: string, person: number) => {
    const key = token.toLowerCase();
    if (key.length < 3) return;
    const existing = byToken.get(key);
    if (existing === undefined) byToken.set(key, person);
    else if (existing !== person) byToken.set(key, "ambiguous");
  };

  people.forEach((person, i) => {
    const name = (person.name ?? "").trim();
    if (name) add(name, i);
    const handle = (person.slackHandle ?? "").replace(/^@+/, "").trim();
    if (handle) add(handle, i);
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0];
    if (first && first.length >= 3 && !RISKY_FIRST_NAMES.has(first.toLowerCase())) add(first, i);
  });

  const tokens = [...byToken.entries()]
    .filter(([, v]) => v !== "ambiguous")
    .map(([k]) => k)
    // Longest first so "Johan Lindqvist" wins over "johan".
    .sort((a, b) => b.length - a.length);

  const pattern = tokens.length
    ? new RegExp(`@?(?<![\\p{L}\\p{M}])(?:${tokens.map(escapeRe).join("|")})(?![\\p{L}\\p{M}])`, "giu")
    : undefined;

  return {
    lookup(token: string): number {
      const hit = byToken.get(token.trim().replace(/^@+/, "").toLowerCase());
      return typeof hit === "number" ? hit : -1;
    },
    scan(text: string): Found[] {
      if (!pattern) return [];
      const out: Found[] = [];
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(text))) {
        const raw = m[0].replace(/^@+/, "");
        const person = byToken.get(raw.toLowerCase());
        if (typeof person === "number") {
          out.push({ person, start: m.index + (m[0].length - raw.length), end: m.index + m[0].length });
        }
      }
      return out;
    },
  };
}

/** Author name → roster index, tolerant of handles and of nothing matching. */
function buildAuthorIndex(people: Person[], aliases: AliasTable): (name: string) => number {
  const exact = new Map<string, number>();
  people.forEach((p, i) => {
    if (p.name) exact.set(p.name.trim().toLowerCase(), i);
    if (p.slackHandle) exact.set(p.slackHandle.replace(/^@+/, "").toLowerCase(), i);
  });
  const cache = new Map<string, number>();
  return (name: string): number => {
    const key = (name ?? "").trim().toLowerCase();
    if (!key) return -1;
    const memo = cache.get(key);
    if (memo !== undefined) return memo;
    const hit = exact.get(key) ?? aliases.lookup(key);
    cache.set(key, hit);
    return hit;
  };
}

/* ── shapes of speech ──────────────────────────────────────────────────── */

export function isQuestion(text: string): boolean {
  return text.includes("?") || QUESTION_OPENERS.test(text);
}

/** The sentence or line a span sits in — the unit "asking" is measured over. */
function clause(text: string, start: number, end: number): string {
  let from = 0;
  for (const boundary of ["\n", ". ", "? ", "! "]) {
    const at = text.lastIndexOf(boundary, start);
    if (at !== -1) from = Math.max(from, at + boundary.length);
  }
  let to = text.length;
  for (const boundary of ["\n", ". ", "? ", "! "]) {
    const at = text.indexOf(boundary, end);
    if (at !== -1) to = Math.min(to, at + 1);
  }
  return text.slice(from, to);
}

/**
 * Where in this span does the speaker state ownership or a decision?
 *
 * Writing the reference document for an area counts: nobody writes the Italian
 * drafting note for a jurisdiction they do not own, and in a corpus with no
 * `owns` field it is the clearest ownership statement available.
 *
 * A QUESTION IS NOT AN OWNERSHIP STATEMENT.
 *
 * `FIRST_PERSON_COMMIT` matches "i run", "i do", "i take" — and "how do i run
 * the eval harness?" and "what do i do when an extraction is off?" contain
 * exactly those. Without the guard below, the *newcomer asking* is scored as
 * having decided the thing they are stuck on, and `rankExperts` can then hand
 * their own question back to the next person as the evidence that they own it.
 * That is the failure this whole file is biased against: a missed signal costs
 * a name in a list, an invented one sends a stuck hire to somebody who has
 * never touched the thing. It does not fire anywhere in the seeded corpus; it
 * fires immediately on a pasted export, which is the path a customer tries
 * first.
 */
function statesOwnership(
  artifact: Artifact,
  text: string,
  start: number,
  end: number,
): number | undefined {
  const span = text.slice(start, end);
  const commit = span.match(FIRST_PERSON_COMMIT) ?? span.match(DECISION_LINE);
  if (commit?.index !== undefined) {
    const at = start + commit.index;
    return isQuestion(clause(text, at, at + commit[0].length)) ? undefined : at;
  }
  if (artifact.kind === "doc" && span.length > 200) return start;
  return undefined;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
