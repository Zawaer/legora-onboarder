/**
 * Slack presentation. Text in, Block Kit out — nothing here talks to Slack.
 *
 * Two things this file exists to get right:
 *
 * 1. **Slack is not markdown.** It is mrkdwn: `*bold*`, `_italic_`, `<url|text>`,
 *    and `&`/`<`/`>` are markup characters that have to be escaped. The agent
 *    writes for the web panel, so it emits `**bold**` — pasted into Slack that
 *    renders as literal asterisks and the product looks unfinished in the first
 *    five seconds of the demo. `toMrkdwn` is the seam that fixes it, in one
 *    place, for every surface.
 *
 * 2. **Nothing here ever renders a judgement of the person.** See
 *    `ASSESSMENT_LANGUAGE` at the bottom — the ban is written as testable code,
 *    not as a comment somebody can quietly stop honouring.
 *
 * Deliberately free of runtime imports: this module is pure, so the local
 * harness can exercise every branch with no Slack app, no tokens and no network.
 */

import type { types as SlackTypes } from "@slack/bolt";
import type { Blocker, Company, Person, RampTask } from "@/lib/types";

/** One Block Kit block. Aliased so the rest of the code never imports Bolt. */
export type Block = SlackTypes.KnownBlock;

// Slack's own limits. Exceeding any of them is a 400 from chat.postMessage,
// which at demo time reads as "the bot is broken" rather than "block too long".
const SECTION_TEXT_LIMIT = 3000;
const HEADER_TEXT_LIMIT = 150;
const MAX_BLOCKS = 50;
// A section's `fields` are *not* governed by the 3000 that applies to its
// `text`. Slack documents them separately: "Maximum number of items is 10.
// Maximum length for the `text` in each item is 2000 characters."
// (docs.slack.dev/reference/block-kit/blocks/section-block). Clipping these to
// 3000 would sail past the harness and come back as `invalid_blocks` from the
// one message that matters most — the escalation card.
const FIELD_TEXT_LIMIT = 2000;
const MAX_FIELDS = 10;
/** Leaves room for the "…" and for a multibyte tail. */
const SECTION_CHUNK = 2800;

// ───────────────────────────────────────────────────────────────── mrkdwn

/**
 * Escape the three characters Slack treats as markup.
 *
 * Runs before every other transform, because everything downstream inserts
 * mrkdwn control characters of its own (`<url|text>`, `>` blockquotes) that
 * must not be escaped afterwards.
 */
export function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Markdown (what the agent writes) → mrkdwn (what Slack renders).
 *
 * Conversions are line-oriented and conservative. Anything unrecognised is left
 * alone rather than mangled: a paragraph that renders slightly plainly is a
 * cosmetic problem, a paragraph the regex ate is a missing answer.
 */
export function toMrkdwn(markdown: string): string {
  const escaped = escapeMrkdwn(markdown);

  // Fence state is tracked line by line rather than matched with one regex, so
  // an *unterminated* fence — which is what a truncated model response looks
  // like — leaves the rest of the message as code instead of reformatting it.
  // The local harness caught this: without the toggle, a `- ` inside a quoted
  // code block turned into a bullet and the quote stopped being verbatim.
  let inFence = false;

  return escaped
    .split("\n")
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;

      // ATX headings have no Slack equivalent; bold is the closest honest
      // render. Existing emphasis is stripped first — `*a *b* c*` is not bold,
      // it is a mess.
      const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
      if (heading) return `*${inlineMrkdwn(heading[2]!.replace(/\*+/g, "").trim())}*`;

      // Bullets before emphasis: a `*` list marker is followed by a space and
      // `**bold**` is not, so this cannot swallow an emphasis run.
      return inlineMrkdwn(line.replace(/^(\s*)[-*+]\s+/, "$1• "));
    })
    .join("\n");
}

/** Emphasis and links, within a single non-code line. */
function inlineMrkdwn(line: string): string {
  return (
    line
      // `**bold**` → `*bold*`, `__bold__` → `_italic_`. Slack has no separate
      // strong/em, so both collapse to the nearest single marker.
      .replace(/\*\*([^\n*]+)\*\*/g, "*$1*")
      .replace(/__([^\n_]+)__/g, "_$1_")
      // [text](url) → <url|text>
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, "<$2|$1>")
  );
}

/** Truncate to a hard Slack limit without leaving a dangling word. */
function clip(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}

// ─────────────────────────────────────────────────────────── block helpers

export function section(mrkdwn: string): Block {
  return { type: "section", text: { type: "mrkdwn", text: clip(mrkdwn, SECTION_TEXT_LIMIT) } };
}

export function context(mrkdwn: string): Block {
  return { type: "context", elements: [{ type: "mrkdwn", text: clip(mrkdwn, SECTION_TEXT_LIMIT) }] };
}

export function header(plain: string): Block {
  return { type: "header", text: { type: "plain_text", text: clip(plain, HEADER_TEXT_LIMIT), emoji: true } };
}

export function divider(): Block {
  return { type: "divider" };
}

/**
 * Prose → one or more section blocks.
 *
 * A supervision turn can run well past 3000 characters when the agent quotes a
 * thread back at the hire, and Slack rejects the whole message rather than
 * truncating the block. Split on paragraph boundaries where possible so the
 * seam lands somewhere a reader would have paused anyway.
 */
export function prose(markdown: string): Block[] {
  const text = toMrkdwn(markdown).trim();
  if (text.length === 0) return [];
  if (text.length <= SECTION_CHUNK) return [section(text)];

  const blocks: Block[] = [];
  let buffer = "";
  for (const paragraph of text.split(/\n{2,}/)) {
    // A single paragraph over the limit still has to be broken; hard-slice it
    // rather than dropping it.
    if (paragraph.length > SECTION_CHUNK) {
      if (buffer) {
        blocks.push(section(buffer));
        buffer = "";
      }
      for (let i = 0; i < paragraph.length; i += SECTION_CHUNK) {
        blocks.push(section(paragraph.slice(i, i + SECTION_CHUNK)));
      }
      continue;
    }
    const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (next.length > SECTION_CHUNK) {
      blocks.push(section(buffer));
      buffer = paragraph;
    } else {
      buffer = next;
    }
  }
  if (buffer) blocks.push(section(buffer));
  return blocks;
}

/** Enforce Slack's per-message block ceiling. */
export function capBlocks(blocks: Block[]): Block[] {
  if (blocks.length <= MAX_BLOCKS) return blocks;
  return [...blocks.slice(0, MAX_BLOCKS - 1), context("_…trimmed to fit one Slack message._")];
}

/**
 * The plain-text fallback every message needs.
 *
 * Slack uses it for the notification, the sidebar preview and every screen
 * reader. Omitting it produces a push notification that says "This content
 * can't be displayed" — on a phone, that is the whole message.
 */
export function fallback(text: string): string {
  return clip(toMrkdwn(text).replace(/\s+/g, " ").trim(), 200);
}

// ────────────────────────────────────────────────────────────── the task card

/**
 * A ramp task as the hire sees it: what it is, why it matters here, what they
 * need to know, and what "done" means.
 *
 * The `askIfStuck` line is phrased as a last resort on purpose. If the card
 * reads "stuck? go ask Johan", the hire asks Johan — and the product has just
 * become a routing table pointed at the one senior person it promised to
 * protect.
 */
export function taskBlocks(task: RampTask, opts: { heading?: string } = {}): Block[] {
  const blocks: Block[] = [];
  if (opts.heading) blocks.push(header(opts.heading));

  blocks.push(section(`*${toMrkdwn(task.title)}*  ·  _~${task.estimateMins} min_`));
  if (task.why.trim()) blocks.push(section(toMrkdwn(task.why)));
  blocks.push(section(`*What you need to know*\n${toMrkdwn(task.context)}`));
  blocks.push(section(`*Done when*\n${toMrkdwn(task.doneWhen)}`));
  blocks.push(
    context(
      `Ask me first — I have your team's Slack, docs and tickets. ` +
        `If it turns out only a person can settle it, I'll say so and point you at ${toMrkdwn(task.askIfStuck)}.`,
    ),
  );

  return capBlocks(blocks);
}

/** The task card's notification line. */
export function taskFallback(task: RampTask, heading?: string): string {
  return fallback(`${heading ? `${heading}: ` : ""}${task.title} (~${task.estimateMins} min)`);
}

// ───────────────────────────────────────────────────────── the escalation

/**
 * A blocker, as the manager channel sees it.
 *
 * ON WHAT IS NOT IN HERE — this is a product decision, not an oversight:
 *
 * No score. No completion percentage. No ramp velocity. No "engagement". No
 * rating, ranking or assessment of the new hire, in any field, ever. The card
 * names the person because the manager has to know whose path to clear, and it
 * describes the obstacle — never the human standing in front of it. "Staging
 * credentials have not been issued", never "the hire is struggling with setup".
 *
 * The reason is survival, not squeamishness. The buyer is a manager at a company
 * that hires for ownership and says so out loud. The first time this channel
 * shows them a number that ranks someone they hired three days ago, the tool
 * stops being onboarding and becomes surveillance — and it gets removed by the
 * same culture that bought it, usually after the new hire screenshots it first.
 * A blocker list makes the manager useful. A leaderboard makes them a monitor.
 *
 * `ASSESSMENT_LANGUAGE` below turns that rule into something the harness checks.
 */
export function blockerBlocks(
  blocker: Blocker,
  opts: {
    hireName: string;
    roleTitle: string;
    taskTitle?: string;
    /** Roster entry for `blocker.suggestedPerson`, when we can resolve one. */
    person?: Person;
  },
): Block[] {
  const minutes = blocker.minutesToUnblock;

  const facts: string[] = [];
  if (blocker.suggestedPerson) {
    const who = opts.person
      ? `${opts.person.name} (${opts.person.slackHandle}) — ${opts.person.role}`
      : blocker.suggestedPerson;
    facts.push(`*Who can clear it*\n${toMrkdwn(who)}`);
  }
  if (typeof minutes === "number") {
    facts.push(`*Their time*\n~${minutes} min`);
  }

  const blocks: Block[] = [
    header(":triangular_flag_on_post: A human is needed"),
    // Who and what they are working on. Identity, not evaluation.
    section(`*${toMrkdwn(opts.hireName)}* · ${toMrkdwn(opts.roleTitle)}`),
    // The obstacle, quoted. Blockquote keeps the model's wording visibly
    // separate from ours — nobody should have to guess which is which.
    section(
      toMrkdwn(blocker.summary)
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n"),
    ),
  ];

  if (facts.length > 0) {
    blocks.push({
      type: "section",
      fields: facts
        .slice(0, MAX_FIELDS)
        .map((text) => ({ type: "mrkdwn" as const, text: clip(text, FIELD_TEXT_LIMIT) })),
    });
  }

  if (opts.taskTitle) blocks.push(context(`On: ${toMrkdwn(opts.taskTitle)}`));

  blocks.push(
    context(
      "VANAV answers from your Slack, docs and tickets and posts nothing when it can. " +
        "This one it could not settle without a person.",
    ),
  );

  return capBlocks(blocks);
}

/** The escalation's notification line — the bit that lands on a phone. */
export function blockerFallback(blocker: Blocker, hireName: string): string {
  const mins = typeof blocker.minutesToUnblock === "number" ? ` (~${blocker.minutesToUnblock} min)` : "";
  return fallback(`${hireName} needs a human${mins}: ${blocker.summary}`);
}

// ──────────────────────────────────────────────────────────────── the opening

/**
 * Split the agent's opening message into prose and the task it describes.
 *
 * `openingMessage` writes one blob for the web panel: framing, then the first
 * task inline as markdown. Slack wants the framing as prose and the task as a
 * card, so we cut at the line that starts the task — a line we can identify
 * exactly, because we are holding the task and know its title.
 *
 * If the marker is not there (the plan was empty, or the wording changed), we
 * keep the whole message and still render the card. Slightly repetitive beats
 * silently dropping half the agent's first words.
 */
export function splitOpening(text: string, taskTitle?: string): { intro: string; matched: boolean } {
  if (!taskTitle) return { intro: text, matched: false };
  const lines = text.split("\n");
  const idx = lines.findIndex((line) => {
    const bare = line.replace(/[*_`]/g, "").trim();
    return bare.startsWith(taskTitle.replace(/[*_`]/g, "").trim());
  });
  if (idx <= 0) return { intro: text, matched: false };
  return { intro: lines.slice(0, idx).join("\n").trim(), matched: true };
}

// ─────────────────────────────────────────────────────── the surveillance guard

/**
 * Vocabulary that has no business on a blocker card.
 *
 * The system prompt already forbids assessing the person, and the schema has no
 * field for it. This is the third layer: a cheap check the harness runs over
 * every template we ship, and the bot runs over model output at runtime so a
 * regression shows up in the log instead of in a customer's Slack.
 *
 * It is a smoke alarm, not a filter. It never rewrites the agent's words —
 * silently editing an escalation would be a worse failure than the one it is
 * guarding against.
 */
export const ASSESSMENT_LANGUAGE: readonly RegExp[] = [
  /\bscore[sd]?\b/i,
  /\brating|rated\b/i,
  /\branking|ranked\b/i,
  /\bpercentile\b/i,
  /\bproductivity\b/i,
  /\bperformance\b/i,
  /\bvelocity\b/i,
  /\bengagement level\b/i,
  /\b\d{1,3}\s?% (complete|done|through|ramped)\b/i,
  /\b(doing|progressing) (well|poorly|badly)\b/i,
  /\b(struggl|underperform|falling behind)/i,
];

/** Returns the first assessment-flavoured phrase found, or `null`. */
export function findAssessmentLanguage(text: string): string | null {
  for (const pattern of ASSESSMENT_LANGUAGE) {
    const hit = pattern.exec(text);
    if (hit) return hit[0];
  }
  return null;
}

// ────────────────────────────────────────────────────────────────── misc

/** Roster lookup so an escalation can show a handle and a job title, not a bare name. */
export function findPerson(company: Company | undefined, name: string | undefined): Person | undefined {
  if (!company || !name) return undefined;
  const wanted = name.trim().toLowerCase();
  return company.people.find(
    (p) => p.name.toLowerCase() === wanted || p.slackHandle.toLowerCase() === wanted,
  );
}

/** `C0123ABCD` → `<#C0123ABCD>`; `#name` stays as typed. Slack only linkifies IDs. */
export function channelRef(channel: string): string {
  return /^[CG][A-Z0-9]{6,}$/.test(channel) ? `<#${channel}>` : channel;
}

/**
 * The placeholder that stands in while a turn is running.
 *
 * A supervision turn is 20–40 seconds because the whole corpus goes into the
 * model on every one of them. Slack has no typing indicator an app can drive,
 * so this is a real message the bot edits in place — the elapsed counter is the
 * part that matters, because thirty seconds of an unchanging bubble reads as
 * "it crashed" and thirty seconds of a ticking one reads as "it is working".
 */
export function thinkingBlocks(elapsedSeconds = 0, mode: "turn" | "derive" = "turn"): Block[] {
  const phases =
    mode === "derive"
      ? [
          "Reading your team's Slack, docs and tickets…",
          "Working out what this role actually is here…",
          "Building two days of real first work — a cold derivation takes a couple of minutes…",
        ]
      : [
          "Reading your team's Slack, docs and tickets…",
          "Checking whether your team already answered this somewhere…",
          "Still going — this one needs the whole corpus…",
        ];
  const phase = elapsedSeconds < 8 ? phases[0]! : elapsedSeconds < 20 ? phases[1]! : phases[2]!;
  const clock = elapsedSeconds >= 5 ? `  ·  ${elapsedSeconds}s` : "";
  return [context(`:hourglass_flowing_sand: ${phase}${clock}`)];
}

/**
 * A failure the hire can see, phrased for the person running the demo.
 *
 * Shown in place of the thinking bubble rather than swallowed: an agent that
 * goes quiet when it breaks is indistinguishable from one that is still
 * thinking, and the operator needs to know which it is without reading logs.
 */
export function errorBlocks(message: string): Block[] {
  return [
    section(`:warning: I couldn't finish that.\n\n\`\`\`${clip(message, 2500)}\`\`\``),
    context("This is the bot's own failure, not an answer. Check the terminal running the bot."),
  ];
}
