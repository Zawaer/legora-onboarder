/**
 * What the corpus contains, and what it structurally cannot.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * Every product that has tried to locate expertise inside a company — Tacit,
 * Aardvark, AskMe, Starmind, Jive, Yammer, Microsoft Viva Topics — shipped a
 * ranking and never shipped a receipt. Viva Topics had perfect distribution,
 * full graph access and zero customer-acquisition cost, and was retired in under
 * four years. The failure was never retrieval quality. It was that the answer
 * arrived with no way to check what it was standing on.
 *
 * The structural argument is not soft. Kossinets (2006) measured what missing
 * actors do to an inferred network: roughly 8% of actors absent produces more
 * than 10% structural error, and assortativity can flip sign outright. A Slack
 * export is missing far more than 8% of the actors in a company's working life —
 * it is missing every conversation that happened in a DM, a huddle, a meeting
 * room or a corridor. So the derivation this product sells is built on a sample
 * whose bias cannot be estimated from inside the sample.
 *
 * The response is not to hedge the derivation. It is to state the sample, first
 * class and unprompted. A buyer already knows their Slack is not the whole
 * picture; the only surprising move available is to be the vendor that says so.
 *
 * ── THREE RULES THIS FILE ENFORCES ───────────────────────────────────────────
 *
 * 1. NEVER INVENT A DENOMINATOR.
 *    "We see 34% of this person's communication" is unknowable: the denominator
 *    is their total communication, and the missing part is missing — that is
 *    what missing means. Estimating it would require assuming what fraction of
 *    work talk happens in exported public Slack, which is exactly the invented
 *    number this feature exists to prevent.
 *
 *    Three proportions here ARE defensible, because their denominators are
 *    things we actually hold and can name in the same breath:
 *      • share OF THE CORPUS by author — denominator: artifacts we hold;
 *      • roster names that appear at all — denominator: the roster we were given;
 *      • days with any artifact — denominator: the corpus's own date span.
 *    Every one of them is a statement about the corpus. None is a statement
 *    about a person's communication, and none may be relabelled as one.
 *
 * 2. IT IS A SPEC SHEET, NOT A DISCLAIMER.
 *    Flat, factual, unhedged. No "unfortunately", no "please note", no apology.
 *    "No direct messages." is the whole sentence.
 *
 * 3. NO SCORES OR RATINGS OF PEOPLE.
 *    The product bans them in four places already, and per-person volume is the
 *    most obvious place to smuggle one back in. Everything below is phrased as a
 *    property of the corpus — "the corpus holds 12 artifacts written by X" —
 *    never as a property of X. Volume in a Slack export measures how much
 *    someone types in public, and nothing else.
 *
 * Pure arithmetic over a `Company`: no model call, no filesystem, no clock. It
 * costs nothing and returns instantly, which is why it can run on every render
 * and be attached to every response rather than being a page someone has to go
 * and find.
 */

import type { Artifact, Company, Person } from "@/lib/types";

/* ── tunables ──────────────────────────────────────────────────────────────
   Thresholds are stated here rather than inline so the numbers can be argued
   with. Each one answers "below this, what would a careful reader want told to
   them without asking?" — none of them is a quality bar the corpus passes or
   fails.                                                                    */

/** Below this many artifacts, a derivation rests on a readable-in-one-sitting handful. */
const THIN_CORPUS = 12;
/** Below this many distinct authors, the corpus is a conversation, not a company. */
const FEW_AUTHORS = 4;
/** Under a month of elapsed time: nothing quarterly, seasonal or annual is in view. */
const NARROW_WINDOW_DAYS = 30;
/** One author writing at least this share of everything shapes the whole reading. */
const CONCENTRATED = 0.4;
/** A silent stretch this long inside the span is a hole, not a weekend. */
const GAP_DAYS = 7;
/** At or below this many artifacts, the corpus does not characterise how someone works. */
const THIN_SLICE = 2;
/** Below this many artifacts, a percentage is a decimal point pretending to be precision. */
const SHARE_FLOOR = 20;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_MS = 86_400_000;

/* ── types ─────────────────────────────────────────────────────────────── */

/** A `Company` satisfies this. Callers holding only a corpus can pass that. */
export type CoverageSource = Pick<Company, "artifacts"> &
  Partial<Pick<Company, "name" | "people">>;

export type KindCount = { kind: Artifact["kind"]; artifacts: number };

export type ChannelCount = { channel: string; artifacts: number };

/**
 * How much of the corpus one name wrote.
 *
 * Read the field names literally: `artifacts` is a count of things we hold, and
 * `share` is a share OF THAT CORPUS. Neither is a measure of the person. A name
 * with two artifacts is a name the corpus says almost nothing about — which is a
 * fact about our sample, not about them.
 */
export type PersonCoverage = {
  name: string;
  /** Role as the roster states it. Absent when the name only appears as an author. */
  role?: string;
  /** Artifacts in the corpus written by this name. */
  artifacts: number;
  /** Fraction of the artifacts we hold. Denominator: the corpus. Never their communication. */
  share: number;
  /** Distinct channels/locations this name appears in, within the corpus. */
  channels: string[];
  kinds: KindCount[];
  /** ISO 8601, from the corpus. */
  firstSeen?: string;
  lastSeen?: string;
  /** True when the corpus holds too little from this name to describe how they work. */
  thinSlice: boolean;
  /** True when the name is on the roster we were given. */
  onRoster: boolean;
};

export type DateSpan = {
  /** ISO 8601 of the earliest and latest artifact. */
  first?: string;
  last?: string;
  /** Inclusive calendar days between them. */
  days: number;
  /** Days in that window carrying at least one artifact. */
  daysWithArtifacts: number;
  /** No silent stretch of GAP_DAYS or more inside the span. */
  contiguous: boolean;
  gaps: { from: string; to: string; days: number }[];
  /** True when every silent day inside the span falls on a Saturday or Sunday. */
  silentDaysAreWeekends: boolean;
};

export type CoverageQualifierId =
  | "thin-corpus"
  | "few-authors"
  | "narrow-window"
  | "single-day"
  | "single-channel"
  | "concentrated"
  | "gapped-window"
  | "roster-silence";

/** A named reason the derivation is standing on less than its confidence implies. */
export type CoverageQualifier = {
  id: CoverageQualifierId;
  /** One flat sentence. Fact first. */
  headline: string;
  /** What it means for anything derived from this corpus. */
  detail: string;
};

/** Categorical absence: a thing the corpus cannot contain, whatever its size. */
export type Absence = { what: string; detail: string };

/**
 * A qualifier for the corpus, not a confidence in the person or the model.
 *  • thin      — a handful of artifacts, or a handful of voices, or a single day.
 *  • partial   — enough to derive from, with named limits worth stating out loud.
 *  • broad     — many voices over a real stretch of time. Still Slack, still not everything.
 */
export type CoverageStanding = "thin" | "partial" | "broad";

export type CoverageReport = {
  companyName?: string;
  /** Total artifacts held. */
  artifacts: number;
  byKind: KindCount[];
  channels: ChannelCount[];
  /**
   * Distinct Slack channels, counted separately from doc/ticket/meeting
   * locations. Calling a Notion page a "channel" inflates the apparent breadth
   * of the export, which is the one direction this file must never round in.
   */
  slackChannels: number;
  /** Distinct names that wrote at least one artifact. */
  authors: number;
  /** Descending by share of the corpus. Corpus composition, not a ranking of people. */
  people: PersonCoverage[];
  /** Present when a roster was supplied alongside the corpus. */
  roster?: {
    size: number;
    /** Roster names appearing at least once as an author. */
    appearing: number;
    /** Roster names the corpus never hears from. */
    silent: string[];
    /** Roster names present at or below THIN_SLICE artifacts. */
    barelyPresent: string[];
    /**
     * False when the roster carries nothing the corpus does not already say —
     * which is the case for an ingested export, where `lib/ingest/parse.ts`
     * builds the roster out of the authors it found. "3 of 3 people appear"
     * then measures nothing, and printing it as corroboration would be the
     * hollow reassurance this whole file exists to refuse.
     */
    independent: boolean;
  };
  span: DateSpan;
  /** What is missing by construction. Not ranked, not softened. */
  absent: Absence[];
  qualifiers: CoverageQualifier[];
  standing: CoverageStanding;
  /** One sentence of spec: counts, voices, window. */
  headline: string;
  /** One sentence on what that means for anything derived from it. */
  standingLine: string;
  /** False when the corpus is too small for a percentage to carry information. */
  sharesMeaningful: boolean;
  /** The standing sentence about the one proportion we refuse to compute. */
  denominatorNote: string;
};

/* ── date helpers (UTC everywhere: no locale, no hydration drift) ───────── */

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** "10 Aug 2026". Stable on server and client. */
export function coverageDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function isWeekend(dayIso: string): boolean {
  const wd = new Date(`${dayIso}T00:00:00Z`).getUTCDay();
  return wd === 0 || wd === 6;
}

function addDays(dayIso: string, n: number): string {
  return new Date(new Date(`${dayIso}T00:00:00Z`).getTime() + n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/* ── the computation ───────────────────────────────────────────────────── */

export function computeCoverage(source: CoverageSource): CoverageReport {
  const artifacts = (source.artifacts ?? []).filter((a) => a && typeof a.id === "string");
  const roster: Person[] = source.people ?? [];
  const total = artifacts.length;

  /* by kind */
  const kindTally = new Map<Artifact["kind"], number>();
  for (const a of artifacts) kindTally.set(a.kind, (kindTally.get(a.kind) ?? 0) + 1);
  const byKind: KindCount[] = [...kindTally]
    .map(([kind, n]) => ({ kind, artifacts: n }))
    .sort((x, y) => y.artifacts - x.artifacts);

  /* by channel — a doc's location counts as a location; an artifact with none
     is not silently dropped, because "we do not know where this came from" is
     itself a coverage fact. */
  const channelTally = new Map<string, number>();
  for (const a of artifacts) {
    const c = a.channel ?? "(no location recorded)";
    channelTally.set(c, (channelTally.get(c) ?? 0) + 1);
  }
  const channels: ChannelCount[] = [...channelTally]
    .map(([channel, n]) => ({ channel, artifacts: n }))
    .sort((x, y) => y.artifacts - x.artifacts || x.channel.localeCompare(y.channel));

  /* per-name slices of the corpus */
  type Acc = {
    n: number;
    channels: Set<string>;
    kinds: Map<Artifact["kind"], number>;
    first?: string;
    last?: string;
  };
  const acc = new Map<string, Acc>();
  for (const a of artifacts) {
    const name = (a.author ?? "").trim() || "(unattributed)";
    let e = acc.get(name);
    if (!e) {
      e = { n: 0, channels: new Set(), kinds: new Map() };
      acc.set(name, e);
    }
    e.n += 1;
    if (a.channel) e.channels.add(a.channel);
    e.kinds.set(a.kind, (e.kinds.get(a.kind) ?? 0) + 1);
    if (!e.first || a.timestamp < e.first) e.first = a.timestamp;
    if (!e.last || a.timestamp > e.last) e.last = a.timestamp;
  }

  const rosterByName = new Map(roster.map((p) => [p.name, p]));

  const people: PersonCoverage[] = [...acc]
    .map(([name, e]) => ({
      name,
      role: rosterByName.get(name)?.role,
      artifacts: e.n,
      share: total > 0 ? e.n / total : 0,
      channels: [...e.channels],
      kinds: [...e.kinds]
        .map(([kind, n]) => ({ kind, artifacts: n }))
        .sort((x, y) => y.artifacts - x.artifacts),
      firstSeen: e.first,
      lastSeen: e.last,
      thinSlice: e.n <= THIN_SLICE,
      onRoster: rosterByName.has(name),
    }))
    // Descending volume. This orders the *corpus composition* — it is the only
    // way to make "one person wrote a third of everything" visible at a glance,
    // which is the fact that most changes how the derivation should be read.
    .sort((x, y) => y.artifacts - x.artifacts || x.name.localeCompare(y.name));

  const authorNames = new Set(people.map((p) => p.name));
  const rosterBlock = roster.length
    ? {
        size: roster.length,
        appearing: roster.filter((p) => authorNames.has(p.name)).length,
        silent: roster.filter((p) => !authorNames.has(p.name)).map((p) => p.name),
        barelyPresent: people
          .filter((p) => p.onRoster && p.thinSlice)
          .map((p) => p.name),
      }
    : undefined;

  /* the window */
  const stamps = artifacts
    .map((a) => a.timestamp)
    .filter((t): t is string => typeof t === "string" && !Number.isNaN(new Date(t).getTime()))
    .sort();
  const first = stamps[0];
  const last = stamps[stamps.length - 1];
  const firstDay = first ? dayKey(first) : undefined;
  const lastDay = last ? dayKey(last) : undefined;

  const activeDays = new Set(stamps.map(dayKey));
  const spanDays =
    firstDay && lastDay
      ? Math.round(
          (new Date(`${lastDay}T00:00:00Z`).getTime() -
            new Date(`${firstDay}T00:00:00Z`).getTime()) /
            DAY_MS,
        ) + 1
      : 0;

  const gaps: DateSpan["gaps"] = [];
  let silentDaysAreWeekends = true;
  if (firstDay && lastDay) {
    let runStart: string | undefined;
    let runLen = 0;
    for (let i = 0; i < spanDays; i++) {
      const d = addDays(firstDay, i);
      if (activeDays.has(d)) {
        if (runStart && runLen >= GAP_DAYS) {
          gaps.push({ from: runStart, to: addDays(runStart, runLen - 1), days: runLen });
        }
        runStart = undefined;
        runLen = 0;
        continue;
      }
      if (!isWeekend(d)) silentDaysAreWeekends = false;
      if (!runStart) runStart = d;
      runLen += 1;
    }
    if (runStart && runLen >= GAP_DAYS) {
      gaps.push({ from: runStart, to: addDays(runStart, runLen - 1), days: runLen });
    }
  }

  const span: DateSpan = {
    first,
    last,
    days: spanDays,
    daysWithArtifacts: activeDays.size,
    contiguous: gaps.length === 0,
    gaps,
    silentDaysAreWeekends: activeDays.size < spanDays ? silentDaysAreWeekends : true,
  };

  const slackChannels = new Set(
    artifacts.filter((a) => a.kind === "slack" && a.channel).map((a) => a.channel as string),
  ).size;

  const sharesMeaningful = total >= SHARE_FLOOR;
  const absent = absencesFor(artifacts, byKind, channels, span, rosterBlock);
  const qualifiers = qualifiersFor({
    total,
    people,
    channels,
    span,
    roster: rosterBlock,
    sharesMeaningful,
  });
  const standing = standingFor(total, people, span, qualifiers);

  return {
    companyName: source.name,
    artifacts: total,
    byKind,
    channels,
    slackChannels,
    authors: people.length,
    people,
    roster: rosterBlock,
    span,
    absent,
    qualifiers,
    standing,
    headline: headlineFor(total, people.length, channels.length, slackChannels, span),
    standingLine: standingLineFor(standing, qualifiers),
    sharesMeaningful,
    denominatorNote:
      "Shares here are shares of this corpus. What fraction of anyone's actual " +
      "communication it represents is not computable from inside it, so it is not stated.",
  };
}

/* ── the sentences ─────────────────────────────────────────────────────── */

function headlineFor(
  total: number,
  authors: number,
  locations: number,
  slackChannels: number,
  span: DateSpan,
): string {
  if (total === 0) return "No corpus. Nothing has been ingested for this company.";

  const window =
    span.days <= 1
      ? `all on ${coverageDate(span.first)}`
      : `${coverageDate(span.first)} to ${coverageDate(span.last)}, ${plural(span.days, "day")}`;

  // A Notion page and a Jira board are locations, not channels. Saying
  // "22 channels" would read as more Slack than we hold.
  const where =
    locations === slackChannels
      ? plural(locations, "channel")
      : `${plural(locations, "location")} (${plural(slackChannels, "Slack channel")})`;

  return `${plural(total, "artifact")} from ${plural(
    authors,
    "person",
    "people",
  )} across ${where}, ${window}.`;
}

function standingLineFor(
  standing: CoverageStanding,
  qualifiers: CoverageQualifier[],
): string {
  const named = qualifiers.map((q) => q.id);
  if (standing === "thin") {
    return (
      "This is a thin corpus. The derivation below is a reading of a handful of " +
      "messages, and it will be a different reading once there is more."
    );
  }
  if (standing === "partial") {
    return named.length === 1
      ? "Enough to derive from, with one limit worth naming before you read it."
      : `Enough to derive from, with ${plural(named.length, "limit")} worth naming before you read it.`;
  }
  return (
    "Many voices over a real stretch of time. It is still one Slack export, and " +
    "what is listed as absent is absent."
  );
}

/* ── what is structurally absent ───────────────────────────────────────── */

function absencesFor(
  artifacts: Artifact[],
  byKind: KindCount[],
  channels: ChannelCount[],
  span: DateSpan,
  roster?: CoverageReport["roster"],
): Absence[] {
  const count = (k: Artifact["kind"]) => byKind.find((b) => b.kind === k)?.artifacts ?? 0;
  const meetings = count("meeting");
  const tickets = count("ticket");
  const docs = count("doc");

  const out: Absence[] = [
    {
      what: "Direct messages",
      detail:
        "None. An export of channels contains no DMs, and a large share of coordination " +
        "at any company happens there. Nothing in the corpus indicates how much.",
    },
    {
      what: "Channels that were not exported",
      detail: `${plural(channels.length, "location")} ${
        channels.length === 1 ? "is" : "are"
      } present. A private or unexported channel leaves no trace here — including no trace of its own absence.`,
    },
    {
      what: "Calls, huddles and hallway conversation",
      detail:
        "Nothing spoken is in this corpus. Video calls, Slack huddles, a decision made " +
        "walking back from lunch: no record, no citation, no way to weigh what was said.",
    },
    {
      what: "Meetings",
      detail:
        meetings > 0
          ? `Present as ${plural(meetings, "written minute")} — one person's summary of a room. ` +
            "A meeting nobody wrote up is not here at all."
          : "No minutes were ingested, so no meeting is represented in any form.",
    },
    {
      what: "Email",
      detail: "Not ingested. Customer threads and anything external live there.",
    },
    {
      what: "Code, tickets and documents outside this export",
      detail:
        tickets + docs > 0
          ? `${plural(tickets, "ticket")} and ${plural(docs, "doc")} were ingested. The repositories, ` +
            "issue trackers, wikis and drives they point at were not read — only these copies."
          : "No repository, issue tracker, wiki or drive was read. Only the messages in this export.",
    },
    {
      what: "People who do not write things down",
      detail:
        roster && roster.silent.length > 0
          ? `The corpus can only hold people who typed. ${plural(
              roster.silent.length,
              "roster name",
            )} never appear${roster.silent.length === 1 ? "s" : ""} as an author: ${roster.silent.join(
              ", ",
            )}.`
          : "The corpus can only hold people who typed. Someone who does this work over a " +
            "desk or a call is invisible in it, and their absence looks the same as not existing.",
    },
    {
      what: "Anything outside the window",
      detail:
        span.first && span.last
          ? `The record starts ${coverageDate(span.first)} and stops ${coverageDate(
              span.last,
            )}. How the team worked before that, and everything since, is out of frame.`
          : "The corpus carries no usable timestamps, so it cannot say what period it covers.",
    },
  ];

  if (artifacts.length === 0) {
    return [
      {
        what: "Everything",
        detail: "No artifacts have been ingested for this company. There is nothing to derive from.",
      },
    ];
  }

  return out;
}

/* ── the qualifiers ────────────────────────────────────────────────────── */

function qualifiersFor(input: {
  total: number;
  people: PersonCoverage[];
  channels: ChannelCount[];
  span: DateSpan;
  roster?: CoverageReport["roster"];
  sharesMeaningful: boolean;
}): CoverageQualifier[] {
  const { total, people, channels, span, roster, sharesMeaningful } = input;
  const out: CoverageQualifier[] = [];
  if (total === 0) return out;

  if (total < THIN_CORPUS) {
    out.push({
      id: "thin-corpus",
      headline: `${plural(total, "artifact")} in total.`,
      detail:
        "A person could read the entire corpus in a minute. Anything derived from it is " +
        "an inference from a handful of messages, and one more message could change it.",
    });
  }

  if (people.length < FEW_AUTHORS) {
    out.push({
      id: "few-authors",
      headline: `${plural(people.length, "person", "people")} wrote everything in it.`,
      detail:
        "The corpus reflects how these people describe the work in public. It contains no " +
        "second account of it to check against.",
    });
  }

  if (span.days <= 1) {
    out.push({
      id: "single-day",
      headline: `Every artifact falls on ${coverageDate(span.first)}.`,
      detail:
        "One day of a company's life. Whatever happened to be live that day is the whole " +
        "of what this corpus knows about.",
    });
  } else if (span.days < NARROW_WINDOW_DAYS) {
    out.push({
      id: "narrow-window",
      headline: `The window is ${plural(span.days, "day")} wide.`,
      detail:
        "Under a month. A quarterly cycle, a seasonal push, or work that simply was not " +
        "live that month leaves no trace in it.",
    });
  }

  if (channels.length === 1) {
    out.push({
      id: "single-channel",
      headline: `One location: ${channels[0].channel}.`,
      detail:
        "Everything comes from a single place. What the team discusses elsewhere is not " +
        "represented, and the corpus cannot indicate how much that is.",
    });
  }

  const top = people[0];
  if (top && total > 0 && top.share >= CONCENTRATED && people.length > 1) {
    out.push({
      id: "concentrated",
      // A percentage of four artifacts is a decimal point pretending to be
      // precision, so below the floor this is stated as the count it is.
      headline: sharesMeaningful
        ? `${Math.round(top.share * 100)}% of the corpus was written by one person (${top.name}).`
        : `${top.artifacts} of the ${total} artifacts were written by one person (${top.name}).`,
      detail:
        "One voice dominates the sample, so it dominates anything read out of it. This is a " +
        "property of the export, not of anyone's contribution.",
    });
  }

  if (span.gaps.length > 0) {
    const g = span.gaps[0];
    out.push({
      id: "gapped-window",
      headline:
        span.gaps.length === 1
          ? `A ${plural(g.days, "day")} silence inside the window (${coverageDate(
              `${g.from}T00:00:00Z`,
            )} to ${coverageDate(`${g.to}T00:00:00Z`)}).`
          : `${plural(span.gaps.length, "silent stretch", "silent stretches")} of a week or more inside the window.`,
      detail:
        "The export is not continuous. Work continued through those days; the record of it " +
        "is not in this corpus.",
    });
  }

  if (roster && roster.silent.length + roster.barelyPresent.length > 0) {
    const quiet = roster.silent.length + roster.barelyPresent.length;
    out.push({
      id: "roster-silence",
      headline: `${quiet} of ${roster.size} people on the roster appear ${plural(
        THIN_SLICE,
        "time",
      )} or fewer.`,
      detail:
        "The corpus says nearly nothing about how they work. Someone appearing twice is not " +
        "someone we know anything about, and the derivation should not lean on them.",
    });
  }

  return out;
}

function standingFor(
  total: number,
  people: PersonCoverage[],
  span: DateSpan,
  qualifiers: CoverageQualifier[],
): CoverageStanding {
  if (total === 0) return "thin";
  if (total < THIN_CORPUS || people.length < FEW_AUTHORS || span.days <= 1) return "thin";
  return qualifiers.length > 0 ? "partial" : "broad";
}

/* ── a flat rendering, for anywhere without a DOM ──────────────────────── */

/**
 * The same facts as plain lines — for a Slack message, a log, or a prompt.
 * Deliberately the same sentences as the panel: two renderings of one report,
 * never two accounts of the corpus.
 */
export function coverageLines(report: CoverageReport): string[] {
  const lines = [report.headline, report.standingLine];

  if (report.roster) {
    lines.push(
      `Roster: ${report.roster.appearing} of ${report.roster.size} named people appear in it as authors.`,
    );
  }
  if (report.span.days > 1) {
    const silent = report.span.days - report.span.daysWithArtifacts;
    lines.push(
      `${report.span.daysWithArtifacts} of the ${report.span.days} days in the window carry at least one artifact` +
        (silent > 0 && report.span.silentDaysAreWeekends
          ? `; the ${silent} that do not are all weekends.`
          : "."),
    );
  }
  for (const q of report.qualifiers) lines.push(q.headline);
  lines.push(`Not in the corpus: ${report.absent.map((a) => a.what.toLowerCase()).join("; ")}.`);
  lines.push(report.denominatorNote);
  return lines;
}
