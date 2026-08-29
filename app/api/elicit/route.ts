/**
 * The elicitation loop.
 *
 *   POST /api/elicit  { action: "create",  … }  → pick an expert, write the ask
 *   POST /api/elicit  { action: "answer",  … }  → capture text, draft a teachback
 *   POST /api/elicit  multipart(audio)          → capture speech, same thing
 *   POST /api/elicit  { action: "confirm", … }  → correct one line → corpus
 *   POST /api/elicit  { action: "decline", … }  → an honest dead end
 *   GET  /api/elicit?id=…                        → one request (+ citation proof)
 *   GET  /api/elicit?id=…&speak=1&of=request     → the ask, spoken
 *   GET  /api/elicit?hireId=… | ?companySlug=…   → the queue
 *
 * ── WHAT THIS ROUTE IS ACTUALLY FOR ──────────────────────────────────────────
 *
 * `/api/chat` escalates when the corpus is silent. That is honest and it is
 * inert — the answer is still not written down, and the next hire hits the same
 * wall. This route is the other half: it goes and gets the answer, checks it
 * back with the person who gave it, and appends it to the corpus so the *next*
 * question of that shape is answered from the corpus like any other.
 *
 * ── THE TWO INVARIANTS ───────────────────────────────────────────────────────
 *
 * 1. Nothing unconfirmed becomes corpus. `knowledge.toArtifact` throws on an
 *    unconfirmed record and `confirm` is the only action that can set that
 *    status. An expert's raw answer never gets written down.
 *
 * 2. The waiting hire is never told an answer exists before it does. `create`
 *    writes one message into their chat saying the question is out with a named
 *    person and that nothing is written down yet; `confirm` writes the second.
 *    There is no state in between where the UI can imply otherwise.
 *
 * ── ON COST ──────────────────────────────────────────────────────────────────
 *
 * Only `answer` calls the model, once, on a few hundred tokens — the answer, not
 * the corpus. Request construction is entirely deterministic (see `elicit.ts`),
 * which is why the text that goes to a real colleague cannot be hallucinated.
 */

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import {
  applyCorrection,
  buildRequest,
  draftTeachback,
  nextFollowUp,
  pickExpert,
  renderTeachback,
  topicFrom,
  type ExpertPick,
} from "@/lib/agent/elicit";
import { getHire, updateHire } from "@/lib/agent/hires";
import {
  alreadyAsked,
  artifactIdFor,
  citationProof,
  getElicitation,
  listElicitations,
  loadCompany,
  overloadedPeople,
  putElicitation,
  toArtifact,
  updateElicitation,
  type ElicitationRecord,
} from "@/lib/agent/knowledge";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isVoiceConfigured, textToSpeech, VoiceError } from "@/lib/voice/elevenlabs";
import { MAX_AUDIO_BYTES, SttError, isSttConfigured, transcribe } from "@/lib/voice/stt";
import type { Blocker, ChatMessage, Company, Person } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The teachback draft is one small model call; the rest is local. */
export const maxDuration = 60;

const NO_STORE = { "cache-control": "no-store, max-age=0" } as const;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

function fail(status: number, error: string, reason?: string, extra: Record<string, string> = {}) {
  return json(reason ? { error, reason } : { error }, status, extra);
}

/* ═════════════════════════════════════════════════════════════════════ GET ══ */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const hireId = url.searchParams.get("hireId");
  const companySlug = url.searchParams.get("companySlug");
  const speak = url.searchParams.get("speak");

  if (id) {
    const record = await getElicitation(id);
    if (!record) return fail(404, "No elicitation with that id.");

    if (speak) return speakIt(record, url.searchParams.get("of") ?? "request");

    // The proof is only meaningful once it is corpus, and it re-runs the real
    // grounding check rather than trusting the stored id.
    const proof = record.status === "confirmed" ? await citationProof(record) : null;
    return json({ elicitation: record, proof });
  }

  const elicitations = await listElicitations({
    hireId: hireId ?? undefined,
    companySlug: companySlug ?? undefined,
    open: url.searchParams.get("open") === "1" ? true : undefined,
  });

  return json({
    elicitations,
    /** How much this corpus has learned that it did not start with. */
    captured: elicitations.filter((e) => e.status === "confirmed").length,
    voice: { stt: isSttConfigured(), tts: isVoiceConfigured() },
  });
}

/** The ask, or the teachback, as audio. Reuses the briefing's TTS client as-is. */
async function speakIt(record: ElicitationRecord, of: string) {
  const text =
    of === "teachback" && record.teachback
      ? record.teachback.shown
      : record.requestText;

  if (!isVoiceConfigured()) {
    return fail(503, "Voice isn't configured on this deployment. The text is on screen.", "missing_key");
  }

  try {
    const spoken = await textToSpeech(text);
    return new Response(new Uint8Array(spoken.audio), {
      status: 200,
      headers: {
        "content-type": spoken.contentType,
        "content-length": String(spoken.bytes),
        ...NO_STORE,
      },
    });
  } catch (err) {
    const failure =
      err instanceof VoiceError
        ? err
        : new VoiceError("upstream_error", "Speech generation failed.", { status: 502 });
    console.warn(`[elicit] tts ${failure.code}: ${failure.message}`);
    return fail(failure.status, failure.message, failure.code);
  }
}

/* ════════════════════════════════════════════════════════════════════ POST ══ */

const CreateBody = z.object({
  action: z.literal("create"),
  hireId: z.string().min(1).optional(),
  companySlug: z.string().min(1).optional(),
  blockerId: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  /** Optional when a blockerId is given — the blocker's summary is the question. */
  question: z.string().min(6).max(600).optional(),
  topic: z.string().min(2).max(200).optional(),
  /** People already asked, so a re-ask routes to somebody else. */
  exclude: z.array(z.string()).max(20).optional(),
});

const AnswerBody = z.object({
  action: z.literal("answer"),
  id: z.string().min(1),
  // The cap carries its own sentence. An expert who has just typed or spoken a
  // long answer and gets back "Invalid request." has lost the one contribution
  // we asked them for, and has no idea why.
  text: z
    .string()
    .min(1)
    .max(
      8000,
      "That answer is longer than 8,000 characters. Send the part that answers the question, the rest can follow in Slack.",
    ),
});

const ConfirmBody = z.object({
  action: z.literal("confirm"),
  id: z.string().min(1),
  /** Absent means "confirmed unchanged", which is still a review. */
  correction: z.string().max(2000).optional(),
  /** 1-based, as shown to the expert. */
  line: z.number().int().min(1).max(10).optional(),
});

const DeclineBody = z.object({
  action: z.literal("decline"),
  id: z.string().min(1),
  reason: z.string().max(600).optional(),
});

/** Nobody replied. Same machinery as a decline: close this one, ask the next. */
const RerouteBody = z.object({
  action: z.literal("reroute"),
  id: z.string().min(1),
  reason: z.string().max(600).optional(),
});

const Body = z.discriminatedUnion("action", [
  CreateBody,
  AnswerBody,
  ConfirmBody,
  DeclineBody,
  RerouteBody,
]);

export async function POST(request: Request) {
  const limited = rateLimit(`elicit:${clientIp(request)}`, { limit: 30, windowMs: 60_000 });
  if (!limited.ok) {
    return fail(429, "That's a lot of requests. Give it a minute.", "rate_limited", {
      "retry-after": String(limited.retryAfter),
    });
  }

  const contentType = request.headers.get("content-type") ?? "";

  // A spoken answer arrives as multipart. Handled before the JSON parse rather
  // than inside it, because `request.json()` on a multipart body throws and the
  // resulting 400 says nothing useful.
  if (contentType.includes("multipart/form-data")) {
    return handleAudioAnswer(request);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "Body must be JSON, or multipart/form-data for a spoken answer.");
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    // First issue's message, same as /api/jd: the schemas above carry sentences
    // written for the person on the other end, and the panel renders `error`.
    return json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request.", issues: parsed.error.issues },
      400,
    );
  }

  try {
    switch (parsed.data.action) {
      case "create":
        return await handleCreate(parsed.data);
      case "answer":
        return await handleAnswer(parsed.data.id, {
          text: parsed.data.text,
          via: "text",
          at: new Date().toISOString(),
        });
      case "confirm":
        return await handleConfirm(parsed.data);
      case "decline":
        return await handleDecline(parsed.data, "declined");
      case "reroute":
        return await handleDecline(parsed.data, "quiet");
    }
  } catch (err) {
    console.error("[elicit]", err);
    return fail(500, err instanceof Error ? err.message : "Something went wrong.");
  }
}

/* ───────────────────────────────────────────────────────────────── create ── */

async function handleCreate(input: z.infer<typeof CreateBody>) {
  const hire = input.hireId ? await getHire(input.hireId) : undefined;
  if (input.hireId && !hire) return fail(404, "Unknown hire.");

  const companySlug = hire?.companySlug ?? input.companySlug;
  if (!companySlug) return fail(400, "Give a hireId or a companySlug.");

  const company = await loadCompany(companySlug);
  if (!company) {
    return fail(404, `No corpus for "${companySlug}", it is neither seeded nor ingested.`);
  }

  const blocker = hire?.blockers?.find((b) => b.id === input.blockerId);
  const question = (input.question ?? blocker?.summary ?? "").trim();
  if (question.length < 6) {
    return fail(400, "Say what the hire is stuck on, a blockerId or a question.");
  }

  const outcome = await raise({
    company,
    question,
    topic: input.topic,
    hire,
    blocker,
    taskId: input.taskId,
    exclude: input.exclude ?? [],
  });

  if (!outcome.record) {
    // 200, not an error: "we could not work out who to ask" is a real answer and
    // the UI has to be able to show it without treating it as a failure.
    return json({ elicitation: null, expert: null, reason: outcome.reason }, 200);
  }

  return json({ elicitation: outcome.record, expert: outcome.pick, reason: outcome.reason }, 201);
}

type RaiseInput = {
  company: Company;
  question: string;
  topic?: string;
  hire?: { id: string; name: string; roleTitle: string; blockers?: Blocker[] };
  blocker?: Blocker;
  taskId?: string;
  /** Names not to route to. The caller's list; caps and prior asks are added here. */
  exclude: string[];
};

/**
 * Raise one request, to one person, honestly.
 *
 * Shared by `create` and by the onward routing that happens when somebody passes
 * — which is the whole reason it is a function rather than inline. A refusal has
 * to *move the question along*, not end it: an expert who declines and watches
 * the request die learns that declining is the same as ignoring, and after that
 * they ignore.
 *
 * Three exclusion sources are merged before anything is picked:
 *   • the caller's own list (a re-ask),
 *   • everyone already asked this same question (never ask twice),
 *   • everyone at their weekly cap (see ASKS_PER_PERSON_PER_WEEK).
 */
async function raise(input: RaiseInput): Promise<{
  record: ElicitationRecord | null;
  pick: ExpertPick | null;
  reason: string;
}> {
  const { company, question, hire, blocker } = input;
  const topic = (input.topic ?? topicFrom(question)).trim();

  const [asked, overloaded] = await Promise.all([
    alreadyAsked(company.slug, question),
    overloadedPeople(company.slug),
  ]);

  const exclude = [...new Set([...input.exclude, ...asked, ...overloaded])];
  const choice = pickExpert(company, topic, { exclude });

  // The reason there is no "best guess" branch here: naming the wrong colleague
  // with confidence is instantly checkable, wrong, and it costs us every true
  // thing on the page. If a blocker already carries a suggestion we will use
  // *that*, because a human put it there — but we will not manufacture one.
  let pick: ExpertPick | null = choice.pick;
  let reason = choice.reason;

  if (!pick && blocker?.suggestedPerson && !exclude.includes(blocker.suggestedPerson)) {
    const named = findPerson(company, blocker.suggestedPerson);
    if (named) {
      pick = {
        person: named,
        why: "named on the blocker as the person who can unblock this.",
        evidence: [],
        routing: "roster",
        tier: "expert",
      };
      reason =
        `Nothing in the corpus shows who has worked on this. Using the name already on the blocker ` +
        `(${named.name}) rather than picking one, a human's suggestion, not an observed match.`;
    }
  }

  if (!pick) {
    return {
      record: null,
      pick: null,
      reason: overloaded.length
        ? `${reason} ${overloaded.join(" and ")} ${overloaded.length === 1 ? "has" : "have"} already been asked twice this week, so they are out of the pool.`
        : reason,
    };
  }

  const built = buildRequest({
    question,
    expert: pick,
    hireName: hire?.name,
    hireRole: hire?.roleTitle,
    companyName: company.name,
    topic,
  });

  const record: ElicitationRecord = {
    id: randomUUID(),
    companySlug: company.slug,
    hireId: hire?.id,
    hireName: hire?.name,
    hireRole: hire?.roleTitle,
    blockerId: blocker?.id,
    taskId: input.taskId ?? blocker?.taskId,
    question,
    topic,
    expert: {
      name: pick.person.name,
      role: pick.person.role,
      team: pick.person.team,
      slackHandle: pick.person.slackHandle,
    },
    expertWhy: pick.why,
    routing: pick.routing,
    tier: pick.tier,
    expertEvidence: pick.evidence,
    anchor: pick.anchor,
    probes: built.probes,
    requestText: built.text,
    followUps: [...built.followUps],
    estimatedSeconds: built.estimatedSeconds,
    createdAt: new Date().toISOString(),
    status: "requested",
    askedBefore: asked,
  };

  await putElicitation(record);

  // Honest state, in the place the hire is already reading.
  //
  // Note what it does NOT say: that an answer is coming, or when. Realistically
  // about a quarter of these get answered inside a day, so a message implying
  // one is on its way is a promise the system cannot keep — and a new hire who
  // waits on a promise like that loses half a day and some trust. It also names
  // a person, not a process: the thing that happened is that a colleague was
  // asked, and that is what it says.
  const firstName = pick.person.name.split(/\s+/)[0];
  await noteToHire(
    record,
    `This isn't written down anywhere in ${company.name}'s corpus, I read all of it, and I'm not going to guess.\n\n` +
      `So I've put the question to ${pick.person.name}, ${pick.person.role}. ` +
      (pick.routing === "ranked"
        ? pick.tier === "peer"
          ? `${firstName} has worked on this and isn't the person the team already routes everything to, which is deliberate, that person gets asked only if this comes back empty.`
          : `${firstName} ${pick.why}`
        : `Routing is weaker than usual here, nobody has worked on this anywhere in the corpus, so ${firstName} ${pick.why}`) +
      `\n\nThey may not reply, and that's a normal outcome rather than a failure, if it goes quiet you can push it to someone else. Nothing is written down until they've answered and checked it. Carry on with the rest; I'll put it here the moment it lands.`,
  );

  return { record, pick, reason };
}

function findPerson(company: Company, name: string): Person | undefined {
  const wanted = name.trim().toLowerCase();
  return (
    company.people.find((p) => p.name.trim().toLowerCase() === wanted) ??
    company.people.find((p) => p.name.trim().toLowerCase().startsWith(wanted.split(/\s+/)[0]))
  );
}

/* ───────────────────────────────────────────────────────────────── answer ── */

async function handleAudioAnswer(request: Request) {
  if (!isSttConfigured()) {
    return fail(503, "Voice isn't configured on this deployment. Type the answer instead.", "missing_key");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "That upload couldn't be read. Send the audio as multipart/form-data.");
  }

  const id = String(form.get("id") ?? "").trim();
  if (!id) return fail(400, "No elicitation id was attached to that recording.");

  let audio: Blob | null = null;
  for (const field of ["audio", "file", "clip", "recording"]) {
    const value = form.get(field);
    if (value instanceof Blob) {
      audio = value;
      break;
    }
  }
  if (!audio) return fail(400, "No audio was attached to that request.");
  if (audio.size > MAX_AUDIO_BYTES) {
    return fail(
      413,
      `That clip is ${(audio.size / 1_048_576).toFixed(1)} MB. Keep it under ${MAX_AUDIO_BYTES / 1_048_576} MB.`,
      "too_large",
    );
  }

  try {
    // The verified STT client, unchanged. Not reimplemented here.
    const result = await transcribe(audio);
    return await handleAnswer(id, {
      text: result.text,
      via: "voice",
      at: new Date().toISOString(),
      durationMs: result.durationMs,
      transcriptModel: result.modelId,
    });
  } catch (err) {
    const failure =
      err instanceof SttError
        ? err
        : new SttError("upstream_error", "Transcription failed.", { status: 502 });
    // No transcript in the log: it is a colleague talking about their own work.
    console.warn(`[elicit] stt ${failure.code}: ${failure.message}`);
    return fail(failure.status, failure.message, failure.code);
  }
}

async function handleAnswer(
  id: string,
  answer: { text: string; via: "voice" | "text"; at: string; durationMs?: number; transcriptModel?: string },
) {
  const record = await getElicitation(id);
  if (!record) return fail(404, "No elicitation with that id.");
  if (record.status === "confirmed") {
    return fail(409, "That one is already in the corpus. Nothing more to do.");
  }
  if (record.status === "declined") {
    return fail(409, "That request was declined.");
  }

  const text = answer.text.trim();
  if (!text) return fail(400, "That answer was empty.");

  // The ordered chain. Offered, never forced — the whole thing has to stay
  // inside a minute of the expert's time, so a follow-up is a suggestion the
  // panel can show and they can skip.
  const follow = nextFollowUp(text);

  const draft = await draftTeachback({
    question: record.question,
    answer: text,
    expertName: record.expert.name,
    expertRole: record.expert.role,
    via: answer.via,
  });

  const shown = renderTeachback(draft, record.expert.name);

  const updated = await updateElicitation(id, (r) => ({
    ...r,
    status: "answered",
    answer: { ...answer, text },
    followUpSent: follow?.text,
    teachback: { draft, shown, finalLines: draft.lines },
  }));

  return json({
    elicitation: updated,
    teachback: shown,
    followUp: follow,
    /** Said plainly, because it is the point: this is not corpus yet. */
    stored: false,
  });
}

/* ──────────────────────────────────────────────────────────────── confirm ── */

async function handleConfirm(input: z.infer<typeof ConfirmBody>) {
  const record = await getElicitation(input.id);
  if (!record) return fail(404, "No elicitation with that id.");
  if (!record.teachback || !record.answer) {
    return fail(409, "There is no answer to confirm yet.");
  }
  if (record.status === "confirmed") {
    const proof = await citationProof(record);
    return json({ elicitation: record, artifact: proof.artifact, proof, alreadyStored: true });
  }

  const correction = input.correction?.trim();
  const finalLines = correction
    ? applyCorrection(record.teachback.draft, { line: input.line, text: correction })
    : [...record.teachback.draft.lines];

  const confirmedAt = new Date().toISOString();

  const updated = await updateElicitation(input.id, (r) => ({
    ...r,
    status: "confirmed",
    teachback: {
      ...r.teachback!,
      correction: correction ? { line: input.line, text: correction } : undefined,
      finalLines,
      confirmedAt,
      outcome: correction ? ("corrected" as const) : ("unchanged" as const),
    },
    artifactId: artifactIdFor(r),
  }));

  if (!updated) return fail(404, "No elicitation with that id.");

  // This is the moment it becomes corpus. `toArtifact` refuses anything that is
  // not a confirmed teachback, so this call is also the assertion.
  const artifact = toArtifact(updated);
  // Re-runs the real grounding check against the augmented corpus — the same
  // function that polices every model citation. If this is false, the loop did
  // not close and we say so rather than claiming it did.
  const proof = await citationProof(updated);

  // The answer is attributed to the person and the date, first — not to the
  // system that carried it. What a new hire should take away is that a named
  // colleague told them this on a specific day, because that is what happened
  // and because it is what makes them willing to ask the next question.
  await noteToHire(
    updated,
    `${updated.expert.name} (${updated.expert.role}) answered, on ${new Date(
      updated.teachback?.confirmedAt ?? Date.now(),
    ).toUTCString().slice(5, 16)}:\n\n` +
      finalLines.map((l) => `, ${l}`).join("\n") +
      `\n\nThey read that back and ${
        updated.teachback?.outcome === "corrected" ? "corrected a line" : "confirmed it"
      } before it was written down, so it is their words rather than my summary of them. It's in the corpus now as ${artifact.id}, quotable, dated, with their name on it, and there for whoever starts next.`,
    { resolveBlocker: true },
  );

  return json({
    elicitation: updated,
    artifact,
    proof,
    stored: proof.grounded,
  });
}

/* ──────────────────────────────────────────────────────────────── decline ── */

/**
 * Somebody passed, or it went quiet. Either way the question moves on.
 *
 * `decline` is the colleague saying "not me"; `reroute` is the hire (or the
 * agent) saying "no reply, try someone else". They do the same thing on purpose:
 * mark this one closed and immediately raise the next, excluding everybody
 * already asked. A refusal that dead-ends teaches people that refusing and
 * ignoring are the same move, and after that nobody refuses — they just stop
 * reading.
 */
async function handleDecline(
  input: z.infer<typeof DeclineBody> | z.infer<typeof RerouteBody>,
  mode: "declined" | "quiet",
) {
  const record = await getElicitation(input.id);
  if (!record) return fail(404, "No elicitation with that id.");
  if (record.status === "confirmed") {
    return fail(409, "That one is already in the corpus.");
  }

  const reason =
    input.reason?.trim() || (mode === "quiet" ? "No reply, pushed on to someone else." : undefined);

  const updated = await updateElicitation(input.id, (r) => ({
    ...r,
    status: "declined",
    declinedReason: reason,
  }));

  const company = await loadCompany(record.companySlug);
  const hire = record.hireId ? await getHire(record.hireId) : undefined;

  const next = company
    ? await raise({
        company,
        question: record.question,
        topic: record.topic,
        hire,
        blocker: hire?.blockers?.find((b) => b.id === record.blockerId),
        taskId: record.taskId,
        exclude: [record.expert.name],
      })
    : { record: null, pick: null, reason: "The corpus for that company is no longer available." };

  // `raise` writes its own "asked X" note when it lands somewhere, so this only
  // has to cover the dead end.
  if (!next.record) {
    await noteToHire(
      record,
      mode === "declined"
        ? `${record.expert.name} passed on that one${reason ? `, “${reason}”` : ""}, and there's nobody else in the corpus who has worked on it.\n\n` +
            `So it is still not written down, and I'm not going to fill the gap with something that sounds right. This one needs a human to say who else to ask.`
        : `Still nothing back from ${record.expert.name}, and there's nobody else the corpus points to.\n\n` +
            `It remains unwritten. Worth asking in the open in a channel rather than routing it to one more person.`,
    );
  }

  return json({
    elicitation: updated,
    rerouted: next.record,
    reason: next.reason,
  });
}

/* ─────────────────────────────────────────────────────────── hire-facing ── */

/**
 * One message into the waiting hire's chat.
 *
 * Every state change the hire could possibly care about writes exactly one of
 * these, and the wording is deliberately load-bearing: a request that is out
 * says nothing is written down, and only the confirm message contains an answer.
 * A version of this that said "getting that for you now" would be implying an
 * answer exists, which is the thing requirement four forbids.
 */
async function noteToHire(
  record: ElicitationRecord,
  text: string,
  opts: { resolveBlocker?: boolean } = {},
): Promise<void> {
  if (!record.hireId) return;

  const message: ChatMessage = {
    id: randomUUID(),
    role: "agent",
    text,
    at: new Date().toISOString(),
    taskId: record.taskId,
  };

  await updateHire(record.hireId, (h) => ({
    ...h,
    messages: [...h.messages, message],
    blockers:
      opts.resolveBlocker && record.blockerId
        ? h.blockers.map((b) => (b.id === record.blockerId ? { ...b, resolved: true } : b))
        : h.blockers,
  }));
}
