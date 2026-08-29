/**
 * Ingest: turning somebody else's mess into a `Company`.
 *
 * Everything upstream of this file is a demo. The seed corpus in
 * lib/seed/legora.ts is hand-built, well-formed and ours; a prospective
 * customer's corpus is a 40MB Slack export, or a CSV a paralegal made in
 * Excel, or four hundred lines pasted out of a Slack window thirty seconds
 * before a call starts. This module is the whole difference between "watch our
 * demo" and "point it at your Slack".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS MODULE NEVER THROWS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The realistic failure here is not malformed JSON, it is a human being pasting
 * something slightly wrong while a customer watches their screen. A thrown
 * error at that moment produces a 500 and the conversation is over — "it
 * doesn't work on our data" is what they remember, and they are right.
 *
 * So every entry point returns `{ company, warnings }` and every per-record
 * failure is caught, counted and reported. A corpus of 900 messages where 3
 * rows had an unparseable date is a *successful* ingest with a warning, not an
 * error. The warnings are surfaced in the UI before anyone spends money on a
 * derivation, which makes a partial parse honest rather than silent — the same
 * rule the grounding check follows: never show someone something that did not
 * happen, but never hide what did.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE CORPUS IS CAPPED
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * lib/agent/derive.ts deliberately does no retrieval: it ships the entire
 * corpus to Opus in one prompt, because the signal we need (three people
 * arguing past each other across two channels a week apart) is exactly what a
 * top-k retriever destroys. That is the right call for a few thousand
 * artifacts and a ruinous one for a year of #general — cost and latency scale
 * linearly with the corpus, and a real Slack export is easily 100x the size of
 * the seed.
 *
 * So the caps below are not defensive padding, they are a budget: ~1,500
 * artifacts / ~200k characters is roughly 50k tokens, about a dollar of Opus
 * per derivation, which is a price a pilot can absorb. Over that we keep the
 * most recent slice and say so out loud, because recent months describe the
 * role the company is hiring for now — and a truncation the user was told
 * about is a trade-off, while a silent one is a bug.
 */

import type { Artifact, Company, Person } from "@/lib/types";

// ────────────────────────────────────────────────────────────────── budget

/** Roughly 50k tokens of corpus — about a dollar of Opus per derivation. */
export const MAX_ARTIFACTS = 1500;
export const MAX_CORPUS_CHARS = 200_000;
/** One message should never eat the whole budget. Pasted docs do this. */
export const MAX_ARTIFACT_CHARS = 4_000;
/** Refuse to even tokenize past this. The route rejects earlier, with a 413. */
export const MAX_INPUT_CHARS = 8_000_000;
/** A roster longer than this stops being a roster and starts being a phone book. */
export const MAX_PEOPLE = 120;

// ─────────────────────────────────────────────────────────────────── types

export type SourceFormat =
  | "slack-export-json"
  | "slack-channels-json"
  | "records-json"
  | "csv"
  | "chat-log"
  | "documents"
  | "empty";

export type ParseOptions = {
  /** Display name of the company. */
  name: string;
  /** Provisional slug. The store owns final uniqueness. */
  slug?: string;
  /** One paragraph of public context, if the user gave us one. */
  description?: string;
  /**
   * Anchor for messages that carry a time but no date. Injectable so tests are
   * deterministic — and so nothing time-varying leaks in by accident.
   */
  now?: Date;
};

export type ParseResult = {
  company: Company;
  /** Everything we could not do, in plain English, for a human to read. */
  warnings: string[];
  format: SourceFormat;
  /** Channels seen, busiest first. */
  channels: { channel: string; count: number }[];
  /** ISO bounds of the corpus, if it had any artifacts. */
  dateRange?: { from: string; to: string };
  /**
   * True when at least one artifact's date was anchored rather than read.
   * The UI must say so — a date range we invented is worse than none.
   */
  datesInferred: boolean;
  /** Records recognised before dedupe and the corpus cap. */
  seen: number;
};

/** The neutral shape every format is normalised into before becoming an Artifact. */
type RawMessage = {
  author?: string;
  handle?: string;
  text: string;
  /** Anything date-shaped: unix seconds, ms, ISO, a spreadsheet date string. */
  ts?: string | number;
  channel?: string;
  title?: string;
  kind?: Artifact["kind"];
  /** Slack threads: the parent's ts. Kept only to order replies under parents. */
  threadTs?: string;
};

// ──────────────────────────────────────────────────────────── entry point

/**
 * Parse anything into a Company. Detection is by shape, not by file extension,
 * because the person pasting has no idea what format they are holding.
 */
export function parseCorpus(raw: string, options: ParseOptions): ParseResult {
  const warnings: string[] = [];
  const now = options.now ?? new Date();

  let input = typeof raw === "string" ? raw : "";
  if (input.length > MAX_INPUT_CHARS) {
    input = input.slice(0, MAX_INPUT_CHARS);
    warnings.push(
      `Input was longer than ${fmt(MAX_INPUT_CHARS)} characters and was cut off before parsing.`,
    );
  }

  let messages: RawMessage[] = [];
  let format: SourceFormat = "empty";

  try {
    const detected = detect(input, warnings);
    messages = detected.messages;
    format = detected.format;
  } catch (err) {
    // Belt and braces. Every sub-parser already catches per-record; this is the
    // guarantee that a bug in one of them still produces a page, not a 500.
    warnings.push(`Could not read this input (${(err as Error).message}). Nothing was imported.`);
    messages = [];
  }

  return assemble(messages, format, options, now, warnings);
}

// ────────────────────────────────────────────────────────────── detection

function detect(input: string, warnings: string[]): { messages: RawMessage[]; format: SourceFormat } {
  const trimmed = input.trim();
  if (!trimmed) return { messages: [], format: "empty" };

  // JSON first: it is the only format that identifies itself unambiguously.
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const json = tryJson(trimmed);
    if (json !== undefined) return fromJson(json, warnings);
    warnings.push(
      "This looked like JSON but would not parse; read as plain text instead. If it is a Slack export, check the file is complete.",
    );
  }

  // NDJSON — one JSON object per line, what `jq -c` and some exporters emit.
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length > 1 && lines.every((l) => l.trim().startsWith("{"))) {
    const rows = lines.map((l) => tryJson(l)).filter((v): v is unknown => v !== undefined);
    if (rows.length >= lines.length * 0.8) {
      return { messages: fromRecords(rows, warnings), format: "records-json" };
    }
  }

  if (looksLikeCsv(trimmed)) {
    const messages = fromCsv(trimmed, warnings);
    if (messages.length) return { messages, format: "csv" };
    warnings.push("This looked like a CSV but no rows survived; read as a chat log instead.");
  }

  return fromChatLog(trimmed, warnings);
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ──────────────────────────────────────────────────────────── JSON shapes

/**
 * The shapes a Slack export actually arrives in:
 *
 *   1. `[ {...message}, ... ]`            — one channel's day file, unzipped
 *   2. `{ "messages": [ ... ] }`          — the API / most wrappers
 *   3. `{ "#eng": [ ... ], "#ops": [...] }` — someone's flattened zip
 *   4. `[ { channel: "#eng", messages: [...] }, ... ]` — ditto, as an array
 *
 * Anything else object-shaped is treated as generic records, which is how CSV
 * rows and homegrown exports get in.
 */
function fromJson(json: unknown, warnings: string[]): { messages: RawMessage[]; format: SourceFormat } {
  if (Array.isArray(json)) {
    // Shape 4: an array of channel objects, each carrying its own messages.
    const grouped = json.filter(
      (v) => isObj(v) && Array.isArray(v.messages),
    ) as Array<Record<string, unknown>>;
    if (grouped.length && grouped.length === json.length) {
      const out: RawMessage[] = [];
      for (const group of grouped) {
        const channel = channelName(
          str(group.channel) ?? str(group.name) ?? str(group.channel_name),
        );
        out.push(...fromRecords(group.messages as unknown[], warnings, channel));
      }
      return { messages: out, format: "slack-channels-json" };
    }

    return {
      messages: fromRecords(json, warnings),
      format: looksSlack(json) ? "slack-export-json" : "records-json",
    };
  }

  if (isObj(json)) {
    // Shape 2.
    for (const key of ["messages", "records", "items", "data", "rows", "results"]) {
      const value = json[key];
      if (Array.isArray(value)) {
        return {
          messages: fromRecords(value, warnings),
          format: looksSlack(value) ? "slack-export-json" : "records-json",
        };
      }
    }

    // Shape 3: every value is an array of messages, keyed by channel.
    const entries = Object.entries(json).filter(([, v]) => Array.isArray(v));
    if (entries.length && entries.length === Object.keys(json).length) {
      const out: RawMessage[] = [];
      for (const [key, value] of entries) {
        out.push(...fromRecords(value as unknown[], warnings, channelName(key)));
      }
      return { messages: out, format: "slack-channels-json" };
    }

    // A single message object. Rare, but someone will do it.
    const one = toRawMessage(json, undefined);
    if (one) return { messages: [one], format: "records-json" };
  }

  warnings.push("The JSON parsed but held no recognisable messages.");
  return { messages: [], format: "empty" };
}

/** A Slack export is recognisable by `ts` plus `text`/`user` on its members. */
function looksSlack(rows: unknown[]): boolean {
  const sample = rows.slice(0, 25).filter(isObj);
  if (!sample.length) return false;
  const slackish = sample.filter(
    (r) => "ts" in r && ("text" in r || "user" in r || r.type === "message"),
  );
  return slackish.length >= sample.length * 0.6;
}

/** Subtypes that are Slack's own bookkeeping, not anything a human said. */
const NOISE_SUBTYPES = new Set([
  "channel_join",
  "channel_leave",
  "group_join",
  "group_leave",
  "channel_topic",
  "channel_purpose",
  "channel_name",
  "channel_archive",
  "channel_unarchive",
  "pinned_item",
  "unpinned_item",
  "bot_add",
  "bot_remove",
  "app_conversation_join",
  "reminder_add",
  "file_comment",
  "tombstone",
]);

function fromRecords(rows: unknown[], warnings: string[], channel?: string): RawMessage[] {
  const out: RawMessage[] = [];
  let skippedNoise = 0;
  let skippedBad = 0;

  for (const row of rows) {
    try {
      if (!isObj(row)) {
        skippedBad += 1;
        continue;
      }
      const subtype = str(row.subtype);
      if (subtype && NOISE_SUBTYPES.has(subtype)) {
        skippedNoise += 1;
        continue;
      }
      // `type` is "message" for messages; exports also carry channel metadata
      // rows, file rows and reactions we have no use for.
      const type = str(row.type);
      if (type && type !== "message" && !("text" in row) && !("message" in row)) {
        skippedNoise += 1;
        continue;
      }
      const message = toRawMessage(row, channel);
      if (message) out.push(message);
      else skippedBad += 1;
    } catch {
      skippedBad += 1;
    }
  }

  if (skippedNoise) {
    warnings.push(`Skipped ${fmt(skippedNoise)} join/leave/system events — they say nothing about the work.`);
  }
  if (skippedBad) {
    warnings.push(`Skipped ${fmt(skippedBad)} record(s) with no readable message text.`);
  }
  return out;
}

const AUTHOR_KEYS = [
  "author",
  "user_name",
  "username",
  "real_name",
  "display_name",
  "name",
  "from",
  "sender",
  "speaker",
  "user",
];
const TEXT_KEYS = ["text", "message", "body", "content", "msg", "comment", "description"];
const TS_KEYS = ["ts", "timestamp", "date", "time", "created_at", "createdAt", "datetime", "sent_at"];
const CHANNEL_KEYS = ["channel", "channel_name", "room", "conversation", "group", "source"];
const TITLE_KEYS = ["title", "subject", "summary", "heading"];

function toRawMessage(row: Record<string, unknown>, channel?: string): RawMessage | undefined {
  const text = firstString(row, TEXT_KEYS);
  if (!text) return undefined;

  // Slack puts the human-readable name under user_profile; `user` is a U-id.
  const profile = isObj(row.user_profile) ? row.user_profile : undefined;
  const profileName = profile
    ? str(profile.real_name) ?? str(profile.display_name) ?? str(profile.name)
    : undefined;

  const rawAuthor = profileName ?? firstString(row, AUTHOR_KEYS) ?? str(row.bot_id);
  const handle = profile
    ? str(profile.display_name) ?? str(profile.name)
    : str(row.username) ?? str(row.name);

  const cleaned = slackText(text);
  if (!cleaned) return undefined;

  return {
    author: rawAuthor ? cleanName(rawAuthor) : undefined,
    handle: handle ? handle.trim() : undefined,
    text: cleaned,
    ts: (firstString(row, TS_KEYS) ?? firstNumber(row, TS_KEYS)) as string | number | undefined,
    channel: channelName(firstString(row, CHANNEL_KEYS)) ?? channel,
    title: firstString(row, TITLE_KEYS),
    kind: asKind(str(row.kind) ?? str(row.artifact_kind)),
    threadTs: str(row.thread_ts),
  };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function firstString(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const hit = str(row[key]);
    if (hit) return hit;
  }
  return undefined;
}

function firstNumber(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

function asKind(value: string | undefined): Artifact["kind"] | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v.includes("slack") || v.includes("chat") || v.includes("message")) return "slack";
  if (v.includes("doc") || v.includes("page") || v.includes("wiki")) return "doc";
  if (v.includes("ticket") || v.includes("issue") || v.includes("jira")) return "ticket";
  if (v.includes("meeting") || v.includes("call") || v.includes("note")) return "meeting";
  return undefined;
}

// ───────────────────────────────────────────────────────── Slack mrkdwn

/**
 * Slack ships mrkdwn, not text: `<@U024BE7LH|bob>`, `<http://x|see this>`,
 * `&amp;`. Left as-is it teaches the model that the company writes in angle
 * brackets, and — worse — the grounding check verifies quotes against this
 * exact string, so whatever we store is what a citation has to match.
 * Normalise once, here, and every downstream check stays honest.
 */
function slackText(raw: string): string {
  return raw
    .replace(/<@([UW][A-Z0-9]+)\|([^>]+)>/g, "@$2")
    .replace(/<@([UW][A-Z0-9]+)>/g, "@$1")
    .replace(/<#C[A-Z0-9]+\|([^>]+)>/g, "#$1")
    .replace(/<#(C[A-Z0-9]+)>/g, "#$1")
    .replace(/<!(here|channel|everyone)(\|[^>]*)?>/g, "@$1")
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<(https?:\/\/[^>]+)>/g, "$1")
    .replace(/<mailto:[^|>]+\|([^>]+)>/g, "$1")
    // Entities last: unescaping first would let `&lt;@U1&gt;` become a real tag.
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

// ───────────────────────────────────────────────────────────────────── CSV

function looksLikeCsv(input: string): boolean {
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = sniffDelimiter(firstLine);
  if (!delimiter) return false;
  const header = splitCsvLine(firstLine, delimiter).map((h) => normaliseKey(h));
  // A header row is a header row only if we recognise a text-ish column in it.
  return header.some((h) => TEXT_KEYS.includes(h) || AUTHOR_KEYS.includes(h));
}

function sniffDelimiter(line: string): string | undefined {
  const counts: Array<[string, number]> = [
    [",", (line.match(/,/g) ?? []).length],
    [";", (line.match(/;/g) ?? []).length],
    ["\t", (line.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : undefined;
}

function normaliseKey(key: string): string {
  return key
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** RFC4180-ish: handles quotes, doubled quotes and newlines inside a field. */
function parseCsv(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function splitCsvLine(line: string, delimiter: string): string[] {
  return parseCsv(line, delimiter)[0] ?? [];
}

function fromCsv(input: string, warnings: string[]): RawMessage[] {
  const delimiter = sniffDelimiter(input.split(/\r?\n/, 1)[0] ?? "") ?? ",";
  const rows = parseCsv(input, delimiter);
  if (rows.length < 2) return [];

  const header = rows[0].map(normaliseKey);
  const unknown = header.filter(
    (h) =>
      h &&
      ![...TEXT_KEYS, ...AUTHOR_KEYS, ...TS_KEYS, ...CHANNEL_KEYS, ...TITLE_KEYS, "kind", "type"].includes(h),
  );
  if (unknown.length) {
    warnings.push(`Ignored unrecognised column(s): ${unknown.slice(0, 6).join(", ")}.`);
  }

  const out: RawMessage[] = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    try {
      const record: Record<string, unknown> = {};
      header.forEach((key, i) => {
        if (key) record[key] = row[i] ?? "";
      });
      const message = toRawMessage(record, undefined);
      if (message) out.push(message);
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }

  if (skipped) warnings.push(`Skipped ${fmt(skipped)} CSV row(s) with no message text.`);
  return out;
}

// ────────────────────────────────────────────────────────────── chat logs

const TIME_ONLY = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp])?\.?[Mm]?\.?$/;
const DATE_LIKE =
  /^(?:\d{4}-\d{2}-\d{2}(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?(?:Z|[+-]\d{2}:?\d{2})?|\d{1,2}\/\d{1,2}\/\d{2,4}(?:[, ]+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?)?)$/;
const CHANNEL_TOKEN = /^#[\w.\-/]+$/;
/** "Tuesday, 3 June" / "June 3, 2026" / "3 June 2026" — a day header, alone on a line. */
const DAY_HEADER =
  /^(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\s+)?(?:\d{1,2}\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+\d{1,2})?(?:,?\s+\d{4})?$/i;

/**
 * The format a human actually produces: they select a Slack channel, hit
 * cmd-C, and paste. Nothing about that is well-formed, so this parser is
 * deliberately structural rather than regex-per-format — split each line on
 * runs of whitespace/pipes, then classify the fields by what they look like
 * (a `#channel`, a clock time, a short name, the rest is the message). It
 * copes with `#eng  Ada  10:32  text`, `Ada: text`, `[10:32] Ada: text` and
 * pipe-delimited variants without needing to know which one it was handed.
 */
function fromChatLog(input: string, warnings: string[]): { messages: RawMessage[]; format: SourceFormat } {
  const lines = input.split(/\r?\n/);
  const repeatedNames = repeatedColonNames(lines);
  const messages: RawMessage[] = [];
  let current: RawMessage | undefined;
  let currentChannel: string | undefined;
  let currentDay: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      // A blank line ends a message but not a channel or a day.
      current = undefined;
      continue;
    }

    // A lone `#channel` line: Slack copy/paste puts the channel on its own line.
    if (CHANNEL_TOKEN.test(trimmed)) {
      currentChannel = channelName(trimmed);
      current = undefined;
      continue;
    }

    // A lone date line sets the day for the time-only messages under it.
    if (DATE_LIKE.test(trimmed) || DAY_HEADER.test(trimmed)) {
      const day = parseDayHeader(trimmed);
      if (day) {
        currentDay = day;
        current = undefined;
        continue;
      }
    }

    const parsed = parseLogLine(trimmed, repeatedNames);
    if (parsed) {
      const message: RawMessage = {
        ...parsed,
        channel: parsed.channel ?? currentChannel,
        ts: composeTs(currentDay, parsed.ts),
      };
      messages.push(message);
      current = message;
      continue;
    }

    if (current) {
      // A wrapped line, or the second paragraph of the same message.
      current.text = `${current.text}\n${trimmed}`;
      continue;
    }

    // Unheaded prose. Start a document-shaped artifact and keep appending; a
    // pasted doc is a perfectly reasonable thing to hand us.
    current = { text: trimmed, kind: "doc", channel: currentChannel };
    messages.push(current);
  }

  const headed = messages.filter((m) => m.author).length;
  if (messages.length && headed === 0) {
    warnings.push(
      "No author/time structure was recognised, so the text was imported as documents with no named author. Escalation routing will be weak without names — a `Name  10:32  message` layout works much better.",
    );
    return { messages, format: "documents" };
  }
  if (messages.length && headed < messages.length * 0.5) {
    warnings.push(
      `Only ${fmt(headed)} of ${fmt(messages.length)} blocks had a recognisable author; the rest were imported as unattributed notes.`,
    );
  }

  return { messages, format: "chat-log" };
}

function parseLogLine(line: string, repeatedNames: Set<string>): RawMessage | undefined {
  // 1. Field-shaped: two-or-more spaces, tabs or pipes as column separators.
  const fields = line
    .split(/\t+|\s{2,}|\s*\|\s*/)
    .map((f) => f.trim())
    .filter(Boolean);

  if (fields.length >= 3) {
    const rest: string[] = [];
    let channel: string | undefined;
    let ts: string | undefined;

    for (const field of fields) {
      if (!channel && CHANNEL_TOKEN.test(field)) channel = channelName(field);
      else if (!ts && (TIME_ONLY.test(field) || DATE_LIKE.test(field))) ts = field;
      else rest.push(field);
    }

    // Only trust this shape when there is corroborating structure — otherwise
    // ordinary prose that happens to contain a double space gets mangled into
    // an author and a message.
    if ((channel || ts) && rest.length >= 2 && isNameLike(rest[0])) {
      const author = stripHandle(rest[0]);
      return {
        author: cleanName(author.name),
        handle: author.handle,
        text: slackText(rest.slice(1).join("  ")),
        ts,
        channel,
      };
    }
  }

  // 2. `[10:32] Ada Lovelace: text`, `Ada Lovelace (10:32): text`, `Ada: text`.
  const colon = /^(?:\[([^\]]{1,32})\]\s*)?(?:(#[\w.\-/]+)\s+)?([^:]{1,64}?)\s*(?:[([]([^)\]]{1,32})[)\]])?\s*:\s+(.+)$/.exec(
    line,
  );
  if (colon) {
    const [, bracketTime, chan, rawName, parenTime, text] = colon;
    const time = bracketTime ?? parenTime;
    if (isNameLike(rawName) && isAuthorLike(rawName, time, repeatedNames) && text.trim()) {
      const author = stripHandle(rawName);
      return {
        author: cleanName(author.name),
        handle: author.handle,
        text: slackText(text),
        ts: time && (TIME_ONLY.test(time.trim()) || DATE_LIKE.test(time.trim())) ? time.trim() : undefined,
        channel: chan ? channelName(chan) : undefined,
      };
    }
  }

  return undefined;
}

/** A person's name, not a sentence. Five words, no terminal punctuation, no URL. */
function isNameLike(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 48) return false;
  if (/[.!?]$/.test(v)) return false;
  if (/https?:\/\//.test(v)) return false;
  return v.split(/\s+/).length <= 5;
}

/**
 * Words that begin a line and are followed by a colon without being anybody's
 * name. `Open: who reviews prompts?` in a pasted doc is a section header, and
 * reading it as a message from a person called "Open" puts a fictional
 * colleague on the roster the agent can escalate to. Hence the belt-and-braces
 * rule below: a one-word author is only believed when it recurs, or when a
 * clock time sits next to it.
 */
const NOT_A_NAME = new Set([
  "note", "notes", "open", "todo", "fixme", "warning", "caution", "summary",
  "context", "goal", "goals", "status", "owner", "owners", "decision",
  "decisions", "problem", "background", "next", "action", "actions", "update",
  "updates", "edit", "ps", "nb", "tldr", "example", "question", "answer",
  "agenda", "attendees", "date", "time", "from", "to", "cc", "subject", "re",
  "http", "https", "risk", "risks", "scope", "why", "what", "who", "when",
  "how", "result", "outcome", "blockers", "blocker", "asks", "ask", "tl;dr",
]);

/** A one-word author is believed only with corroboration; two words stands alone. */
function isAuthorLike(value: string, time: string | undefined, repeated: Set<string>): boolean {
  const name = value.trim();
  const words = name.split(/\s+/);
  if (words.length >= 2) return true;
  if (NOT_A_NAME.has(name.toLowerCase().replace(/[^a-z;]/g, ""))) return false;
  if (time) return true;
  return repeated.has(name.toLowerCase());
}

/**
 * Pass one over the input: which single-word `Name:` prefixes recur?
 *
 * A person speaks more than once in a chat log; a document's section headers
 * are each written once. That difference is the cheapest available signal for
 * telling `Ada: ...` from `Open: ...`, and it needs the whole input, so it is
 * computed before the line loop rather than guessed line by line.
 */
function repeatedColonNames(lines: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const m = /^\s*(?:\[[^\]]{1,32}\]\s*)?([A-Za-z][\w.'-]{0,31})\s*:\s+\S/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, n]) => n >= 2).map(([k]) => k));
}

/** "Ada Lovelace (@ada)" / "@ada" → a name and, if offered, a handle. */
function stripHandle(value: string): { name: string; handle?: string } {
  const withParen = /^(.*?)\s*[(<]?@([\w.\-]+)[)>]?$/.exec(value.trim());
  if (withParen) {
    const name = withParen[1].trim();
    return { name: name || withParen[2], handle: `@${withParen[2]}` };
  }
  return { name: value.trim() };
}

function parseDayHeader(value: string): string | undefined {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  // "Tuesday, 3 June" with no year — try again with the current year appended.
  const withYear = new Date(`${value} ${new Date().getUTCFullYear()}`);
  if (!Number.isNaN(withYear.getTime())) return withYear.toISOString().slice(0, 10);
  return undefined;
}

/** A time-of-day is only a timestamp once it has a day under it. */
function composeTs(day: string | undefined, ts: string | number | undefined): string | undefined {
  if (ts === undefined || ts === "") return day ? `${day}T00:00:00.000Z` : undefined;
  if (typeof ts === "number") return String(ts);
  const time = TIME_ONLY.exec(ts.trim());
  if (!time) return ts;
  let hour = Number(time[1]);
  const minute = Number(time[2]);
  const second = Number(time[3] ?? 0);
  const meridiem = time[4]?.toLowerCase();
  if (meridiem === "p" && hour < 12) hour += 12;
  if (meridiem === "a" && hour === 12) hour = 0;
  const hhmmss = `${pad(hour)}:${pad(minute)}:${pad(second)}`;
  // No day header anywhere: hand back a bare time and let `assemble` anchor it,
  // so the "dates were inferred" warning fires exactly once, in one place.
  return day ? `${day}T${hhmmss}.000Z` : `T${hhmmss}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// ─────────────────────────────────────────────────────────── timestamps

function toIso(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;

  if (typeof value === "number") return fromEpoch(value);

  const s = String(value).trim();
  if (!s) return undefined;

  // Slack `ts`: unix seconds, with microseconds after the dot. Not a float we
  // want rounded — the integer part is the second, the rest is a tiebreak.
  if (/^\d{9,}(\.\d+)?$/.test(s)) return fromEpoch(Number(s));
  // Millisecond epochs, which some exporters emit as strings.
  if (/^\d{13}$/.test(s)) return fromEpoch(Number(s));

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function fromEpoch(n: number): string | undefined {
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const ms = n > 1e11 ? n : n * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return undefined;
  // Anything outside a plausible window is a unit mistake, not a date.
  const year = d.getUTCFullYear();
  if (year < 1990 || year > 2100) return undefined;
  return d.toISOString();
}

// ───────────────────────────────────────────────────────────── assembly

function assemble(
  messages: RawMessage[],
  format: SourceFormat,
  options: ParseOptions,
  now: Date,
  warnings: string[],
): ParseResult {
  const seen = messages.length;
  const anchorDay = now.toISOString().slice(0, 10);
  let datesInferred = false;
  let undated = 0;
  let truncatedText = 0;

  type Staged = Artifact & { sortKey: string };
  const staged: Staged[] = [];
  /**
   * Counter keyed on the *id prefix*, not the channel.
   *
   * `slugPart` is lossy — it lowercases, collapses punctuation and cuts at 24
   * characters — so two genuinely different channels (`#eng_legal` and
   * `#eng-legal`, or two names that differ only past character 24) share one
   * prefix. Counting per channel then hands both of them `-001` and the corpus
   * ships two artifacts with the same id, which `groundEvidence` resolves
   * last-one-wins: a correct citation against the first is silently dropped as
   * unverifiable. Counting per prefix makes the emitted id unique by
   * construction.
   */
  const perIdPrefix = new Map<string, number>();
  const seenKeys = new Set<string>();
  let duplicates = 0;

  messages.forEach((message, index) => {
    try {
      let text = message.text.trim();
      if (!text) return;

      if (text.length > MAX_ARTIFACT_CHARS) {
        text = `${text.slice(0, MAX_ARTIFACT_CHARS)}… [truncated]`;
        truncatedText += 1;
      }

      const channel = message.channel ?? defaultChannel(format);
      const author = message.author?.trim() || "Unknown";

      // Exports overlap: the same message shows up in a day file and in a
      // thread dump. Deduping keeps the budget for actual content.
      const key = `${author}|${channel}|${text.slice(0, 160)}|${message.ts ?? ""}`;
      if (seenKeys.has(key)) {
        duplicates += 1;
        return;
      }
      seenKeys.add(key);

      // A bare `T10:32:00` came out of the chat-log parser with no day under
      // it. Anchor it, once, and tell the user the dates are not real.
      let rawTs = message.ts;
      if (typeof rawTs === "string" && rawTs.startsWith("T")) {
        rawTs = `${anchorDay}${rawTs}.000Z`;
        datesInferred = true;
      }

      let iso = toIso(rawTs);
      if (!iso) {
        // Ordering still has to be stable and total: renderCorpus sorts by
        // timestamp, so undated messages keep their input order via a
        // second-per-message offset rather than collapsing into one instant.
        iso = new Date(Date.parse(`${anchorDay}T00:00:00.000Z`) + index * 1000).toISOString();
        datesInferred = true;
        undated += 1;
      }

      const kind = message.kind ?? kindFor(format);
      const idPrefix = `${kind}-${slugPart(channel)}`;
      const n = (perIdPrefix.get(idPrefix) ?? 0) + 1;
      perIdPrefix.set(idPrefix, n);

      staged.push({
        // Readable and stable: `slack-legal-eng-004`. The model has to copy
        // these back verbatim as citations, so they need to be short and
        // unambiguous, and they must not move if the same corpus is re-read.
        id: `${idPrefix}-${String(n).padStart(3, "0")}`,
        kind,
        channel,
        author,
        timestamp: iso,
        title: message.title,
        text,
        sortKey: iso,
      });
    } catch {
      // One bad record is never worth the other 1,499.
    }
  });

  if (duplicates) warnings.push(`Removed ${fmt(duplicates)} duplicate message(s).`);
  if (truncatedText) {
    warnings.push(`Shortened ${fmt(truncatedText)} very long message(s) to ${fmt(MAX_ARTIFACT_CHARS)} characters each.`);
  }
  if (undated) {
    warnings.push(
      `${fmt(undated)} message(s) had no readable date. They keep their original order, but the dates shown for them are placeholders, not real.`,
    );
  }

  staged.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  // ── the budget, enforced newest-first ──────────────────────────────────
  let kept = staged;

  if (kept.length > MAX_ARTIFACTS) {
    const dropped = kept.length - MAX_ARTIFACTS;
    kept = kept.slice(-MAX_ARTIFACTS);
    warnings.push(
      `Corpus capped at ${fmt(MAX_ARTIFACTS)} messages: kept the ${fmt(MAX_ARTIFACTS)} most recent and dropped ${fmt(dropped)} older one(s). The whole corpus goes to the model in one prompt, so size is cost.`,
    );
  }

  let total = kept.reduce((sum, a) => sum + a.text.length, 0);
  if (total > MAX_CORPUS_CHARS) {
    let cut = 0;
    while (kept.length > 1 && total > MAX_CORPUS_CHARS) {
      total -= kept[0].text.length;
      kept = kept.slice(1);
      cut += 1;
    }
    warnings.push(
      `Corpus capped at ${fmt(MAX_CORPUS_CHARS)} characters: dropped ${fmt(cut)} of the oldest message(s) to stay inside one model call.`,
    );
  }

  const artifacts: Artifact[] = kept.map(({ sortKey: _sortKey, ...artifact }) => artifact);

  const { people, channels, truncatedPeople } = buildPeople(artifacts, messages);
  if (truncatedPeople) {
    warnings.push(
      `${fmt(truncatedPeople)} person/people with the fewest messages were left off the roster (kept the ${fmt(MAX_PEOPLE)} most active).`,
    );
  }

  if (!artifacts.length) {
    warnings.push("No messages were found in this input.");
  } else if (!people.length) {
    warnings.push("No author names were found, so there is nobody for the agent to escalate a blocker to.");
  }

  const dateRange = artifacts.length
    ? { from: artifacts[0].timestamp, to: artifacts[artifacts.length - 1].timestamp }
    : undefined;

  const company: Company = {
    slug: options.slug ?? slugify(options.name) ?? "company",
    name: options.name.trim() || "Untitled company",
    description: options.description?.trim() || describe(options.name, artifacts, people, channels, dateRange),
    people,
    artifacts,
  };

  if (!options.description?.trim() && artifacts.length) {
    warnings.push(
      "No company description was given. The derivation works without one, but a sentence on what the company sells makes the role noticeably more specific.",
    );
  }

  return {
    company,
    warnings,
    format,
    channels,
    dateRange,
    datesInferred,
    seen,
  };
}

function defaultChannel(format: SourceFormat): string {
  return format === "documents" ? "#imported-docs" : "#imported";
}

function kindFor(format: SourceFormat): Artifact["kind"] {
  return format === "documents" ? "doc" : "slack";
}

// ────────────────────────────────────────────────────────────────── people

/**
 * The roster, derived from who talks and where.
 *
 * `owns` is deliberately left empty. We know who posts in #billing; we do NOT
 * know that they own billing, and the difference matters — `owns` is what the
 * agent routes a blocker on, so a guess here sends a stuck new hire to the
 * wrong person with full confidence. lib/agent/derive.ts already renders an
 * empty `owns` as "unspecified", and lib/agent/supervise.ts picks an escalation
 * target from the roster and the corpus rather than from `owns` alone, so the
 * product degrades to "here is who talks about this" instead of lying.
 *
 * `team` is the busiest channel the person posts in. That is a fact about the
 * corpus rather than an inference about the org chart, and it is stated as
 * such: the model sees `#billing`, not "Billing team".
 */
function buildPeople(
  artifacts: Artifact[],
  messages: RawMessage[],
): { people: Person[]; channels: { channel: string; count: number }[]; truncatedPeople: number } {
  const handles = new Map<string, string>();
  for (const message of messages) {
    if (message.author && message.handle && !handles.has(message.author)) {
      handles.set(message.author, message.handle.startsWith("@") ? message.handle : `@${message.handle}`);
    }
  }

  const byAuthor = new Map<string, { count: number; channels: Map<string, number> }>();
  const byChannel = new Map<string, number>();

  for (const artifact of artifacts) {
    const channel = artifact.channel ?? "#imported";
    byChannel.set(channel, (byChannel.get(channel) ?? 0) + 1);

    // "Unknown" is a placeholder, not a colleague — it must never end up on a
    // roster the agent can escalate to.
    if (!artifact.author || artifact.author === "Unknown") continue;

    const entry = byAuthor.get(artifact.author) ?? { count: 0, channels: new Map() };
    entry.count += 1;
    entry.channels.set(channel, (entry.channels.get(channel) ?? 0) + 1);
    byAuthor.set(artifact.author, entry);
  }

  const ranked = [...byAuthor.entries()].sort((a, b) => b[1].count - a[1].count);
  const truncatedPeople = Math.max(0, ranked.length - MAX_PEOPLE);

  const used = new Set<string>();
  const people: Person[] = ranked.slice(0, MAX_PEOPLE).map(([name, entry]) => {
    const topChannel = [...entry.channels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "#imported";
    return {
      name,
      // Honest placeholders. The message count is a real signal about who is
      // central here; a job title would be one we made up.
      role: `Role not stated in the corpus · ${entry.count} message${entry.count === 1 ? "" : "s"}`,
      team: topChannel,
      owns: [],
      slackHandle: uniqueHandle(handles.get(name) ?? handleFor(name), used),
    };
  });

  const channels = [...byChannel.entries()]
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count);

  return { people, channels, truncatedPeople };
}

function handleFor(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return `@${base || "user"}`;
}

function uniqueHandle(handle: string, used: Set<string>): string {
  let candidate = handle;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${handle}${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

// ───────────────────────────────────────────────────────────────── helpers

function cleanName(value: string): string {
  return value
    .replace(/[:\-–—]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
}

function channelName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const bare = value.trim().replace(/^#+/, "");
  if (!bare) return undefined;
  return `#${bare.toLowerCase().replace(/\s+/g, "-").slice(0, 48)}`;
}

function slugPart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/^#/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "general"
  );
}

/** URL-safe, readable, and never empty. The store owns uniqueness. */
export function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "company"
  );
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * The fallback company description.
 *
 * Deliberately a statement of what we actually have rather than a summary of
 * the company — we have never heard of this company and inventing a paragraph
 * about it would put fiction directly into the derivation prompt.
 */
function describe(
  name: string,
  artifacts: Artifact[],
  people: Person[],
  channels: { channel: string; count: number }[],
  dateRange?: { from: string; to: string },
): string {
  if (!artifacts.length) return `${name}. No corpus was imported.`;
  const window = dateRange ? `${dateRange.from.slice(0, 10)} to ${dateRange.to.slice(0, 10)}` : "an unknown period";
  const top = channels
    .slice(0, 6)
    .map((c) => c.channel)
    .join(", ");
  return (
    `${name}. No public description was supplied, so what follows is only what the imported corpus shows: ` +
    `${fmt(artifacts.length)} messages from ${fmt(people.length)} people across ${fmt(channels.length)} channel(s) ` +
    `(${top}), spanning ${window}. Treat anything not evidenced in the corpus below as unknown.`
  );
}
