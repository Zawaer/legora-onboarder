/**
 * POST /api/transcribe   multipart/form-data → { text, durationMs? }
 * GET  /api/transcribe                       → { configured, modelId, maxBytes }
 *
 * ── WHAT THIS ROUTE IS FOR ───────────────────────────────────────────────────
 *
 * A new hire's best questions happen away from a keyboard — walking out of a
 * meeting where three acronyms went past unexplained, or on the way home. This
 * route is the thirty metres between that moment and the composer: audio in,
 * text out, and then the *normal* chat path takes over. It deliberately does
 * not talk to the agent. Transcription and answering are separate concerns and
 * separate failure domains, and keeping them apart means a bad transcription
 * costs a hire one edit rather than one wrong answer.
 *
 * ── WHY IT DOES NOT DEGRADE THE WAY /api/brief DOES ──────────────────────────
 *
 * The briefing route returns 200 with the written script when ElevenLabs is
 * unavailable, because it has something true to serve without them. This route
 * does not: there is no transcript without the transcriber. So instead of a
 * fake success it returns the *classified* status — 503 unconfigured, 401 bad
 * key, 402 dry credits, 413 too big, 429 backed off — each with a sentence a
 * human can act on. What it never does is 500. A 500 tells the mic button
 * nothing, so the mic button cannot say anything useful, so a hire is left
 * looking at "Something went wrong" with no idea whether to retry or type.
 *
 * Typing is unaffected by every branch below. That is the invariant: voice is
 * an accelerant on the primary path, never a dependency of it.
 */

import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  MAX_AUDIO_BYTES,
  SttError,
  sttStatus,
  transcribe,
} from "@/lib/voice/stt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every call spends ElevenLabs credits, so this is tighter than the chat route.
 * Twelve a minute is still far more than a person speaking questions out loud
 * can produce — a real hire manages maybe three — while capping what a stuck
 * client in a retry loop can burn through before anyone notices.
 */
const LIMIT = 12;

const NO_STORE = { "cache-control": "no-store, max-age=0" } as const;

/** The form fields a reasonable client might use. We accept all of them. */
const AUDIO_FIELDS = ["audio", "file", "clip", "recording"] as const;

function fail(
  status: number,
  error: string,
  reason: string,
  extra: Record<string, string> = {},
) {
  return NextResponse.json({ error, reason }, { status, headers: { ...NO_STORE, ...extra } });
}

/** Cheap enough to poll: lets the mic button hide itself when there is no key. */
export async function GET() {
  return NextResponse.json(sttStatus(), { status: 200, headers: NO_STORE });
}

export async function POST(request: Request) {
  const status = sttStatus();

  // Asked before anything is read off the wire. If there is no key, uploading
  // eight megabytes of audio first is pure waste on both ends.
  if (!status.configured) {
    return fail(
      503,
      "Voice input isn't configured on this deployment. Type your question instead.",
      "missing_key",
    );
  }

  const limited = rateLimit(`transcribe:${clientIp(request)}`, { limit: LIMIT, windowMs: 60_000 });
  if (!limited.ok) {
    return fail(429, "That's a lot of recordings. Give it a minute.", "rate_limited", {
      "retry-after": String(limited.retryAfter),
    });
  }

  // The declared length, checked before the body is buffered. It is a hint and
  // a liar can omit it, hence the authoritative check on the blob further down
  // — but when it is present and honest it saves us from reading a 40 MB
  // upload into memory purely to reject it.
  const declared = Number.parseInt(request.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES) {
    return fail(
      413,
      `That clip is too large. Keep it under ${MAX_AUDIO_BYTES / 1_048_576} MB.`,
      "too_large",
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    // A truncated upload, or a client that sent JSON to a multipart route.
    // Neither is a server fault and neither deserves a 500.
    return fail(
      400,
      "That upload couldn't be read. Send the audio as multipart/form-data.",
      "bad_request",
    );
  }

  let audio: Blob | null = null;
  for (const field of AUDIO_FIELDS) {
    const value = form.get(field);
    if (value instanceof Blob) {
      audio = value;
      break;
    }
  }

  if (!audio) {
    return fail(400, "No audio was attached to that request.", "bad_request");
  }

  // The authoritative size check. content-length above is advisory; this is the
  // number of bytes we actually hold.
  if (audio.size > MAX_AUDIO_BYTES) {
    return fail(
      413,
      `That clip is ${(audio.size / 1_048_576).toFixed(1)} MB. Keep it under ${
        MAX_AUDIO_BYTES / 1_048_576
      } MB.`,
      "too_large",
    );
  }

  const startedAt = Date.now();

  try {
    const result = await transcribe(audio);

    return NextResponse.json(
      {
        text: result.text,
        durationMs: result.durationMs,
        languageCode: result.languageCode,
        languageProbability: result.languageProbability,
        modelId: result.modelId,
        bytes: result.bytes,
        elapsedMs: Date.now() - startedAt,
      },
      { status: 200, headers: NO_STORE },
    );
  } catch (err) {
    const failure =
      err instanceof SttError
        ? err
        : new SttError("upstream_error", "Transcription failed.", { status: 502 });

    // One line, no key, no audio, no transcript. The transcript is the hire's
    // own words about something they do not yet understand at work — the last
    // thing that should end up in a log file a colleague can read.
    console.warn(`[transcribe] ${failure.code}: ${failure.message}`);

    return fail(
      failure.status,
      failure.message,
      failure.code,
      failure.retryAfterSeconds ? { "retry-after": String(failure.retryAfterSeconds) } : {},
    );
  }
}
