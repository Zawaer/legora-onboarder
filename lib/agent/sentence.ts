/**
 * Expand a verified quote to the sentence that contains it.
 *
 * WHY THIS EXISTS — the one hole verbatim verification cannot cover.
 *
 * `ground.ts` proves a quote is a real substring of a real artifact. That kills
 * fabrication, which is the loud failure. It cannot touch the quiet one, found
 * by running the JD checker against Lexhav's real posting:
 *
 *   cited:    "operationally: my team maintains the M&A ones and the diligence
 *              ones."
 *   actual:   "operationally: my team maintains the M&A ones and the diligence
 *              ones. i would not describe any of that as ownership."
 *
 * Every character of that citation is genuine. It passes every check we have.
 * And it says the opposite of what its own sentence says, because it stops one
 * clause early. A reader shown the fragment concludes Elin claims ownership; the
 * sentence says she explicitly disclaims it.
 *
 * No amount of stricter substring matching finds this — the fragment IS in the
 * text. The only defence is to stop showing fragments. If the reader always sees
 * the whole sentence, a truncation that reverses the meaning cannot survive
 * being read, because the reversal is right there.
 *
 * So this runs at the point of display rather than the point of verification:
 * the quote stays exactly what was verified, and what a human reads is the
 * sentence it came from. Cheap, and it closes the class rather than one case.
 *
 * It is deliberately conservative. When it cannot locate the quote, or the
 * containing sentence is implausibly long (a Slack message with no full stops
 * is one "sentence"), it returns the original untouched — a slightly-too-short
 * quote is the status quo, while a wrong expansion would be a new way to
 * misquote someone.
 */

/** Beyond this, the "sentence" is really a paragraph and expanding helps nobody. */
const MAX_EXPANDED_CHARS = 420;

/** Same normalisation as ground.ts, minus the lowercasing, so offsets survive. */
function normaliseForSearch(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/[   ]/g, " ");
}

/**
 * Find `needle` in `haystack` ignoring case and whitespace runs, returning
 * offsets into the ORIGINAL haystack so the caller can slice real text.
 */
function locate(haystack: string, needle: string): { start: number; end: number } | null {
  const hay = normaliseForSearch(haystack);
  const need = normaliseForSearch(needle).replace(/\s+/g, " ").trim();
  if (!need) return null;

  // Walk the haystack building a whitespace-collapsed view while remembering
  // where each kept character came from, so a match maps back to real offsets.
  const chars: string[] = [];
  const offsets: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < hay.length; i++) {
    const c = hay[i]!;
    if (/\s/.test(c)) {
      if (lastWasSpace || chars.length === 0) continue;
      chars.push(" ");
      offsets.push(i);
      lastWasSpace = true;
    } else {
      chars.push(c);
      offsets.push(i);
      lastWasSpace = false;
    }
  }

  const collapsed = chars.join("");
  const at = collapsed.toLowerCase().indexOf(need.toLowerCase());
  if (at === -1) return null;

  const start = offsets[at]!;
  const endIdx = at + need.length - 1;
  const end = (offsets[endIdx] ?? offsets[offsets.length - 1]!) + 1;
  return { start, end };
}

/**
 * The sentence containing [start, end), bounded by terminators or line breaks.
 *
 * Line breaks count as boundaries because a lot of this corpus is Slack, where
 * people end thoughts with a newline and no punctuation at all.
 */
function sentenceBounds(text: string, start: number, end: number): { from: number; to: number } {
  let from = start;
  while (from > 0) {
    const c = text[from - 1]!;
    if (c === "\n") break;
    if (/[.!?]/.test(c)) {
      // Don't treat the dot in "v3.1" or "e.g." as a boundary.
      const next = text[from]!;
      if (/\s/.test(next)) break;
    }
    from--;
  }

  let to = end;
  while (to < text.length) {
    const c = text[to]!;
    if (c === "\n") break;
    to++;
    if (/[.!?]/.test(c)) {
      const next = text[to];
      if (next === undefined || /\s/.test(next)) break;
    }
  }

  return { from, to };
}

/**
 * Given a quote and the artifact text it was verified against, return the
 * sentence it sits in. Returns the quote unchanged if that cannot be done
 * safely.
 *
 * Handles elided quotes (`a ... b`) by expanding around the whole span from the
 * first fragment to the last, so an ellipsis in the middle is preserved rather
 * than silently filled in.
 */
export function expandToSentence(quote: string, artifactText: string): string {
  const trimmed = quote.trim();
  if (!trimmed || !artifactText) return quote;

  const fragments = trimmed
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((f) => f.trim())
    .filter(Boolean);
  if (fragments.length === 0) return quote;

  const first = locate(artifactText, fragments[0]!);
  const last =
    fragments.length === 1 ? first : locate(artifactText, fragments[fragments.length - 1]!);
  if (!first || !last) return quote;

  const { from } = sentenceBounds(artifactText, first.start, first.end);

  /*
   * Extend FORWARD to the end of the message, not to the end of the sentence.
   *
   * My first version stopped at the sentence boundary and did not fix the bug it
   * was written for — the Elin case reads:
   *
   *   "operationally: my team maintains the M&A ones and the diligence ones.
   *    i would not describe any of that as ownership."
   *
   * The reversal is the NEXT sentence. Stopping at the full stop reproduces the
   * misleading citation exactly.
   *
   * The asymmetry is the point: a clause that reverses a quote almost always
   * follows it — "but", "however", "that said", "i would not describe it that
   * way". Preceding text sets up a claim; following text withdraws it. So widen
   * backward only to the start of the sentence, and forward as far as the cap
   * allows. Whatever the speaker said next is the thing a reader needs.
   */
  /*
   * ...but stop at a blank line, because that is where another person starts
   * speaking.
   *
   * A Slack message is one voice, so running past a newline is right there. A
   * ticket or a meeting note is not: `experts-index.ts` parses their comment
   * lines as separate speakers. Measured over 3,780 expansions on the real
   * corpus, 430 crossed a newline — and quoting Tobias's "Rolled back to 4.1.13"
   * from a platform ticket returned text continuing "priya — this also killed
   * the overnight eval run", which is Priya talking, presented inside Tobias's
   * quotation.
   *
   * That is a misattribution: exactly the failure this file exists to prevent,
   * arriving through the fix rather than despite it. A blank line is the
   * conservative boundary — it separates speakers in every multi-line artifact
   * we hold, and never appears mid-message in a Slack one.
   */
  const paragraphEnd = artifactText.indexOf("\n\n", last.end);
  const hardStop = paragraphEnd === -1 ? artifactText.length : paragraphEnd;

  const to = Math.min(hardStop, from + MAX_EXPANDED_CHARS);
  if (to <= from) return quote;

  // Never end mid-word — a truncated expansion is its own small misquote. When
  // there is no space to cut on (an unbroken run of characters), stop at the end
  // of the quote itself rather than mid-token: that boundary is always real.
  let cut = to;
  if (cut < artifactText.length) {
    const lastBreak = artifactText.lastIndexOf(" ", cut);
    cut = lastBreak > last.end ? lastBreak : last.end;
  }

  // The expansion has to contain what was quoted. In a long run with no sentence
  // break — a Slack message with no full stops — `from` is the start of the run
  // and `from + MAX_EXPANDED_CHARS` can stop before the quote begins, which
  // returns a different passage of the same message under the quote's name. It
  // passes the length check below, so that check cannot catch it.
  if (from > first.start || cut < last.end) return quote;

  const expanded = artifactText.slice(from, cut).trim();
  if (!expanded || expanded.length > MAX_EXPANDED_CHARS) return quote;

  // Only ever widen. If the "expansion" is shorter than what was quoted, the
  // bounds search went wrong and the original is the safer thing to show.
  if (expanded.length < trimmed.length) return quote;

  return expanded;
}

/** True when expanding would actually show the reader more than they asked for. */
export function wasExpanded(quote: string, expanded: string): boolean {
  return expanded.trim() !== quote.trim();
}
