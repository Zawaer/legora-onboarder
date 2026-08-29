/**
 * The spoken briefing: the manager screen, compressed into something you can
 * hear on the way in.
 *
 * ── WHY VOICE, AND WHY THIS SHAPE ────────────────────────────────────────────
 *
 * The buyer for this product is a hiring manager whose defining constraint is
 * that they have no time. They are ramping twenty people at once, and a
 * dashboard — however good — is one more tab they have to remember to open.
 * Audio is the only format that fits the part of their day that is actually
 * free: the commute, the walk between two meetings, the ten minutes before
 * standup. So this is not text-to-speech bolted onto a dashboard for the sake
 * of it. It is the same promise the product already makes — your attention is
 * the scarce resource we are protecting — delivered in the one format that
 * costs the manager nothing to consume.
 *
 * ── WRITTEN FOR THE EAR, NOT THE EYE ─────────────────────────────────────────
 *
 * A listener cannot skim, re-read, or scroll back. Everything below follows
 * from that constraint:
 *
 *   • short declarative sentences, one fact each;
 *   • no bullet characters, no markdown, no URLs, no code — a speech model
 *     reads "*" and "https://…" out loud, and it is grotesque;
 *   • numbers we compose are spelled out ("ten minutes", not "10 min"),
 *     because a TTS model reading "10" is a coin flip between "ten" and
 *     "one zero", and "5" next to a name is worse;
 *   • the most important fact comes first, because the listener may stop
 *     paying attention after the first sentence. So the briefing opens with
 *     the person who is blocked and the human who can unblock them — never
 *     with preamble, never with a greeting.
 *
 * ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────────
 *
 * No score. No ranking. No completion percentage. No "Rebecca is behind". The
 * briefing describes obstacles and never the human standing in front of one.
 * That is the same rule that governs the manager screen (see the note on
 * `Blocker` in lib/types.ts), and it matters *more* in audio, not less: a
 * written dashboard is read by the manager alone, but a spoken briefing gets
 * played out loud in a car with somebody else in it, or on a speaker in an
 * open-plan office. A sentence that rates a new hire is a sentence that gets
 * repeated. Our customers hire for ownership and say so out loud; the first
 * time this thing sounds like surveillance it is removed by the same culture
 * that bought it — and the new hire is usually the one who notices first.
 *
 * The function is pure and synchronous on purpose. No model call, no network,
 * no clock unless you pass one. That means the script is testable, identical
 * on every run, and — crucially for demo day — still there to read when the
 * ElevenLabs quota is dry.
 */

import type { Blocker, HireState } from "@/lib/types";
// Reused, not reimplemented — the same guard `lib/agent/drift.ts` runs, and for
// the same reason. `lib/slack/format.ts` has no runtime imports, so this stays
// a pure module. See `sayable` below.
import { findAssessmentLanguage } from "@/lib/slack/format";

export type Brief = {
  /** The spoken script. Plain prose: no markdown, no bullets, no URLs. */
  script: string;
  wordCount: number;
  /** At a briefing pace of ~150 words per minute. */
  estimatedSeconds: number;
  /** Blockers the agent could not resolve without a human. */
  needsHuman: number;
  /** Blockers the agent closed from company context, plus anything resolved. */
  handled: number;
  /** Honest total of human minutes the open blockers cost. */
  minutes: number;
  hires: number;
};

export type BriefOptions = {
  /** Pinned "now" so the script is deterministic in tests and on the server. */
  now?: number;
};

/**
 * How many blockers get a sentence of their own before the rest become a count.
 * Three is the most a listener holds in their head; past that the briefing
 * stops being actionable and becomes a list they tune out of.
 */
const SPOKEN_DETAIL_LIMIT = 3;

/** Hard ceiling. Past ~220 words (about ninety seconds) this stops being a briefing. */
const MAX_WORDS = 220;

const WORDS_PER_SECOND = 2.5;

// ─────────────────────────────────────────────────────────────── number words

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
];

const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty",
  "ninety",
];

/**
 * Spell a whole number for speech. Above ninety-nine we hand the digits back —
 * a briefing that has to say "one hundred and seven" has already failed at
 * being a briefing, and the digits are at least honest.
 */
export function spellNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const value = Math.max(0, Math.round(n));
  if (value < 20) return ONES[value];
  if (value < 100) {
    const tens = TENS[Math.floor(value / 10)];
    const ones = value % 10;
    return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
  }
  return String(value);
}

/**
 * Minutes, spoken the way a person would say them.
 *
 * Past an hour we switch to hours-and-minutes rather than reading out "one
 * hundred and five minutes" — partly because nobody talks like that, and partly
 * because `spellNumber` hands back bare digits above ninety-nine, and a digit
 * that reaches the speech model is exactly the failure this whole file exists
 * to avoid.
 */
function spellMinutes(mins: number): string {
  const value = Math.max(1, Math.round(mins));
  if (value < 60) return value === 1 ? "one minute" : `${spellNumber(value)} minutes`;

  const hours = Math.floor(value / 60);
  const rest = value % 60;
  // Past ninety-nine hours `spellNumber` hands back bare digits, and a digit
  // reaching the speech model is the exact failure this file exists to avoid
  // ("1666 hours and forty minutes"). Nothing honest is lost by capping: an
  // estimate that large is not a real estimate.
  if (hours > 99) return "more than four days";
  const hourPart = hours === 1 ? "one hour" : `${spellNumber(hours)} hours`;
  if (rest === 0) return hourPart;
  return `${hourPart} and ${rest === 1 ? "one minute" : `${spellNumber(rest)} minutes`}`;
}

// ──────────────────────────────────────────────────────────── text for speech

/**
 * Strip everything a speech model would embarrass us by reading aloud.
 *
 * Blocker summaries are written by the supervision agent and are usually clean
 * prose, but they are model output quoting a Slack corpus — so a stray link, a
 * backtick around a file path, or a leading dash is entirely possible, and any
 * one of them lands as a noise in the middle of a sentence in the manager's
 * car. Cheap insurance.
 *
 * Note what we do NOT do: expand acronyms. "SSO" and "SPA" come from the
 * company's own vocabulary, ElevenLabs pronounces them acceptably, and every
 * heuristic that tries to space them out mangles a real word eventually.
 * Guessing wrong out loud is worse than letting the model guess.
 */
function forTheEar(raw: string): string {
  // Typed as required, but this reads model output that has been round-tripped
  // through a JSON file on disk. A single missing `summary` used to throw here,
  // which /api/brief turns into a 500 and the panel renders as a skeleton that
  // never resolves — the one failure the route's own docblock promises cannot
  // happen. A missing string is silence, not a crash.
  if (typeof raw !== "string") return "";
  return raw
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // markdown links keep their words
    .replace(/[`*_#>|]/g, "")
    .replace(/[•·]/g, " ")
    .replace(/^[\s\-–—]+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * The surveillance guard, on the spoken path. Fail closed.
 *
 * Everything above the fold in this file says the briefing never rates a
 * person — but until this existed, nothing in the code enforced it. Three of
 * the strings spoken aloud are not written here: `Blocker.summary` and the ramp
 * task title are Opus output, and `DerivedRole.openQuestions` is Opus output
 * about what the company has not decided. The system prompt forbids assessment
 * language and the schema has no field for it; neither is a mechanism. A single
 * "she is struggling with the SSO setup" in a summary was read out verbatim,
 * and audio is the surface where that costs the most — it gets played on a
 * speaker with somebody else in the room.
 *
 * Drops the fragment rather than rewriting it, exactly as `lib/agent/drift.ts`
 * does: silently editing a judgement into something acceptable is how the ban
 * stops meaning anything, and it hides the regression. Every caller here is
 * dropping an optional clause, so the briefing stays grammatical and still
 * names who is blocked and who can clear it.
 *
 * Not applied to people's names (`hireName`, `suggestedPerson`): those are
 * roster entries, not model prose, and muting somebody's name to satisfy a
 * keyword match would be a worse briefing than the one it prevents.
 */
function sayable(text: string, where: string): string {
  if (!text) return "";
  const flagged = findAssessmentLanguage(text);
  if (flagged) {
    console.warn(`[brief] dropped ${where} containing assessment language: "${flagged}"`);
    return "";
  }
  return text;
}

/**
 * One clause, ending in a full stop.
 *
 * Blocker summaries are written to be read on a card and can run long. In the
 * ear, a thirty-word subordinate clause loses the listener before the name of
 * the person who can fix it — which is the only part that matters — so we take
 * the first sentence and, if that is still long, cut it at a clause boundary.
 */
function firstClause(text: string, maxWords: number): string {
  const cleaned = forTheEar(text);
  if (!cleaned) return "";

  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  let out = firstSentence;

  if (countWords(out) > maxWords) {
    const parts = out.split(/[,;:]\s+/);
    let acc = parts[0] ?? out;
    // Keep absorbing clauses until we have enough to be a real statement.
    for (let i = 1; i < parts.length && countWords(acc) < 8; i += 1) {
      acc = `${acc}, ${parts[i]}`;
    }
    out = acc;
  }

  // Clause boundaries are a preference, not a guarantee. A summary written as
  // one long unpunctuated run has no comma to cut at, so the loop above returns
  // it whole — which is how a single blocker produced a 355-word "briefing"
  // that walks straight past MAX_WORDS, spends ElevenLabs credits per character
  // and cannot be rescued by the ladder (the ladder drops context, never the
  // obstacle). Cut at a word count as the backstop.
  const words = out.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) out = words.slice(0, maxWords).join(" ");

  return `${out.replace(/[\s.,;:—–-]+$/, "")}.`;
}

/** "Rebecca Hartley" → "Rebecca". Briefings use first names; nobody says surnames out loud. */
function firstName(full: string): string {
  return forTheEar(full).split(/\s+/)[0] ?? full;
}

/**
 * First names, unless two people in this briefing share one — at which point
 * "Marta is blocked" is actively misleading and we say the whole name.
 */
function speakableNames(names: string[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const name of names) {
    const first = firstName(name).toLowerCase();
    counts.set(first, (counts.get(first) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  for (const name of names) {
    const first = firstName(name);
    out.set(name, (counts.get(first.toLowerCase()) ?? 0) > 1 ? forTheEar(name) : first);
  }
  return out;
}

// ────────────────────────────────────────────────────────────── the briefing

type OpenItem = {
  blocker: Blocker;
  /** Who is stuck. Named, because a briefing without a name is not actionable. */
  hireName: string;
  /**
   * The ramp task this blocker is standing in front of, if the plan names one.
   *
   * This is about the WORK, not the worker: "it is holding up the Nordkap
   * disclosure schedule" tells the manager what is actually stalled and what it
   * costs the company. It is emphatically not progress tracking — there is no
   * count of tasks done, no percentage, no comparison between hires.
   */
  taskTitle?: string;
};

/**
 * What the company itself has not decided yet.
 *
 * `DerivedRole.openQuestions` is the agent admitting the corpus does not answer
 * something — usually because nobody has made the call. That is genuinely a
 * manager's job and nobody else's, so one of them belongs in the briefing. It
 * is also, notably, an obstacle in the ORGANISATION rather than in the person,
 * which is the only kind of thing this product is willing to say out loud.
 */
type RoleGap = { count: number; first: string; hireName: string };

type Ingredients = {
  open: OpenItem[];
  handled: number;
  hireCount: number;
  /** For the one-hire case: who, and when they started. Orientation, not a metric. */
  soloHire?: { name: string; startedAt: string };
  gap?: RoleGap;
};

/**
 * Which optional material makes it into this take.
 *
 * Everything here is true and worth saying; the only question is whether there
 * is room for it. See `LADDER` below.
 */
type Take = {
  detailLimit: number;
  taskContext: boolean;
  roleGap: boolean;
  roster: boolean;
};

/**
 * The degradation ladder, richest first.
 *
 * A briefing is a fixed budget of the listener's attention, so when the day is
 * busy the extras have to give way to the blockers — never the other way round.
 * Context is dropped in order of how far it sits from "somebody is stuck right
 * now", and only as a last resort do we speak about fewer blockers.
 */
const LADDER: Take[] = [
  { detailLimit: 3, taskContext: true, roleGap: true, roster: true },
  { detailLimit: 3, taskContext: true, roleGap: true, roster: false },
  { detailLimit: 3, taskContext: true, roleGap: false, roster: false },
  { detailLimit: 3, taskContext: false, roleGap: false, roster: false },
  { detailLimit: 2, taskContext: false, roleGap: false, roster: false },
  { detailLimit: 1, taskContext: false, roleGap: false, roster: false },
];

function hoursWaiting(raisedAt: string, now: number): number {
  const at = new Date(raisedAt).getTime();
  if (Number.isNaN(at)) return 0;
  return Math.floor(Math.max(0, now - at) / 3_600_000);
}

/**
 * "started today" / "started yesterday" / "started three days ago".
 *
 * A date, not a judgement. It answers "which of the twenty is this?" for a
 * manager who is ramping a cohort — and it deliberately stops at a fortnight,
 * because past that the answer stops being interesting and starts sounding
 * like a comment on how long somebody is taking.
 */
function startedPhrase(startedAt: string, now: number): string {
  const days = Math.floor((now - new Date(startedAt).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return "";
  if (days === 0) return "started today";
  if (days === 1) return "started yesterday";
  if (days < 14) return `started ${spellNumber(days)} days ago`;
  return "";
}

const QUESTION_OPENER = /^(who|what|whether|which|where|when|how|why)\b/i;

/**
 * An open question, spoken as a clause after a colon. Question words get their
 * capital dropped so "…is still open: who owns the escalation conversation"
 * reads as one sentence rather than two glued together; anything else keeps its
 * capital, because it is probably a proper noun.
 */
function asClause(text: string): string {
  const clause = sayable(firstClause(text, 22), "an open question");
  if (!clause) return "";
  return QUESTION_OPENER.test(clause)
    ? clause.charAt(0).toLowerCase() + clause.slice(1)
    : clause;
}

/**
 * One blocker, spoken.
 *
 * Deliberately several short sentences rather than one long one. The summary is
 * a full sentence written for a card, and splicing it into "X is blocked on
 * <summary>" produces broken grammar for anything but the shortest inputs.
 * "Rebecca is blocked. The workspace is not visible under her new account.
 * Johan can clear it in five minutes." survives anything the agent can write,
 * and short sentences are what the ear wants anyway.
 */
function speakBlocker(item: OpenItem, spokenName: string, withTask: boolean): string {
  const { blocker } = item;
  const obstacle = sayable(firstClause(blocker.summary, 24), "a blocker summary");
  const person = blocker.suggestedPerson ? firstName(blocker.suggestedPerson) : null;
  const mins =
    typeof blocker.minutesToUnblock === "number" && blocker.minutesToUnblock > 0
      ? blocker.minutesToUnblock
      : null;

  const parts = [`${spokenName} is blocked.`];
  if (obstacle) parts.push(obstacle);

  if (withTask && item.taskTitle) {
    const task = sayable(firstClause(item.taskTitle, 16), "a ramp task title");
    if (task) parts.push(`It is holding up the task called ${task}`);
  }

  if (person && mins) {
    parts.push(`${person} can clear it in ${spellMinutes(mins)}.`);
  } else if (person) {
    parts.push(`${person} can clear it.`);
  } else if (mins) {
    parts.push(
      `It is about ${spellMinutes(mins)} of somebody's time, and nobody is named on it yet.`,
    );
  } else {
    parts.push("Nobody is named on it yet.");
  }

  return parts.join(" ");
}

function compose(input: Ingredients, take: Take, now: number): string {
  const { open, handled, hireCount, soloHire, gap } = input;

  // ── nothing needs a human ──────────────────────────────────────────────────
  // One cheerful sentence and out. The temptation here is to fill the silence
  // with a roundup nobody asked for; a briefing that says "you are clear" in
  // four seconds is worth more than ninety seconds of manufactured content, and
  // it is the honest output. Filler is how a briefing teaches its listener to
  // stop pressing play.
  if (open.length === 0) {
    if (hireCount === 0) {
      return "Nobody is onboarding right now, so there is nothing waiting on you.";
    }
    const clear = "Good news. Nothing needs you right now.";
    if (handled > 0) {
      return `${clear} The agent answered ${spellNumber(handled)} ${
        handled === 1 ? "question" : "questions"
      } from company context on its own, and nobody is stuck.`;
    }
    return `${clear} Nobody is stuck.`;
  }

  const names = speakableNames(open.map((i) => i.hireName));
  const lines: string[] = [];

  // ── lead with what needs a human, right now ───────────────────────────────
  // First sentence, no preamble, no greeting. A listener who stops paying
  // attention after four seconds should still have heard the only number that
  // matters to them.
  lines.push(
    open.length === 1
      ? "One thing needs you."
      : `${capitalise(spellNumber(open.length))} things need you.`,
  );

  const detailed = open.slice(0, take.detailLimit);
  detailed.forEach((item, index) => {
    lines.push(
      speakBlocker(item, names.get(item.hireName) ?? firstName(item.hireName), take.taskContext),
    );
    // Age, on the oldest item only. It is the one fact that changes what the
    // manager does first, and it is a fact about the queue — never about the
    // person waiting in it.
    if (index === 0) {
      const hours = hoursWaiting(item.blocker.raisedAt, now);
      if (hours >= 2) {
        // Same rule as `spellMinutes`: never let a bare digit reach the speech
        // model. Over four days the hour count stops being the useful fact
        // anyway — "waiting 5772 hours" is noise where "five days" is a prompt
        // to act.
        const waited =
          hours < 100
            ? `${spellNumber(hours)} hours`
            : `${spellNumber(Math.min(99, Math.floor(hours / 24)))} days`;
        lines.push(`That one has been waiting ${waited}.`);
      }
    }
  });

  const remaining = open.length - detailed.length;
  if (remaining > 0) {
    lines.push(
      `${capitalise(spellNumber(remaining))} more ${
        remaining === 1 ? "is" : "are"
      } waiting on you, and they are on the blockers screen.`,
    );
  }

  // ── the honest price of all of it ─────────────────────────────────────────
  const minutes = open.reduce((sum, i) => sum + (i.blocker.minutesToUnblock ?? 0), 0);
  if (open.length > 1 && minutes > 0) {
    lines.push(`Together that is about ${spellMinutes(minutes)} of your time.`);
  }

  // ── what the agent absorbed ───────────────────────────────────────────────
  // A count, never a list. The point is volume: this is how much did NOT reach
  // you. Reading out nine resolved questions would spend the manager's
  // attention proving that we save the manager's attention.
  if (handled > 0) {
    lines.push(
      `The agent answered ${spellNumber(handled)} other ${
        handled === 1 ? "question" : "questions"
      } without you.`,
    );
  }

  // ── who is in the cohort ──────────────────────────────────────────────────
  if (take.roster) {
    if (hireCount === 1 && soloHire) {
      const started = startedPhrase(soloHire.startedAt, now);
      lines.push(
        started
          ? `${soloHire.name} ${started} and is the only person ramping right now.`
          : `${soloHire.name} is the only person ramping right now.`,
      );
    } else if (hireCount > 1) {
      lines.push(`${capitalise(spellNumber(hireCount))} people are ramping right now.`);
    }
  }

  // ── what the company has not decided ──────────────────────────────────────
  if (take.roleGap && gap) {
    const clause = asClause(gap.first);
    const whose = hireCount === 1 ? "the role itself" : `${gap.hireName}'s role`;
    if (clause) {
      lines.push(
        gap.count === 1
          ? `Separately, one question about ${whose} is still open: ${clause}`
          : `Separately, ${spellNumber(gap.count)} questions about ${whose} are still open. One of them: ${clause}`,
      );
    }
  }

  lines.push("Nothing else needs you.");

  return lines.join(" ");
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Ramp-task titles by id, so a blocker can name the work it is standing in front of. */
function taskTitles(hire: HireState): Map<string, string> {
  const map = new Map<string, string>();
  for (const day of hire.plan?.days ?? []) {
    for (const task of day.tasks ?? []) {
      if (task?.id && task?.title) map.set(task.id, task.title);
    }
  }
  return map;
}

/**
 * Compose the briefing from live hire state.
 *
 * The needs-a-human / handled split is exactly the one the manager screen makes
 * (`components/blocker-list.tsx`), on purpose: the audio and the page must never
 * disagree about how many things need you, or the listener stops trusting both.
 */
export function composeBrief(
  hires: HireState[],
  { now = Date.now() }: BriefOptions = {},
): Brief {
  const safeHires = Array.isArray(hires) ? hires.filter(Boolean) : [];

  const open: OpenItem[] = [];
  let handled = 0;
  let gap: RoleGap | undefined;

  for (const hire of safeHires) {
    const titles = taskTitles(hire);
    for (const blocker of hire.blockers ?? []) {
      if (blocker.needsHuman && !blocker.resolved) {
        open.push({
          blocker,
          hireName: hire.name ?? "Somebody",
          taskTitle: blocker.taskId ? titles.get(blocker.taskId) : undefined,
        });
      } else {
        handled += 1;
      }
    }

    const questions = (hire.derivedRole?.openQuestions ?? []).filter(
      (q): q is string => typeof q === "string" && q.trim().length > 0,
    );
    // First hire with unanswered questions wins. One per briefing, never a list
    // — these are background truths, not today's work.
    if (!gap && questions.length > 0) {
      gap = {
        count: questions.length,
        first: questions[0],
        hireName: firstName(hire.name ?? "Somebody"),
      };
    }
  }

  // Oldest first. Whoever has been stuck longest has lost the most time, and
  // that is the only ordering that is about the work rather than about the
  // person — no urgency scores, no triage ranking of hires.
  // `?? ""` rather than a bare `.localeCompare`: a blocker that reached disk
  // without a `raisedAt` would otherwise throw here, and a throw in this
  // function is a 500 from /api/brief and a briefing panel that spins forever.
  // `components/blocker-list.tsx` already tolerates the same missing field.
  open.sort((a, b) => (a.blocker.raisedAt ?? "").localeCompare(b.blocker.raisedAt ?? ""));

  const minutes = open.reduce((sum, i) => sum + (i.blocker.minutesToUnblock ?? 0), 0);

  const solo = safeHires.length === 1 ? safeHires[0] : undefined;
  const ingredients: Ingredients = {
    open,
    handled,
    hireCount: safeHires.length,
    soloHire: solo
      ? { name: forTheEar(solo.name ?? "Somebody"), startedAt: solo.startedAt }
      : undefined,
    gap,
  };

  // Walk the ladder and take the richest version that fits the budget. Dropping
  // whole sentences beats truncating one: a briefing that stops mid-thought in
  // somebody's ear is worse than a shorter briefing that finishes.
  let script = compose(ingredients, LADDER[0], now);
  for (const take of LADDER) {
    script = compose(ingredients, take, now);
    if (countWords(script) <= MAX_WORDS) break;
  }

  const wordCount = countWords(script);

  return {
    script,
    wordCount,
    estimatedSeconds: Math.max(1, Math.round(wordCount / WORDS_PER_SECOND)),
    needsHuman: open.length,
    handled,
    minutes,
    hires: safeHires.length,
  };
}
