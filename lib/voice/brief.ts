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

/** Hard ceiling. Past ~230 words this stops being a briefing and becomes a podcast. */
const MAX_WORDS = 230;

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

function spellMinutes(mins: number): string {
  const value = Math.max(1, Math.round(mins));
  return value === 1 ? "one minute" : `${spellNumber(value)} minutes`;
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
};

function hoursWaiting(raisedAt: string, now: number): number {
  const at = new Date(raisedAt).getTime();
  if (Number.isNaN(at)) return 0;
  return Math.floor(Math.max(0, now - at) / 3_600_000);
}

/**
 * One blocker, spoken.
 *
 * Two sentences rather than one, because the summary is a full sentence written
 * for a card and splicing it into "X is blocked on <summary>" produces garbage
 * grammar for anything but the shortest summaries. "Rebecca is blocked. The
 * workspace is not visible under her new account. Johan can clear it in five
 * minutes." survives any input the agent can produce.
 */
function speakBlocker(item: OpenItem, spokenName: string): string {
  const { blocker } = item;
  const obstacle = firstClause(blocker.summary, 24);
  const person = blocker.suggestedPerson ? firstName(blocker.suggestedPerson) : null;
  const mins = typeof blocker.minutesToUnblock === "number" && blocker.minutesToUnblock > 0
    ? blocker.minutesToUnblock
    : null;

  const parts = [`${spokenName} is blocked.`];
  if (obstacle) parts.push(obstacle);

  if (person && mins) {
    parts.push(`${person} can clear it in ${spellMinutes(mins)}.`);
  } else if (person) {
    parts.push(`${person} can clear it.`);
  } else if (mins) {
    parts.push(`It is about ${spellMinutes(mins)} of somebody's time, and nobody is named on it yet.`);
  } else {
    parts.push("Nobody is named on it yet.");
  }

  return parts.join(" ");
}

function compose(
  open: OpenItem[],
  handled: number,
  hireCount: number,
  detailLimit: number,
  now: number,
): string {
  // ── nothing needs a human ──────────────────────────────────────────────────
  // One cheerful sentence and out. The temptation here is to fill the silence
  // with a roundup nobody asked for; a briefing that says "you are clear" in
  // four seconds is worth more than ninety seconds of manufactured content,
  // and it is the honest output.
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
  lines.push(
    open.length === 1
      ? "One thing needs you."
      : `${capitalise(spellNumber(open.length))} things need you.`,
  );

  const detailed = open.slice(0, detailLimit);
  detailed.forEach((item, index) => {
    lines.push(speakBlocker(item, names.get(item.hireName) ?? firstName(item.hireName)));
    // Age, on the oldest item only. It is the one fact that changes what the
    // manager does first, and it is about the queue, never about the person.
    if (index === 0) {
      const hours = hoursWaiting(item.blocker.raisedAt, now);
      if (hours >= 2) {
        lines.push(
          `That one has been waiting ${spellNumber(hours)} ${hours === 1 ? "hour" : "hours"}.`,
        );
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
  // A count, never a list. The point being made is about volume: this is how
  // much did NOT reach you. Reading out nine resolved questions would spend the
  // manager's attention proving we saved the manager's attention.
  if (handled > 0) {
    lines.push(
      `The agent answered ${spellNumber(handled)} other ${
        handled === 1 ? "question" : "questions"
      } without you.`,
    );
  }

  lines.push("Nothing else needs you.");

  return lines.join(" ");
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
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

  for (const hire of safeHires) {
    for (const blocker of hire.blockers ?? []) {
      if (blocker.needsHuman && !blocker.resolved) {
        open.push({ blocker, hireName: hire.name ?? "Somebody" });
      } else {
        handled += 1;
      }
    }
  }

  // Oldest first. Whoever has been stuck longest has lost the most time, and
  // that is the only ordering that is about the work rather than about the
  // person — no urgency scores, no triage ranking of hires.
  open.sort((a, b) => a.blocker.raisedAt.localeCompare(b.blocker.raisedAt));

  const minutes = open.reduce((sum, i) => sum + (i.blocker.minutesToUnblock ?? 0), 0);

  let detailLimit = SPOKEN_DETAIL_LIMIT;
  let script = compose(open, handled, safeHires.length, detailLimit, now);
  // Long summaries can push a three-item briefing past the ceiling. Drop detail
  // rather than truncate mid-sentence: a shorter briefing that finishes its
  // thought beats a longer one that stops dead in the manager's ear.
  while (countWords(script) > MAX_WORDS && detailLimit > 1) {
    detailLimit -= 1;
    script = compose(open, handled, safeHires.length, detailLimit, now);
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
