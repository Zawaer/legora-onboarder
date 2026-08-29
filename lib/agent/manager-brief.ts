/**
 * The manager brief — the one message that goes to the hiring manager ~48 hours
 * before someone starts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS AND NOT ANOTHER SCREEN FOR THE HIRE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The largest documented return in onboarding research is not a portal, a
 * checklist or a welcome pack. It is a short, just-in-time nudge to the
 * *manager* before the start date — and separately, buddy contact frequency,
 * which tracks ramp success monotonically from roughly half to nearly all of a
 * cohort as meetings go from one to eight in ninety days.
 *
 * Both interventions have the same precondition: a human with a spare hour who
 * notices a start date and acts on it. Legora is putting 58 people through
 * September across nine offices; the buddy sheet was 60% full a week before the
 * cohort landed, and the three joiners from the previous cohort were "all still
 * mostly shadowing". Nobody is neglecting this. There is simply no such human.
 *
 * So this file is that human, and it fires on a clock rather than on attention.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS COMPOSITION AND NOT A MODEL CALL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every input this brief needs has already been derived: `DerivedRole` (with
 * its ground-verified citations and its open questions), `RampPlan` (with the
 * first real task and who each task escalates to), and the roster. A second
 * generation would re-derive what we already paid for, and would do it at the
 * worst possible moment — this thing has to fire unattended, on a schedule, at
 * 03:00 two days before a start date, for tens of people a month. A composed brief
 * is free, instant, deterministic, and diffable in review.
 *
 * The decisive argument is not cost though, it is fabrication surface. A model
 * asked "who should the buddy be" will always answer, fluently, including when
 * the corpus does not support an answer — and then `ground.ts` has to catch it
 * after the fact. Selecting a person and a quote *out of* the corpus by index
 * cannot invent a name or a sentence: the quote is a slice of an artifact we
 * are holding. We still run every citation through `groundEvidence` before it
 * leaves this module, because a substring bug in `bestQuote` would be exactly
 * the class of error that check exists to catch, and this module should not be
 * trusted more than the model is.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE REFUSES TO DO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. It never scores or ranks a person. The manager screen bans that, the
 *    blocker type bans it, the drift note bans it — and a brief that says
 *    "best buddy match: 0.87" would be the loophole that reintroduces it in the
 *    one document a manager actually reads. Ordering candidates is unavoidable
 *    (something has to come first), so the ordering lives entirely inside
 *    `orderCandidates` as local numbers, no exported type carries a score, and
 *    nothing numeric about a person reaches the wire or the page. What the
 *    reader sees is what the person does and where they did it.
 *
 * 2. It never names a person it cannot cite. No evidence, no item — the whole
 *    item, not a hedged version of it. A manager who follows one confident bad
 *    suggestion does not open the next brief, and there will be forty more.
 *
 * 3. It never fills a gap with plausible text. No plan, no derived role, a
 *    company with one person, no buddy who passes all three tests: the brief
 *    says so in a sentence and moves on. `gaps` is a first-class field for the
 *    same reason `DerivedRole.openQuestions` is.
 */

import type {
  Artifact,
  Company,
  DerivedRole,
  Evidence,
  HireState,
  Person,
  RampPlan,
  RampTask,
} from "@/lib/types";
import { groundEvidence } from "@/lib/agent/ground";

/** How far ahead of the start date this is meant to land. Google's finding. */
export const BRIEF_LEAD_HOURS = 48;

/** Five is the cap in the spec and also roughly the cap on a manager's memory. */
const MAX_MEET = 5;

/**
 * The undecided list is capped in the *message* even though the page shows all
 * of them. Eight open questions reads as a document; four reads as a decision
 * list, and a brief that reads as a document does not get read at all.
 */
const MAX_UNDECIDED_IN_MESSAGE = 4;

// ────────────────────────────────────────────────────────────────── the shape

/** A citation, plus the display metadata a reader needs to believe it. */
export type BriefCitation = Evidence & {
  author: string;
  /** Slack channel or doc location. Falls back to the artifact kind. */
  where: string;
  kind: Artifact["kind"];
  /** ISO 8601, from the artifact. */
  at: string;
};

export type BuddyPick = {
  name: string;
  slackHandle: string;
  role: string;
  team: string;
  /** The `owns` entries that overlap what this hire is about to do. */
  overlaps: string[];
  /** Where they do that work, in their own words. */
  worksOn: BriefCitation;
  /** Where they answered somebody else about it. */
  answers: BriefCitation;
  /** Who they were replying to, so "answers questions" is checkable. */
  answeredWhom: string;
  /** True when the message they replied to was itself a question. */
  answeredAQuestion: boolean;
  /** What the corpus says about them already carrying somebody. Plain. */
  loadNote: string;
  /**
   * True when this person also wrote the worked example in section 3. Worth a
   * line of its own: the manager is being told to pair the hire with the author
   * of the document the hire is about to copy the method from.
   */
  wroteTheWorkedExample: boolean;
};

/**
 * The person who was the obvious pick and was passed over, with the reason in
 * the company's own words.
 *
 * This is the most persuasive part of the brief and it is also the honest part:
 * a manager reading "buddy: Marta" immediately thinks "why not Johan", and the
 * answer is usually a sentence they wrote themselves last week.
 */
export type PassedOver = {
  name: string;
  slackHandle: string;
  reason: string;
  /** One or two sentences, theirs or their manager's. Never more. */
  citations: BriefCitation[];
};

export type MeetPick = {
  name: string;
  slackHandle: string;
  role: string;
  /** One line. Specific to this hire's first week, never "to say hello". */
  reason: string;
  citation: BriefCitation;
};

export type WorkedExample = {
  artifactId: string;
  title: string;
  author: string;
  where: string;
  at: string;
  /** Why this is the closest prior thing to what they are being asked to do. */
  whyItIsTheExample: string;
  citation: BriefCitation;
};

export type FirstTaskBlock = {
  taskId: string;
  day: 1 | 2;
  /** 1-based position within the day, so "day 1, task 2" is checkable. */
  position: number;
  title: string;
  why: string;
  doneWhen: string;
  askIfStuck: string;
  estimateMins: number;
  /** Null when nothing in the corpus is close enough to call an example. */
  workedExample: WorkedExample | null;
};

export type UndecidedItem = {
  /** First sentence of the open question. The headline. */
  headline: string;
  /** The rest of it, for the page. Empty string when there is no rest. */
  detail: string;
  citation: BriefCitation;
};

export type ManagerBrief = {
  hireId: string;
  hireName: string;
  roleTitle: string;
  companySlug: string;
  companyName: string;
  /** How many artifacts this was derived from. The reader's calibration. */
  corpusSize: number;

  /** ISO 8601. `startSource` says whether anyone actually told us this. */
  startsAt: string;
  startSource: "supplied" | "record";
  /** "Tuesday 1 September, 09:00". Locale-free and hydration-safe. */
  startsAtLabel: string;
  hoursUntilStart: number;
  generatedAt: string;

  manager: { name: string; slackHandle: string; role: string } | null;
  buddy: BuddyPick | null;
  passedOver: PassedOver | null;
  meet: MeetPick[];
  firstTask: FirstTaskBlock | null;
  undecided: UndecidedItem[];

  /** What is missing, said plainly. Never padded with invention. */
  gaps: string[];

  /** The whole thing as one Slack message. mrkdwn: *bold*, not **bold**. */
  slack: string;
};

export type ComposeOptions = {
  /**
   * When the hire actually starts. `HireState.startedAt` is the moment the
   * record was created, not a start date — the type has no field for one — so
   * a real scheduler passes it here and the brief says where the date came from
   * rather than quietly presenting a record timestamp as a start date.
   */
  startsAt?: string;
  /** Injected so the output is deterministic under test. */
  now?: Date;
};

// ────────────────────────────────────────────────────────────────── the entry

export function composeManagerBrief(
  hire: HireState,
  company: Company,
  opts: ComposeOptions = {},
): ManagerBrief {
  const now = opts.now ?? new Date();
  const gaps: string[] = [];

  const role = hire.derivedRole;
  const plan = hire.plan;

  if (!role) {
    gaps.push(
      "No derived role for this hire yet, so there is nothing here about the " +
        "work itself or about what the company has not decided. Run the derivation first.",
    );
  }
  if (!plan) {
    gaps.push(
      "No ramp plan yet, so there is no first task and no worked example to put beside it.",
    );
  }
  if (company.people.length < 2) {
    gaps.push(
      `The corpus for ${company.name} has ${company.people.length} ${
        company.people.length === 1 ? "person" : "people"
      } in it. There is nobody to nominate as a buddy and nobody to meet.`,
    );
  }

  const startsAt = opts.startsAt ?? hire.startedAt;
  const startSource: "supplied" | "record" = opts.startsAt ? "supplied" : "record";
  if (startSource === "record") {
    gaps.push(
      "No start date was supplied, so the date below is when this hire record was " +
        "created. Pass the real start date to time this brief 48 hours out.",
    );
  }

  const index = buildIndex(company);
  const terms = workTerms(role, plan, hire.roleTitle);
  const manager = findManager(company, role);

  const homeTeam = findHomeTeam(company, manager, role);

  const first = pickFirstTask(plan, hire);
  const firstTask = first ? buildFirstTask(first, index, terms, company) : null;

  // Every section draws from the same 63 artifacts, so without this the same
  // sentence turns up three times and the brief reads like it only found one
  // thing. `avoid` is a preference, not a ban: a section that has no other
  // evidence still shows the shared one rather than going blank.
  const avoid = new Set<string>();
  if (firstTask?.workedExample) avoid.add(firstTask.workedExample.artifactId);

  const buddyResult = pickBuddy(company, index, terms, manager, homeTeam, avoid);
  const buddy = buddyResult.buddy;
  const passedOver = buddyResult.passedOver;
  if (buddy) {
    avoid.add(buddy.worksOn.artifactId);
    avoid.add(buddy.answers.artifactId);
    buddy.wroteTheWorkedExample =
      firstTask?.workedExample?.author === buddy.name;
  }

  if (!buddy && company.people.length >= 2) {
    gaps.push(
      "No buddy is proposed. Nobody in the corpus both works on what this hire is " +
        "about to work on and visibly answers other people about it. Naming somebody " +
        "anyway would be a guess in a confident tone, so this is blank on purpose.",
    );
  }

  const meet = pickMeet(company, index, terms, role, plan, manager, buddy, avoid);
  if (meet.length === 0 && company.people.length >= 2) {
    gaps.push(
      "Nobody made the list of people to meet — every candidate failed the same test, " +
        "which is that the corpus does not show them doing the thing we would have " +
        "claimed they do.",
    );
  }

  const undecided = pickUndecided(role, index, company);
  if (role && role.openQuestions.length > 0 && undecided.length === 0) {
    gaps.push(
      "The derivation raised open questions but none of them could be tied back to a " +
        "specific message, so they are not repeated here.",
    );
  }

  const brief: ManagerBrief = {
    hireId: hire.id,
    hireName: hire.name,
    roleTitle: hire.roleTitle,
    companySlug: company.slug,
    companyName: company.name,
    corpusSize: company.artifacts.length,
    startsAt,
    startSource,
    startsAtLabel: formatStart(startsAt),
    hoursUntilStart: hoursBetween(now, startsAt),
    generatedAt: now.toISOString(),
    manager,
    buddy,
    passedOver,
    meet,
    firstTask,
    undecided,
    gaps,
    slack: "",
  };

  brief.slack = toSlackMessage(brief);
  return brief;
}

// ───────────────────────────────────────────────────────── the corpus index

type Indexed = {
  artifact: Artifact;
  /** Position within its own channel, so thread order is recoverable. */
  channelPos: number;
  /** True when the message is a reply rather than a thread opener. */
  isReply: boolean;
  lower: string;
};

type CorpusIndex = {
  all: Indexed[];
  byId: Map<string, Indexed>;
  byAuthor: Map<string, Indexed[]>;
  /** Channel key → messages in authored order. */
  byChannel: Map<string, Indexed[]>;
};

/**
 * A Slack export is a flat list, and the thread structure is in the text. This
 * corpus marks replies with a literal "(thread)" prefix, which is exactly the
 * convention a real export's `thread_ts` gives you for free. Either way, what
 * we need is: is this a reply, and who was talking immediately before it.
 */
const REPLY_PREFIX = /^\s*\(thread\)\s*/i;

function buildIndex(company: Company): CorpusIndex {
  const all: Indexed[] = [];
  const byId = new Map<string, Indexed>();
  const byAuthor = new Map<string, Indexed[]>();
  const byChannel = new Map<string, Indexed[]>();

  for (const artifact of company.artifacts) {
    const key = channelKey(artifact);
    const bucket = byChannel.get(key) ?? [];
    const entry: Indexed = {
      artifact,
      channelPos: bucket.length,
      isReply: REPLY_PREFIX.test(artifact.text),
      lower: `${artifact.title ?? ""} ${artifact.text}`.toLowerCase(),
    };
    bucket.push(entry);
    byChannel.set(key, bucket);
    all.push(entry);
    byId.set(artifact.id, entry);
    const authored = byAuthor.get(artifact.author) ?? [];
    authored.push(entry);
    byAuthor.set(artifact.author, authored);
  }

  return { all, byId, byAuthor, byChannel };
}

function channelKey(a: Artifact): string {
  return a.channel ?? `${a.kind}:${a.title ?? a.id}`;
}

/** The message immediately above this one in the same channel. */
function previousInThread(index: CorpusIndex, entry: Indexed): Indexed | null {
  if (!entry.isReply) return null;
  const bucket = index.byChannel.get(channelKey(entry.artifact));
  if (!bucket) return null;
  return bucket[entry.channelPos - 1] ?? null;
}

/**
 * Ask-shaped, in the way people actually write questions in Slack: often with
 * no question mark at all. Used only to *strengthen* a citation's wording
 * ("answered Anders's question" vs "replied to Anders"), never to admit or
 * reject a person — a heuristic that quiet is not allowed to gate anything.
 */
const ASK_SHAPED =
  /\?|\b(?:can (?:someone|anyone|you|we|i)|does anyone|do we|should (?:we|i|it)|is (?:there|that|this)|what (?:do|is|are|about|happens|i)|who (?:owns|is|should|can)|how (?:do|does|should|many)|why (?:do|is|are)|any (?:idea|thoughts)|anyone know|thoughts|genuine question|tell me)\b/i;

// ────────────────────────────────────────────────────────── terms & matching

const STOP = new Set([
  "the","a","an","and","or","for","to","of","in","on","with","is","are","was",
  "what","who","how","why","when","where","this","that","it","i","we","you",
  "do","does","did","can","should","would","about","from","by","at","as","be",
  "not","but","they","them","their","our","your","his","her","its","have","has",
  "had","will","one","two","all","any","been","than","then","there","here",
  "into","out","up","down","over","under","more","most","some","such","only",
  "own","same","so","just","also","after","before","while","which","because",
  "you","yours","week","day","days","first","new","get","got","make","made",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * The vocabulary of this hire's actual work.
 *
 * Deliberately built from the *derived* material — responsibilities, first-week
 * outcomes, the ramp tasks — and then the role title's own words are subtracted.
 * Without that subtraction, "Legal Engineer" makes every person at a legal
 * engineering company look like a topic match, and the recruiter who owns the
 * "legal engineering hiring pipeline" scores as a subject-matter expert.
 */
function workTerms(
  role: DerivedRole | undefined,
  plan: RampPlan | undefined,
  roleTitle: string,
): Set<string> {
  const parts: string[] = [];
  if (role) {
    parts.push(...role.responsibilities, ...role.firstWeekOutcomes, role.summary);
  }
  if (plan) {
    for (const day of plan.days) {
      for (const task of day.tasks) parts.push(task.title, task.why, task.context);
    }
  }
  const titleWords = new Set(tokens(roleTitle));
  const out = new Set<string>();
  for (const t of tokens(parts.join(" "))) if (!titleWords.has(t)) out.add(t);
  return out;
}

/**
 * Word-level match with a little morphological slack: playbook/playbooks,
 * engineer/engineering, escalation/escalations. Nothing looser — a fuzzy
 * matcher here means an "overlap" that a reader cannot see when they look.
 */
function wordMatches(word: string, term: string): boolean {
  if (word === term) return true;
  if (term.length >= 5 && word.startsWith(term)) return true;
  if (word.length >= 5 && term.startsWith(word)) return true;
  return false;
}

function hitCount(text: string, terms: Set<string>): number {
  const seen = new Set<string>();
  for (const word of tokens(text)) {
    for (const term of terms) {
      if (wordMatches(word, term)) {
        seen.add(term);
        break;
      }
    }
  }
  return seen.size;
}

/** Which of a person's stated ownerships land inside this hire's work. */
function overlappingOwnerships(person: Person, terms: Set<string>): string[] {
  return person.owns.filter((entry) => hitCount(entry, terms) > 0);
}

// ─────────────────────────────────────────────────────────── quote selection

const MAX_QUOTE_CHARS = 240;
const MIN_QUOTE_CHARS = 40;
/** Long enough to carry an argument, short enough to read without stopping. */
const IDEAL_QUOTE_CHARS = 150;

/**
 * Pick the most on-topic verbatim run out of an artifact.
 *
 * Returns a genuine substring of `artifact.text` — the window is chosen over
 * character offsets and sliced, never reassembled from split pieces, because a
 * "quote" stitched from two halves of a message is a sentence nobody wrote and
 * `ground.ts` exists to catch exactly that.
 */
function bestQuote(artifact: Artifact, terms: Set<string>, max = MAX_QUOTE_CHARS): string | null {
  const text = artifact.text;
  const bounds = sentenceBounds(text);
  if (bounds.length === 0) return null;

  let best: { start: number; end: number; hits: number; len: number } | null = null;

  for (let i = 0; i < bounds.length; i++) {
    for (let j = i; j < bounds.length; j++) {
      const start = bounds[i].start;
      const end = bounds[j].end;
      if (end - start > max) break;
      const slice = text.slice(start, end);
      if (slice.trim().length < MIN_QUOTE_CHARS) continue;
      const hits = hitCount(slice, terms);
      const len = slice.trim().length;
      // Ties go to the window nearest a comfortable reading length. Preferring
      // the *shortest* tie leaves terse fragments ("thursday. and i want to
      // actually read all 12 first.") that cite nothing a reader can use;
      // preferring the longest pads every quote out to the cap.
      if (
        best === null ||
        hits > best.hits ||
        (hits === best.hits &&
          Math.abs(len - IDEAL_QUOTE_CHARS) < Math.abs(best.len - IDEAL_QUOTE_CHARS))
      ) {
        best = { start, end, hits, len };
      }
    }
  }

  // Nothing reached the minimum length — a very short message. Take the whole
  // thing if it is still long enough to cite, otherwise cite nothing.
  if (!best) {
    const whole = text.trim();
    return whole.length >= 24 ? tidyQuoteEdges(whole) : null;
  }

  return tidyQuoteEdges(text.slice(best.start, best.end).trim());
}

/**
 * Trim the edges of a chosen window without touching the words inside it.
 *
 * Every operation here removes a prefix or a suffix, so the result is still a
 * literal substring of the artifact and still passes `groundEvidence`. What it
 * removes is debris from windowing over a structured document: the "(thread)"
 * reply marker, and an orphan list number picked up from the start of the next
 * numbered item ("… write on `playbooks`. 8.").
 */
function tidyQuoteEdges(quote: string): string {
  const ellipsis = quote.endsWith("…");
  const body = ellipsis ? quote.slice(0, -1) : quote;
  const cleaned = body
    .replace(REPLY_PREFIX, "")
    // An orphan list number dragged in from the next numbered item.
    .replace(/\s+\d{1,2}\.\s*$/, "")
    // A dangling dash or list bullet left at either edge.
    .replace(/\s*[—–\-•]\s*$/, "")
    .replace(/^\s*[•–—]\s*/, "")
    .trim();
  return ellipsis ? `${cleaned}…` : cleaned;
}

/**
 * The full sentence of `text` containing `fragment`, or null when the fragment
 * is not in this artifact at all. Matching is done on a normalised copy with an
 * index map back to the original, so the returned span is verbatim.
 */
function containingSentence(text: string, fragment: string): string | null {
  const needle = fragment.replace(/\s+/g, " ").trim().toLowerCase();
  if (needle.length < 12) return null;
  for (const b of sentenceBounds(text)) {
    const slice = text.slice(b.start, b.end);
    if (slice.replace(/\s+/g, " ").trim().toLowerCase().includes(needle)) {
      const out = slice.trim();
      return out.length <= MAX_QUOTE_CHARS ? out : null;
    }
  }
  return null;
}

function sentenceBounds(text: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1] ?? " ";
    const isBreak =
      ch === "\n" || ((ch === "." || ch === "!" || ch === "?") && /\s/.test(next));
    if (isBreak) {
      if (text.slice(start, i + 1).trim().length > 0) out.push({ start, end: i + 1 });
      start = i + 1;
    }
  }
  if (text.slice(start).trim().length > 0) out.push({ start, end: text.length });
  return out;
}

function citation(
  artifact: Artifact,
  quote: string,
  why: string,
): BriefCitation {
  return {
    artifactId: artifact.id,
    quote,
    why,
    author: artifact.author,
    where: artifact.channel ?? artifact.title ?? artifact.kind,
    kind: artifact.kind,
    at: artifact.timestamp,
  };
}

/**
 * The last gate before anything leaves this module.
 *
 * Composition should make fabrication impossible, which is precisely why this
 * runs: "should be impossible" is the state a bug hides in. Anything whose
 * quote does not verify as a literal substring of the artifact it names is
 * dropped, and the item that depended on it is dropped with it.
 */
function verify(citations: BriefCitation[], company: Company): BriefCitation[] {
  const kept = new Set(
    groundEvidence(
      citations.map(({ artifactId, quote, why }) => ({ artifactId, quote, why })),
      company,
    ).map((e) => `${e.artifactId} ${e.quote}`),
  );
  return citations.filter((c) => kept.has(`${c.artifactId} ${c.quote}`));
}

function verifyOne(c: BriefCitation | null, company: Company): BriefCitation | null {
  if (!c) return null;
  return verify([c], company)[0] ?? null;
}

// ────────────────────────────────────────────────────────────── the manager

/**
 * Who is receiving this. Derived, not configured: the person whose stated
 * ownership includes hiring or onboarding *and* who the derivation already
 * identified as central to the role. Requiring both stops a People Ops lead who
 * owns "onboarding logistics" company-wide from being handed a brief about a
 * team they do not run.
 */
function findManager(
  company: Company,
  role: DerivedRole | undefined,
): ManagerBrief["manager"] {
  if (!role) return null;
  const key = new Set(role.keyPeople.map((p) => p.name.toLowerCase()));
  const found = company.people.find(
    (p) =>
      key.has(p.name.toLowerCase()) &&
      p.owns.some((o) => /hiring|onboarding/i.test(o)),
  );
  if (!found) return null;
  return { name: found.name, slackHandle: found.slackHandle, role: found.role };
}

// ───────────────────────────────────────────────────────────── 1 · the buddy

/**
 * Phrases that mean "this person is already stretched", used only when they
 * appear in the same sentence as the person's name and were written by somebody
 * else. Deliberately narrow: "heads down" and "in the evenings" describe the
 * whole team here and would disqualify everyone, which is a filter that has
 * stopped filtering.
 */
const OVERCOMMITTED = [
  "not putting",
  "deliberately not assigning",
  "another thing on",
  "third thing on",
  "no capacity",
  "at capacity",
  "cannot staff",
  "can not staff",
  "cannot take",
  "already on",
  "already carrying",
  "too much on",
  "each taking",
  "stretched",
];

/** Words that mean the sentence is about somebody arriving. */
const NEW_START = [
  "buddy",
  "joiner",
  "new start",
  "starter",
  "onboard",
  "shadowing",
  "cohort",
  "mentor",
  "first day",
];

/** A volunteer signing up for somebody. First person, so name matching fails. */
const VOLUNTEERED = [
  "i can take",
  "ill take",
  "i'll take",
  "i can do",
  "i can host",
  "put me down",
  "ill do one",
  "i'll do one",
  "i have one",
  "ive got one",
];

type Candidate = {
  person: Person;
  overlaps: string[];
  worksOn: BriefCitation;
  answers: BriefCitation;
  answeredWhom: string;
  answeredAQuestion: boolean;
  /** Sentence, by somebody else, saying they are already stretched. */
  overcommitted: BriefCitation | null;
  /** Evidence they have already picked up a new start. */
  carryingNewStart: BriefCitation | null;
  /** Ordering inputs. Local to this module. Never exported, never rendered. */
  order: { depth: number; ownerships: number; asks: number; recency: number };
};

/**
 * The team this hire is joining, derived rather than configured: the hiring
 * manager's team, falling back to the team most of the derivation's key people
 * sit on. Used to prefer a buddy from inside the team — which is what the
 * research means by a buddy, and what stops an adjacent director with four
 * broadly-worded ownership statements from outranking the colleague who does
 * the actual work. It is a preference, not a wall: if nobody on the team
 * qualifies we would rather propose somebody one desk over than nobody.
 */
function findHomeTeam(
  company: Company,
  manager: ManagerBrief["manager"],
  role: DerivedRole | undefined,
): string | null {
  if (manager) {
    const p = company.people.find((x) => x.name === manager.name);
    if (p) return p.team;
  }
  if (!role) return null;
  const counts = new Map<string, number>();
  for (const kp of role.keyPeople) {
    const p = company.people.find((x) => x.name.toLowerCase() === kp.name.trim().toLowerCase());
    if (p) counts.set(p.team, (counts.get(p.team) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [team, c] of counts) if (c > n) ((best = team), (n = c));
  return best;
}

function pickBuddy(
  company: Company,
  index: CorpusIndex,
  terms: Set<string>,
  manager: ManagerBrief["manager"],
  homeTeam: string | null,
  avoid: ReadonlySet<string>,
): { buddy: BuddyPick | null; passedOver: PassedOver | null } {
  const candidates: Candidate[] = [];

  for (const person of company.people) {
    if (manager && person.name === manager.name) continue;

    // Test 1 — works on what this hire will work on.
    const overlaps = overlappingOwnerships(person, terms);
    if (overlaps.length === 0) continue;

    const authored = index.byAuthor.get(person.name) ?? [];
    const worksOn = pickWorksOn(authored, terms, company, avoid);
    if (!worksOn) continue;

    // Test 2 — demonstrably answers other people in that area.
    const answering = pickAnswering(authored, index, terms, company);
    if (!answering) continue;

    // Test 3 — is not already carrying somebody.
    const carrying = findNewStartLoad(person, index, company);
    const overcommitted = findOvercommitment(person, index, company);

    candidates.push({
      person,
      overlaps,
      worksOn,
      answers: answering.citation,
      answeredWhom: answering.whom,
      answeredAQuestion: answering.wasAsk,
      overcommitted,
      carryingNewStart: carrying,
      order: {
        // The strongest single thing they have written in this area — not the
        // sum over everything they have written, which elects whoever posts
        // most rather than whoever knows most.
        depth: Math.max(
          ...authored.map((a) => hitCount(a.artifact.text, terms)),
          0,
        ),
        ownerships: overlaps.length,
        asks: answering.wasAsk ? 1 : 0,
        recency: Math.max(...authored.map((a) => Date.parse(a.artifact.timestamp) || 0)),
      },
    });
  }

  if (candidates.length === 0) return { buddy: null, passedOver: null };

  const onTeam = homeTeam ? candidates.filter((c) => c.person.team === homeTeam) : [];
  const ordered = orderCandidates(onTeam.length > 0 ? onTeam : candidates);

  // Anyone already carrying a new start is out — that is the criterion, and a
  // buddy stretched across two joiners is how you get two people shadowing.
  const free = ordered.filter((c) => !c.carryingNewStart);
  // Over-commitment on other work is a softer signal, so it only excludes when
  // somebody is left standing afterwards. Otherwise it becomes a caveat.
  const pool = free.length > 0 ? free : ordered;
  const unstretched = pool.filter((c) => !c.overcommitted);
  const shortlist = unstretched.length > 0 ? unstretched : pool;

  const chosen = shortlist[0];

  // The person a manager would have picked themselves, and the sentence — their
  // own, usually — explaining why not this week.
  const obvious = ordered.find(
    (c) => c !== chosen && (c.carryingNewStart || c.overcommitted),
  );
  const passedOver: PassedOver | null = obvious
    ? {
        name: obvious.person.name,
        slackHandle: obvious.person.slackHandle,
        reason:
          obvious.carryingNewStart && obvious.overcommitted
            ? "already took a buddy slot this cohort, and is named as at their limit"
            : obvious.carryingNewStart
              ? "already took a buddy slot this cohort"
              : "named as at their limit",
        citations: [obvious.carryingNewStart, obvious.overcommitted].filter(
          (c): c is BriefCitation => c !== null,
        ),
      }
    : null;

  const loadNote = chosen.carryingNewStart
    ? `Already carrying somebody this cohort — worth checking before you ask. "${trim(
        chosen.carryingNewStart.quote,
        110,
      )}"`
    : chosen.overcommitted
      ? `Nothing in the corpus puts another new start on ${firstName(
          chosen.person.name,
        )}, but they are named as stretched: "${trim(chosen.overcommitted.quote, 110)}"`
      : `Nothing in the corpus puts another new start on ${firstName(
          chosen.person.name,
        )}, and nothing has them named as stretched. The buddy sheet itself is not in the corpus, so confirm.`;

  return {
    buddy: {
      name: chosen.person.name,
      slackHandle: chosen.person.slackHandle,
      role: chosen.person.role,
      team: chosen.person.team,
      overlaps: chosen.overlaps,
      worksOn: chosen.worksOn,
      answers: chosen.answers,
      answeredWhom: chosen.answeredWhom,
      answeredAQuestion: chosen.answeredAQuestion,
      loadNote,
      wroteTheWorkedExample: false,
    },
    passedOver,
  };
}

/**
 * Ordering, and the only place in this module where a person becomes a number.
 *
 * It exists because a list has to have a first element. The inputs are all
 * "how much of this is in the corpus", never "how good is this person", the
 * result is a permutation rather than a value, and none of it crosses this
 * function's boundary. If you ever find yourself wanting to return one of these
 * numbers, that is the moment this product became a scoreboard.
 */
function orderCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => {
    if (b.order.depth !== a.order.depth) return b.order.depth - a.order.depth;
    if (b.order.ownerships !== a.order.ownerships) return b.order.ownerships - a.order.ownerships;
    if (b.order.asks !== a.order.asks) return b.order.asks - a.order.asks;
    if (b.order.recency !== a.order.recency) return b.order.recency - a.order.recency;
    return a.person.name.localeCompare(b.person.name);
  });
}

/** The most on-topic thing this person wrote. */
function pickWorksOn(
  authored: Indexed[],
  terms: Set<string>,
  company: Company,
  avoid: ReadonlySet<string> = new Set(),
): BriefCitation | null {
  return worksOnFrom(authored, terms, company, avoid) ?? worksOnFrom(authored, terms, company, new Set());
}

function worksOnFrom(
  authored: Indexed[],
  terms: Set<string>,
  company: Company,
  avoid: ReadonlySet<string>,
): BriefCitation | null {
  const scored = authored
    .filter((entry) => !avoid.has(entry.artifact.id))
    .map((entry) => ({ entry, hits: hitCount(entry.artifact.text, terms) }))
    .filter((s) => s.hits > 0)
    .sort(
      (a, b) =>
        b.hits - a.hits ||
        (Date.parse(b.entry.artifact.timestamp) || 0) -
          (Date.parse(a.entry.artifact.timestamp) || 0),
    );

  for (const { entry } of scored) {
    const quote = bestQuote(entry.artifact, terms);
    if (!quote) continue;
    const c = verifyOne(
      citation(entry.artifact, quote, "Their own work in the area this hire is landing in."),
      company,
    );
    if (c) return c;
  }
  return null;
}

/**
 * A reply to somebody else, in this area. Answering-shaped, not talking-shaped:
 * the whole point is that volume weighting elects whoever posts most, and this
 * has to elect whoever other people are getting answers from.
 */
function pickAnswering(
  authored: Indexed[],
  index: CorpusIndex,
  terms: Set<string>,
  company: Company,
): { citation: BriefCitation; whom: string; wasAsk: boolean } | null {
  const replies = authored
    .filter((entry) => entry.isReply && entry.artifact.text.trim().length >= 80)
    .map((entry) => ({ entry, prev: previousInThread(index, entry) }))
    .filter(
      (r): r is { entry: Indexed; prev: Indexed } =>
        r.prev !== null && r.prev.artifact.author !== r.entry.artifact.author,
    )
    .map((r) => ({
      ...r,
      hits: hitCount(r.entry.artifact.text, terms),
      wasAsk: ASK_SHAPED.test(r.prev.artifact.text),
    }))
    .filter((r) => r.hits > 0)
    // Answering an actual question beats replying in a discussion, then
    // on-topic density, then recency.
    .sort(
      (a, b) =>
        Number(b.wasAsk) - Number(a.wasAsk) ||
        b.hits - a.hits ||
        (Date.parse(b.entry.artifact.timestamp) || 0) -
          (Date.parse(a.entry.artifact.timestamp) || 0),
    );

  for (const r of replies) {
    const quote = bestQuote(r.entry.artifact, terms);
    if (!quote) continue;
    const c = verifyOne(
      citation(
        r.entry.artifact,
        quote,
        `Replying to ${r.prev.artifact.author} in ${
          r.entry.artifact.channel ?? r.entry.artifact.kind
        }.`,
      ),
      company,
    );
    if (c) return { citation: c, whom: r.prev.artifact.author, wasAsk: r.wasAsk };
  }
  return null;
}

/** Sentences, written by somebody else, that put this person on a new start. */
function findNewStartLoad(
  person: Person,
  index: CorpusIndex,
  company: Company,
): BriefCitation | null {
  const named = findSentenceAbout(person, index, NEW_START, company, [
    "buddy",
    "joiner",
    "shadow",
    "onboard",
  ]);
  if (named) return named;

  // The first-person case: somebody volunteering in a thread that is about
  // onboarding. Their own name never appears, so name matching cannot see it.
  for (const entry of index.byAuthor.get(person.name) ?? []) {
    const lower = entry.artifact.text.toLowerCase();
    if (!VOLUNTEERED.some((v) => lower.includes(v))) continue;
    const prev = previousInThread(index, entry);
    const context = `${prev?.lower ?? ""} ${lower}`;
    if (!NEW_START.some((w) => context.includes(w))) continue;
    const quote = bestQuote(entry.artifact, new Set(tokens(NEW_START.join(" "))), 180);
    if (!quote) continue;
    const c = verifyOne(
      citation(
        entry.artifact,
        quote,
        `${firstName(person.name)} volunteered for somebody in this cohort.`,
      ),
      company,
    );
    if (c) return c;
  }
  return null;
}

/** Sentences, written by somebody else, that say this person is at their limit. */
function findOvercommitment(
  person: Person,
  index: CorpusIndex,
  company: Company,
): BriefCitation | null {
  return findSentenceAbout(person, index, OVERCOMMITTED, company, []);
}

/**
 * Find a sentence that names this person and contains one of `phrases`, written
 * by anybody else. Returns the sentence verbatim so a reader can check it.
 */
function findSentenceAbout(
  person: Person,
  index: CorpusIndex,
  phrases: string[],
  company: Company,
  requireAlso: string[],
): BriefCitation | null {
  const first = firstName(person.name).toLowerCase();
  const handle = person.slackHandle.toLowerCase();
  const matches: Array<{ artifact: Artifact; quote: string }> = [];

  for (const entry of index.all) {
    if (entry.artifact.author === person.name) continue;
    for (const b of sentenceBounds(entry.artifact.text)) {
      const raw = entry.artifact.text.slice(b.start, b.end);
      const sentence = raw.toLowerCase();
      const namesThem =
        new RegExp(`\\b${escapeRegExp(first)}\\b`).test(sentence) ||
        sentence.includes(handle);
      if (!namesThem) continue;
      if (!phrases.some((p) => sentence.includes(p))) continue;
      if (requireAlso.length > 0 && !requireAlso.some((p) => sentence.includes(p))) continue;
      const quote = raw.trim();
      if (quote.length < 24) continue;
      matches.push({ artifact: entry.artifact, quote: trim(quote, MAX_QUOTE_CHARS) });
    }
  }

  for (const m of matches) {
    // `trim` may have added an ellipsis, which is no longer a substring. Only
    // cite the untruncated sentence.
    if (m.quote.endsWith("…")) continue;
    const c = verifyOne(
      citation(m.artifact, m.quote, `Written about ${firstName(person.name)} by somebody else.`),
      company,
    );
    if (c) return c;
  }
  return null;
}

// ────────────────────────────────────────────────────── 2 · people to meet

function pickMeet(
  company: Company,
  index: CorpusIndex,
  terms: Set<string>,
  role: DerivedRole | undefined,
  plan: RampPlan | undefined,
  manager: ManagerBrief["manager"],
  buddy: BuddyPick | null,
  avoid: Set<string>,
): MeetPick[] {
  const byName = new Map(company.people.map((p) => [p.name.toLowerCase(), p]));
  const skip = new Set<string>();
  if (manager) skip.add(manager.name.toLowerCase());
  if (buddy) skip.add(buddy.name.toLowerCase());

  type Draft = { person: Person; reason: string };
  const drafts: Draft[] = [];
  const seen = new Set<string>();

  // Strongest reason first: the ramp plan already says which person each task
  // escalates to. "Because day 1 task 2 goes to them" is not a networking
  // suggestion, it is a dependency.
  if (plan) {
    for (const day of plan.days) {
      for (let i = 0; i < day.tasks.length; i++) {
        const task = day.tasks[i];
        const person = byName.get(task.askIfStuck.trim().toLowerCase());
        if (!person) continue;
        const key = person.name.toLowerCase();
        if (skip.has(key) || seen.has(key)) continue;
        seen.add(key);
        drafts.push({
          person,
          reason: `Day ${day.day}, task ${i + 1} escalates to them — “${task.title}”. ${ownershipClause(
            person,
            terms,
          )}`,
        });
      }
    }
  }

  // Then whoever the derivation flagged as central, with its own reason.
  if (role) {
    for (const kp of role.keyPeople) {
      const person = byName.get(kp.name.trim().toLowerCase());
      if (!person) continue;
      const key = person.name.toLowerCase();
      if (skip.has(key) || seen.has(key)) continue;
      seen.add(key);
      drafts.push({ person, reason: firstSentence(kp.why) });
    }
  }

  const picks: MeetPick[] = [];
  for (const draft of drafts) {
    if (picks.length >= MAX_MEET) break;
    const authored = index.byAuthor.get(draft.person.name) ?? [];
    const c = pickWorksOn(authored, terms, company, avoid);
    // No citation, no entry. A name with a reason and nothing behind it is the
    // thing this product is built not to produce.
    if (!c) continue;
    avoid.add(c.artifactId);
    picks.push({
      name: draft.person.name,
      slackHandle: draft.person.slackHandle,
      role: draft.person.role,
      reason: draft.reason,
      citation: { ...c, quote: tidyQuoteEdges(trimToSentence(c.quote, 150)) },
    });
  }

  // Trimming the quote for the meet list can push it below the grounding
  // threshold or clip it mid-word, so re-verify the trimmed form and fall back
  // to the untrimmed citation rather than shipping a quote we cannot check.
  return picks.map((p) => {
    const ok = verifyOne(p.citation, company);
    return ok ? { ...p, citation: ok } : p;
  });
}

function ownershipClause(person: Person, terms: Set<string>): string {
  const overlaps = overlappingOwnerships(person, terms);
  const list = overlaps.length > 0 ? overlaps : person.owns;
  if (list.length === 0) return "";
  return `Owns ${list.slice(0, 2).join(" and ")}.`;
}

// ──────────────────────────────────────────── 3 · first task + worked example

function pickFirstTask(
  plan: RampPlan | undefined,
  hire: HireState,
): { task: RampTask; day: 1 | 2; position: number } | null {
  if (!plan) return null;
  for (const day of plan.days) {
    for (let i = 0; i < day.tasks.length; i++) {
      const task = day.tasks[i];
      if ((hire.taskStatus?.[task.id] ?? "not_started") === "done") continue;
      return { task, day: day.day, position: i + 1 };
    }
  }
  return null;
}

/** Artifact ids the plan already embedded in its own prose. */
const ARTIFACT_ID = /\b(?:slack|doc|ticket|meeting)-[a-z0-9-]*-\d{2,4}\b/gi;

function buildFirstTask(
  first: { task: RampTask; day: 1 | 2; position: number },
  index: CorpusIndex,
  terms: Set<string>,
  company: Company,
): FirstTaskBlock {
  const { task, day, position } = first;
  return {
    taskId: task.id,
    day,
    position,
    title: task.title,
    why: task.why,
    doneWhen: task.doneWhen,
    askIfStuck: task.askIfStuck,
    estimateMins: task.estimateMins,
    workedExample: findWorkedExample(task, index, terms, company),
  };
}

/**
 * The closest prior thing in the corpus to what this person is being asked to
 * do — the difference between "write up the divergences" and "write it up like
 * Marta's Italian note, here it is".
 *
 * First choice is an artifact the plan itself already pointed at: the planner
 * cited its sources in the task's own prose, so honouring that is more faithful
 * than re-deriving. Otherwise, the most on-topic doc or meeting note — a worked
 * example is a writeup, not a one-line Slack message, so those are preferred.
 */
function findWorkedExample(
  task: RampTask,
  index: CorpusIndex,
  terms: Set<string>,
  company: Company,
): WorkedExample | null {
  const prose = `${task.why} ${task.context} ${task.doneWhen}`;
  const named = [...new Set(prose.match(ARTIFACT_ID) ?? [])]
    .map((id) => index.byId.get(id.toLowerCase()))
    .filter((e): e is Indexed => Boolean(e));

  const taskTerms = new Set([...tokens(`${task.title} ${task.why}`), ...terms]);

  const fallback = index.all
    .filter((e) => e.artifact.kind === "doc" || e.artifact.kind === "meeting")
    .map((e) => ({ e, hits: hitCount(`${e.artifact.title ?? ""} ${e.artifact.text}`, taskTerms) }))
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((s) => s.e);

  for (const entry of [...named, ...fallback]) {
    const quote = bestQuote(entry.artifact, taskTerms);
    if (!quote) continue;
    const c = verifyOne(
      citation(entry.artifact, quote, "The closest prior version of this work in the corpus."),
      company,
    );
    if (!c) continue;
    const wasNamed = named.includes(entry);
    return {
      artifactId: entry.artifact.id,
      title: entry.artifact.title ?? entry.artifact.id,
      author: entry.artifact.author,
      where: entry.artifact.channel ?? entry.artifact.kind,
      at: entry.artifact.timestamp,
      whyItIsTheExample: wasNamed
        ? `The task's own instructions point here. ${entry.artifact.author} has already done this once.`
        : `The nearest thing anyone has written down to what this task asks for. By ${entry.artifact.author}.`,
      citation: c,
    };
  }
  return null;
}

// ──────────────────────────────────────────── 4 · what has not been decided

/**
 * Open questions, tied back to where the argument is actually happening.
 *
 * The derivation writes these as prose with the disputed sentences quoted
 * inline, so the first move is to take those quoted spans and find which
 * artifact they came from — the citation is then literally the sentence the
 * derivation was reading. Anything that will not tie back is dropped rather
 * than shown with a vague pointer.
 */
function pickUndecided(
  role: DerivedRole | undefined,
  index: CorpusIndex,
  company: Company,
): UndecidedItem[] {
  if (!role) return [];
  const out: UndecidedItem[] = [];

  for (const question of role.openQuestions) {
    const headline = firstSentence(question);
    const detail = question.slice(headline.length).trim();
    const c = citeQuestion(question, index, company);
    if (!c) continue;
    out.push({ headline, detail, citation: c });
  }
  return out;
}

/** Quoted spans inside the open question, in either quote style. */
const INLINE_QUOTE = /['‘“"]([^'’”"]{16,240})['’”"]/g;

function citeQuestion(
  question: string,
  index: CorpusIndex,
  company: Company,
): BriefCitation | null {
  for (const m of question.matchAll(INLINE_QUOTE)) {
    const quote = m[1].trim();
    for (const entry of index.all) {
      // Widen the fragment to the sentence that contains it. The derivation
      // quotes clauses ("is a tooling question and i dont have strong feelings
      // about it"), and a clause with no subject reads as a fragment on a
      // manager's phone. The widened form is still one verbatim span.
      const widened = containingSentence(entry.artifact.text, quote) ?? quote;
      const c = verifyOne(
        citation(entry.artifact, widened, "The sentence this open question came from."),
        company,
      );
      if (c) return c;
    }
  }

  // Nothing quoted verified. Fall back to the most on-topic artifact that
  // records the disagreement — meetings first, because "no decision recorded"
  // is a thing that only ever appears in minutes.
  const qTerms = new Set(tokens(question));
  const ranked = index.all
    .map((e) => ({ e, hits: hitCount(`${e.artifact.title ?? ""} ${e.artifact.text}`, qTerms) }))
    .filter((s) => s.hits >= 3)
    .sort(
      (a, b) =>
        b.hits - a.hits ||
        Number(b.e.artifact.kind === "meeting") - Number(a.e.artifact.kind === "meeting"),
    );

  for (const { e } of ranked.slice(0, 6)) {
    const quote = bestQuote(e.artifact, qTerms, 200);
    if (!quote) continue;
    const c = verifyOne(
      citation(e.artifact, quote, "Where this is being argued about."),
      company,
    );
    if (c) return c;
  }
  return null;
}

// ────────────────────────────────────────────────────────── the Slack message

/**
 * One message, mrkdwn, ready to paste.
 *
 * Slack is `*bold*` and `_italic_` — not Markdown's `**bold**`, which renders
 * as literal asterisks and makes the whole thing look like a bot wrote it
 * badly. Blockquotes are `>` at line start. No headings exist, so the structure
 * has to come from short lines and blank lines between blocks.
 *
 * The target is sixty seconds. Everything here is a line a manager can act on
 * or skip in one glance; nothing is a paragraph.
 */
export function toSlackMessage(b: ManagerBrief): string {
  const L: string[] = [];
  const who = b.manager ? ` ${b.manager.slackHandle}` : "";

  // ── header ──
  const when =
    b.hoursUntilStart >= 0
      ? `*${b.hireName} starts ${b.startsAtLabel}* — ${describeLead(b.hoursUntilStart)}.`
      : `*${b.hireName} started ${b.startsAtLabel}* — ${describeLead(b.hoursUntilStart)}.`;
  L.push(`${when}${who ? ` For${who}.` : ""}`);
  L.push(
    `${b.roleTitle} · ${b.companyName} · composed from ${b.corpusSize} artifacts. Four things, then you're done.`,
  );

  // The ten-second version. A manager onboarding twenty people reads this line
  // and nothing else on a bad day, so it has to be a map of the four blocks
  // rather than a summary of them — and it only ever claims what is below it.
  const todo: string[] = [];
  if (b.buddy) todo.push(`ask *${b.buddy.name}* to buddy`);
  if (b.meet.length > 0) todo.push(`${b.meet.length} intros to book`);
  if (b.firstTask) todo.push("first task is already written");
  if (b.undecided.length > 0) {
    todo.push(
      `${b.undecided.length} ${b.undecided.length === 1 ? "decision" : "decisions"} only you can make`,
    );
  }
  if (todo.length > 0) L.push(`*In one line:* ${todo.join(" · ")}.`);

  // ── 1 · buddy ──
  L.push("");
  if (b.buddy) {
    L.push(`*1 · Buddy: ${b.buddy.name}* (${b.buddy.slackHandle}, ${b.buddy.role})`);
    if (b.buddy.overlaps.length > 0) {
      L.push(`• Works on the same things: ${b.buddy.overlaps.join("; ")}.`);
    }
    L.push(quoteLine(b.buddy.worksOn));
    L.push(
      `• ${
        b.buddy.answeredAQuestion
          ? `Answers questions there — ${b.buddy.answeredWhom} asked, ${firstName(
              b.buddy.name,
            )} answered`
          : `Replies to people there — to ${b.buddy.answeredWhom}`
      }:`,
    );
    L.push(quoteLine(b.buddy.answers));
    if (b.buddy.wroteTheWorkedExample) {
      L.push(
        `• They wrote the worked example in §3 — the method ${b.hireName.split(/\s+/)[0]} is being told to copy is theirs.`,
      );
    }
    L.push(`• ${b.buddy.loadNote}`);
    if (b.passedOver) {
      L.push(
        `• _Not ${b.passedOver.name}_ (${b.passedOver.slackHandle}) — ${b.passedOver.reason}:`,
      );
      for (const c of b.passedOver.citations) L.push(quoteLine(c));
    }
  } else {
    L.push("*1 · Buddy:* nobody proposed.");
    L.push(
      "• No one in the corpus both works on this and visibly answers others about it. Picking a name would be a guess.",
    );
  }

  // ── 2 · people to meet ──
  L.push("");
  if (b.meet.length > 0) {
    L.push(`*2 · ${b.meet.length} people to meet, and why*`);
    for (const p of b.meet) {
      L.push(`• *${p.name}* (${p.slackHandle}) — ${trimToSentence(p.reason, 240)}`);
      L.push(quoteLine(p.citation));
    }
  } else {
    L.push("*2 · People to meet:* none that the corpus can justify.");
  }

  // ── 3 · first task ──
  L.push("");
  if (b.firstTask) {
    const t = b.firstTask;
    L.push(`*3 · Their first real task* — day ${t.day}, ~${formatMins(t.estimateMins)}`);
    L.push(`• *${t.title}*`);
    L.push(`• Why: ${firstSentence(t.why)}`);
    L.push(`• Done when: ${trimToSentence(t.doneWhen, 300)}`);
    L.push(`• Stuck → ${t.askIfStuck}`);
    if (t.workedExample) {
      L.push(
        `• *Worked example:* ${t.workedExample.title} — ${t.workedExample.author}, ${t.workedExample.where}.`,
      );
      L.push(quoteLine(t.workedExample.citation));
    } else {
      L.push("• No worked example. Nothing in the corpus is close enough to this to call one.");
    }
  } else {
    L.push("*3 · First task:* no ramp plan for this hire yet, so there isn't one.");
  }

  // ── 4 · undecided ──
  L.push("");
  const shown = b.undecided.slice(0, MAX_UNDECIDED_IN_MESSAGE);
  if (shown.length > 0) {
    L.push("*4 · What you haven't decided* — they'll hit these in week two as confusion");
    for (const u of shown) {
      L.push(`• ${u.headline}`);
      L.push(quoteLine(u.citation));
    }
    if (b.undecided.length > shown.length) {
      L.push(`• _${b.undecided.length - shown.length} more in the full brief._`);
    }
  } else {
    L.push("*4 · What you haven't decided:* nothing surfaced that ties back to a source.");
  }

  // ── honesty footer ──
  if (b.gaps.length > 0) {
    L.push("");
    L.push("*What this brief does not know*");
    for (const g of b.gaps) L.push(`• ${g}`);
  }

  L.push("");
  L.push(
    "_Every line above is a quote from your own Slack, docs and tickets. Nothing here is scored, ranked or invented._",
  );

  return L.join("\n");
}

function quoteLine(c: BriefCitation): string {
  const stamp = shortDate(c.at);
  return `> “${collapse(c.quote)}” — ${c.author}, ${c.where}${stamp ? `, ${stamp}` : ""}`;
}

// ────────────────────────────────────────────────────────────────── plumbing

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function firstSentence(text: string): string {
  const t = collapse(text);
  const m = t.match(/^.*?[.!?](?=\s|$)/);
  const s = (m?.[0] ?? t).trim();
  return s.length > 220 ? `${s.slice(0, 217).trimEnd()}…` : s;
}

function trim(text: string, max: number): string {
  const t = collapse(text);
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Trim on a sentence boundary where possible, so quotes do not end mid-word. */
function trimToSentence(text: string, max: number): string {
  const t = collapse(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (stop > max * 0.5) return cut.slice(0, stop + 1);
  const space = cut.lastIndexOf(" ");
  const head = cut.slice(0, space > 0 ? space : max);
  // Do not leave a dangling dash or comma in front of the ellipsis.
  return `${head.replace(/[\s,;:—–-]+$/, "")}…`;
}

function formatMins(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/**
 * "Tuesday 1 September, 09:00", read straight off the ISO string's own wall
 * clock rather than through the server's timezone. A brief that says 07:00
 * because Vercel runs in UTC is a brief the manager stops trusting.
 */
export function formatStart(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return iso;
  const [, y, mo, d, hh, mm] = m;
  const weekday = DAYS[new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay()];
  const date = `${weekday} ${+d} ${MONTHS[+mo - 1]}`;
  return hh ? `${date}, ${hh}:${mm}` : date;
}

function shortDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${+m[3]} ${MONTHS[+m[2] - 1].slice(0, 3)}`;
}

function hoursBetween(now: Date, iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.round((t - now.getTime()) / 3_600_000);
}

function describeLead(hours: number): string {
  if (hours < 0) {
    const past = Math.abs(hours);
    if (past < 24) return `${past}h ago`;
    const days = Math.round(past / 24);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }
  if (hours < 1) return "today";
  // Below three days, hours is the unit a manager actually plans in — "in 48
  // hours" is the whole point of this brief, and "in 2 days" throws it away.
  if (hours <= 72) return `in ${hours} hours`;
  return `in ${Math.round(hours / 24)} days`;
}
