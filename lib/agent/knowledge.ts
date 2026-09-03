/**
 * Captured knowledge, persisted as ordinary corpus.
 *
 * ── THE ONE DESIGN DECISION IN THIS FILE ─────────────────────────────────────
 *
 * A confirmed answer from an expert becomes an `Artifact` and is appended to the
 * company's corpus. Not a special "captured knowledge" table with its own reader,
 * not a side-channel the agent consults after retrieval fails, not a second
 * grounding path with looser rules. An `Artifact`, in `company.artifacts`,
 * indistinguishable at the type level from a Slack message written in August.
 *
 * That is the whole point, and it is worth being explicit about why, because the
 * tempting alternative — a separate `capturedAnswers` store with a bespoke
 * lookup — is easier and is wrong:
 *
 *   • `ground.ts` verifies every quote against `company.artifacts`. If captured
 *     knowledge lives anywhere else, the agent can never *cite* it, so it can
 *     never assert it, so the capture bought nothing. Citability is not a nice
 *     property of this feature; it is the feature.
 *
 *   • `derive.ts` renders the whole corpus into the cached prompt prefix. An
 *     artifact appended here is read by the next derivation for free, with no
 *     code change anywhere. The next new hire's role is derived from a corpus
 *     that contains the answer the last one had to go and get.
 *
 *   • The same holds for `supervise.ts`, `drift.ts`, and the expert ranking:
 *     none of them need to know this feature exists. Adding a second class of
 *     knowledge would mean teaching all of them about it, and the one that got
 *     missed would be the one that quietly stopped working.
 *
 * So: one corpus. The provenance lives in the artifact's own fields — real
 * author, real role, real timestamp — plus an attribution line in the text, so a
 * reader always knows this was elicited rather than found. What it does *not*
 * get is a privileged path through the verification.
 *
 * ── WHY NOTHING UNCONFIRMED IS EVER STORED ───────────────────────────────────
 *
 * `toArtifact` takes a *confirmed* record and throws on anything else. An
 * expert's raw answer — spoken, elliptical, possibly mistranscribed — reads as
 * authoritative once it is sitting in the corpus next to a real doc, and a new
 * hire has no way to tell the difference. The teachback is the gate, and this is
 * where the gate is enforced rather than in the route, because routes get
 * copied.
 *
 * Server-only: touches the filesystem. Never import into a client component.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { getIngestedCompany } from "@/lib/ingest/store";
import { getCompany } from "@/lib/seed";
import type { Artifact, Company, Evidence } from "@/lib/types";
import { groundEvidence } from "@/lib/agent/ground";
import { CAPTURED_CHANNEL } from "@/lib/agent/elicit";
import type { Anchor, ExpertPick, Probe, TeachbackDraft } from "@/lib/agent/elicit";
import { isKvConfigured, kvGet, kvSet } from "@/lib/kv";

/**
 * A file of its own, alongside `hires.json` and `companies.json` rather than
 * inside either. Hires are user state you must not lose; ingested corpora are
 * somebody else's data we want to be able to delete in one move; this is neither
 * — it is knowledge the company now owns, and it should outlive both the hire
 * who triggered it and the derivation cache.
 */
const FILE = process.env.KNOWLEDGE_PATH ?? path.join(process.cwd(), "data", "knowledge.json");
/** Durable store key — see the note on KV_KEY in lib/agent/hires.ts. */
const KV_KEY = "store:knowledge";

/* ═════════════════════════════════════════════════════════════════ types ══ */

export type ElicitationStatus =
  /** Sent. Nothing is written down. The hire is told exactly this. */
  | "requested"
  /** The expert answered; a teachback is drafted and waiting on them. */
  | "answered"
  /** Reviewed and corrected. This is the only status that produces an artifact. */
  | "confirmed"
  /** The expert said they can't answer. Honest dead end, not a silent drop. */
  | "declined";

export type CapturedAnswer = {
  text: string;
  via: "voice" | "text";
  at: string;
  /** Present for voice. Used for the "42s of speech" line, never for logic. */
  durationMs?: number;
  transcriptModel?: string;
};

export type TeachbackState = {
  draft: TeachbackDraft;
  /** Rendered exactly as the expert saw it. Kept for the audit trail. */
  shown: string;
  /** What they changed, verbatim. Absent when they confirmed it unchanged. */
  correction?: { line?: number; text: string };
  /** The lines after the correction was applied. This is what gets stored. */
  finalLines: string[];
  confirmedAt?: string;
  outcome?: "corrected" | "unchanged";
};

export type ElicitationRecord = {
  id: string;
  companySlug: string;
  /** Who is waiting. Optional: a request can be raised without a hire attached. */
  hireId?: string;
  hireName?: string;
  hireRole?: string;
  blockerId?: string;
  taskId?: string;
  /** What the hire is stuck on, in one sentence. */
  question: string;
  topic: string;
  expert: {
    name: string;
    role: string;
    team: string;
    slackHandle: string;
  };
  /** Why this person, in a line a human can read. Never a bare score. */
  expertWhy: string;
  routing: "ranked" | "roster";
  /** Peers are asked before the person everyone already routes to. */
  tier?: "peer" | "expert";
  /** Anyone already asked this same question, so a re-route never loops back. */
  askedBefore?: string[];
  /** The citations behind the routing. Empty only for a roster match. */
  expertEvidence: ExpertPick["evidence"];
  anchor?: Anchor;
  probes: Probe[];
  /** The message the expert actually received, verbatim. */
  requestText: string;
  /** Held in reserve, in order. */
  followUps: string[];
  estimatedSeconds: number;
  createdAt: string;
  status: ElicitationStatus;
  answer?: CapturedAnswer;
  teachback?: TeachbackState;
  /** The follow-up the answer triggered, if any. Optional for the expert. */
  followUpSent?: string;
  declinedReason?: string;
  /** Set on confirm. The corpus id this became. */
  artifactId?: string;
};

/* ═════════════════════════════════════════════════════════════════ store ══ */

/**
 * Same shape as `lib/agent/hires.ts`: one serialised promise chain, and an
 * in-memory fallback when the disk is read-only. On a serverless deploy that
 * means captured knowledge survives for the life of the instance rather than
 * forever — which is the same honest limitation every other store here has, and
 * is fixed by a real database rather than by a cleverer file write.
 */
const memory = new Map<string, ElicitationRecord>();
let diskWritable = true;

let queue: Promise<unknown> = Promise.resolve();

function serialise<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function readAll(): Promise<Map<string, ElicitationRecord>> {
  if (isKvConfigured()) {
    const rows = (await kvGet<ElicitationRecord[]>(KV_KEY)) ?? [];
    const map = new Map(
      rows.filter((r) => r && typeof r.id === "string").map((r) => [r.id, r] as const),
    );
    for (const [id, row] of memory) if (!map.has(id)) map.set(id, row);
    if (map.size) return map;
  }
  if (!diskWritable) return memory;
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as ElicitationRecord[];
    const rows = Array.isArray(parsed) ? parsed : [];
    const map = new Map(
      rows.filter((r) => r && typeof r.id === "string").map((r) => [r.id, r]),
    );
    for (const [id, row] of memory) if (!map.has(id)) map.set(id, row);
    return map;
  } catch {
    // Missing on first run, or half-written. An empty registry is the right
    // answer either way — a read must never take a page down.
    return memory;
  }
}

async function writeAll(map: Map<string, ElicitationRecord>): Promise<void> {
  for (const [id, row] of map) memory.set(id, row);
  if (isKvConfigured()) await kvSet(KV_KEY, [...map.values()]);
  if (!diskWritable) return;
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, `${JSON.stringify([...map.values()], null, 2)}\n`, "utf8");
  } catch (err) {
    diskWritable = false;
    console.warn(
      `[knowledge] filesystem is not writable (${(err as Error).message}); continuing in memory only.`,
    );
  }
}

export async function getElicitation(id: string): Promise<ElicitationRecord | undefined> {
  return (await readAll()).get(id);
}

/** Newest first. Filterable by company, by hire, and by open-vs-done. */
export async function listElicitations(
  filter: { companySlug?: string; hireId?: string; open?: boolean } = {},
): Promise<ElicitationRecord[]> {
  const rows = [...(await readAll()).values()];
  return rows
    .filter((r) => (filter.companySlug ? r.companySlug === filter.companySlug : true))
    .filter((r) => (filter.hireId ? r.hireId === filter.hireId : true))
    .filter((r) =>
      filter.open === undefined
        ? true
        : filter.open
          ? r.status === "requested" || r.status === "answered"
          : r.status === "confirmed" || r.status === "declined",
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function putElicitation(record: ElicitationRecord): Promise<ElicitationRecord> {
  return serialise(async () => {
    const map = await readAll();
    map.set(record.id, record);
    await writeAll(map);
    return record;
  });
}

/** Read-modify-write inside the lock. Every mutation goes through here. */
export async function updateElicitation(
  id: string,
  mutate: (record: ElicitationRecord) => ElicitationRecord,
): Promise<ElicitationRecord | undefined> {
  return serialise(async () => {
    const map = await readAll();
    const existing = map.get(id);
    if (!existing) return undefined;
    const next = mutate(existing);
    map.set(id, next);
    await writeAll(map);
    return next;
  });
}

/* ═══════════════════════════════════════════════════════════ the load cap ══ */

/**
 * How many asks one person is allowed to receive in a rolling week.
 *
 * ── WHY THERE IS A CAP AT ALL ────────────────────────────────────────────────
 *
 * Ackerman's Answer Garden experts were alarmed at *two questions a week*,
 * negotiated the right to refuse, and used it about half the time. Two is
 * therefore not a conservative guess; it is roughly the measured ceiling at
 * which a knowledgeable person stops being a willing participant and starts
 * being a support queue.
 *
 * The cost of getting this wrong is not a slow feature. It is that the experts
 * quietly stop replying, every request after that goes unanswered, and the new
 * hire is left waiting on something that will never come — which is worse than
 * never having asked, because at least an unanswered question is visibly
 * unanswered from the start.
 */
export const ASKS_PER_PERSON_PER_WEEK = 2;

const WEEK_MS = 7 * 86_400_000;

/** Names at or over the cap, ready to hand to `pickExpert` as `exclude`. */
export async function overloadedPeople(
  companySlug: string,
  opts: { now?: Date; cap?: number } = {},
): Promise<string[]> {
  const now = (opts.now ?? new Date()).getTime();
  const cap = opts.cap ?? ASKS_PER_PERSON_PER_WEEK;
  const rows = await listElicitations({ companySlug });

  const counts = new Map<string, number>();
  for (const row of rows) {
    const at = Date.parse(row.createdAt);
    if (Number.isNaN(at) || now - at > WEEK_MS) continue;
    const key = row.expert.name;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].filter(([, n]) => n >= cap).map(([name]) => name);
}

/**
 * Everyone already asked this exact question, so a re-route never lands back on
 * somebody who has already passed on it.
 */
export async function alreadyAsked(companySlug: string, question: string): Promise<string[]> {
  const key = question.replace(/\s+/g, " ").trim().toLowerCase();
  const rows = await listElicitations({ companySlug });
  return rows
    .filter((r) => r.question.replace(/\s+/g, " ").trim().toLowerCase() === key)
    .map((r) => r.expert.name);
}

/* ═══════════════════════════════════════════════════ becoming an artifact ══ */

/** "29 Aug 2026" — no locale, so server and client agree. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function longDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The artifact id. Prefixed so anybody reading a citation on screen can tell at
 * a glance that this passage was elicited rather than found — the provenance is
 * visible without being privileged.
 */
export function artifactIdFor(record: ElicitationRecord): string {
  return `elicited-${record.id.slice(0, 8)}`;
}

/**
 * Turn a confirmed record into corpus.
 *
 * Throws on anything unconfirmed. That is not defensive programming for its own
 * sake: the single worst outcome this feature has is an expert's raw, half-heard
 * answer sitting in the corpus with their name on it, being quoted at a new hire
 * as fact. The teachback is the gate and this is where it is enforced.
 */
export function toArtifact(record: ElicitationRecord): Artifact {
  if (record.status !== "confirmed" || !record.teachback?.confirmedAt) {
    throw new Error(
      `Elicitation ${record.id} is "${record.status}" — only a teachback the expert confirmed becomes corpus.`,
    );
  }
  if (!record.answer) {
    throw new Error(`Elicitation ${record.id} is confirmed but has no captured answer.`);
  }

  const t = record.teachback;
  const when = t.confirmedAt as string;
  const body = t.finalLines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);

  const corrected =
    t.outcome === "corrected"
      ? `${record.expert.name} corrected ${t.correction?.line ? `line ${t.correction.line} of ` : ""}this write-up before it was stored.`
      : `${record.expert.name} read this write-up back and confirmed it unchanged before it was stored.`;

  // Attribution leads with the human and the date, and the machinery is the
  // last clause of the last line. A reader should come away thinking "Marta said
  // this on 29 August", not "the system captured this" — the same reason the
  // request itself foregrounds the newcomer rather than the tool.
  const text = [
    `Question this answers: ${record.question}`,
    "",
    ...body,
    "",
    `— ${record.expert.name}, ${record.expert.role}, ${longDate(when)}. Said out loud when ${record.hireName ?? "someone who had just joined"} asked, because it was not written down anywhere. ${corrected}`,
  ].join("\n");

  return {
    id: artifactIdFor(record),
    // A spoken answer really is a short interview, and a typed one really is a
    // note. Nothing downstream branches on this — it is here so the corpus does
    // not quietly lie about how the knowledge arrived.
    kind: record.answer.via === "voice" ? "meeting" : "doc",
    channel: CAPTURED_CHANNEL,
    author: record.expert.name,
    authorRole: record.expert.role,
    timestamp: when,
    title: `${record.question.replace(/\s+/g, " ").trim()} — answered by ${record.expert.name}`,
    text,
  };
}

/* ══════════════════════════════════════════════ the augmented company ═════ */

/** Every confirmed answer for a company, as corpus. */
export async function knowledgeArtifacts(companySlug: string): Promise<Artifact[]> {
  const rows = await listElicitations({ companySlug });
  const out: Artifact[] = [];
  for (const row of rows) {
    if (row.status !== "confirmed") continue;
    try {
      out.push(toArtifact(row));
    } catch (err) {
      // A malformed row must not take the corpus down with it. Skip it loudly.
      console.warn(`[knowledge] skipping ${row.id}: ${(err as Error).message}`);
    }
  }
  return out;
}

/**
 * The company, plus everything it has since learned.
 *
 * Sorted by timestamp, and de-duplicated by id, because `renderCorpus` sorts and
 * caches on this exact string — an unstable order would silently destroy the
 * prompt cache on every call.
 */
export function withKnowledge(company: Company, learned: Artifact[]): Company {
  if (learned.length === 0) return company;
  const seen = new Set(company.artifacts.map((a) => a.id));
  const merged = [...company.artifacts, ...learned.filter((a) => !seen.has(a.id))];
  merged.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
  return { ...company, artifacts: merged };
}

/**
 * The one corpus loader.
 *
 * Seeded, then ingested, then everything elicited since. Every route that reads
 * a corpus should go through here — the moment one of them resolves the company
 * itself, captured knowledge stops existing on that path and the loop silently
 * stops compounding, which is a bug that looks exactly like "the agent didn't
 * mention it".
 */
export async function loadCompany(slug: string): Promise<Company | undefined> {
  const base = getCompany(slug) ?? (await getIngestedCompany(slug));
  if (!base) return undefined;
  return withKnowledge(base, await knowledgeArtifacts(slug));
}

/* ═════════════════════════════════════════════════════════════ the proof ══ */

/**
 * Can the agent actually cite this yet?
 *
 * Runs the *real* verification — `groundEvidence`, the same function and the
 * same rules that police every model-supplied citation — against the augmented
 * corpus. It exists so the loop can be demonstrated to close rather than
 * asserted to: a caller gets back a verified `Evidence` pointing at the new
 * artifact, or nothing.
 *
 * There is no relaxed mode here and there must never be one. If a captured
 * answer cannot pass the same check as a Slack message, it is not corpus.
 */
export async function citationProof(
  record: ElicitationRecord,
): Promise<{ grounded: boolean; evidence: Evidence | null; artifact: Artifact | null }> {
  if (record.status !== "confirmed") return { grounded: false, evidence: null, artifact: null };

  const company = await loadCompany(record.companySlug);
  if (!company) return { grounded: false, evidence: null, artifact: null };

  const artifact = toArtifact(record);
  // The first substantive line of the write-up, quoted verbatim — exactly what
  // the agent would cite when it answers the next person who asks this.
  const quote = record.teachback?.finalLines.find((l) => l.trim().length >= 24)?.trim();
  if (!quote) return { grounded: false, evidence: null, artifact };

  const candidate: Evidence = {
    artifactId: artifact.id,
    quote,
    why: `${record.expert.name} said this when asked; it is now the corpus's answer to "${record.question}".`,
  };

  const kept = groundEvidence([candidate], company);
  return { grounded: kept.length === 1, evidence: kept[0] ?? null, artifact };
}

/** Erasure (lib/erasure.ts). Same reasoning as purgeCompany in lib/agent/hires.ts. */
export async function purgeCompany(companySlug: string): Promise<number> {
  return serialise(async () => {
    const map = await readAll();
    let n = 0;
    for (const [id, r] of map) {
      if (r.companySlug === companySlug) {
        map.delete(id);
        memory.delete(id);
        n++;
      }
    }
    if (n) await writeAll(map);
    return n;
  });
}
