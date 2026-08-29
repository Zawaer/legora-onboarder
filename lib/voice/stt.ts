/**
 * ElevenLabs speech-to-text (Scribe), called directly over REST.
 *
 * ── WHY VOICE INPUT EXISTS, WHICH IS NOT "BECAUSE VOICE IS COOL" ─────────────
 *
 * A new hire's most valuable questions do not happen at a keyboard. They happen
 * walking back from a meeting where three acronyms went past them, or on the
 * commute home when the day finally has room to be thought about. By the time
 * that person is sitting at a desk with a text box in front of them, the
 * question has either evaporated or hardened into "I'll work it out myself" —
 * which is precisely how somebody spends two weeks doing the wrong thing
 * confidently, and how a manager finds out about it in week three.
 *
 * The whole product is a bet that the gap between "I don't understand this" and
 * "I asked" is where onboarding is actually lost. Typing is a tax on crossing
 * that gap. Speaking is not. Capturing the question at the moment it forms is
 * the entire point of this file; everything below is plumbing in service of it.
 *
 * ── WHY THE TRANSCRIPT IS NOT AUTO-SENT ──────────────────────────────────────
 *
 * See `components/voice-input.tsx`. Short version, and it is not hypothetical:
 * the first live call made against this endpoint transcribed "Legora" as
 * "Ligora". A tool whose job is to teach somebody the vocabulary of a company
 * they just joined cannot silently mangle that company's own name into the
 * question it then answers. The transcript lands in the composer, editable.
 *
 * ── WHY NO SDK ───────────────────────────────────────────────────────────────
 *
 * Same reasoning as lib/voice/elevenlabs.ts, which this file deliberately
 * mirrors: one endpoint, one multipart POST, `fetch` is already global on the
 * Node runtime. A dependency here buys a lockfile change and a supply-chain
 * surface and nothing else.
 *
 * ── ON THE KEY ───────────────────────────────────────────────────────────────
 *
 * Never logged, never returned, never put in a message. Upstream error text
 * goes through `redact()` before it can reach a screen, because ElevenLabs
 * quotes your credential's *length* back at you on a bad key (verified) and a
 * chattier future version may quote more than that.
 */

import type { VoiceFailureCode } from "./elevenlabs";

const API_BASE = "https://api.elevenlabs.io/v1";

/**
 * Verified live against the API on this key: the only accepted model ids are
 * `scribe_v1`, `scribe_v1_experimental` and `scribe_v2` — the server helpfully
 * enumerates them in its 400 when you send a wrong one. v2 is the current
 * model and the one that got "Legora" right on the second pass, so it is the
 * default. Override with ELEVENLABS_STT_MODEL_ID.
 */
const DEFAULT_STT_MODEL_ID = "scribe_v2";

/**
 * 10 MB. At Opus voice bitrates that is something like two hours of speech —
 * far past any question a human asks a colleague in a corridor. The cap is not
 * really about our costs; it is so a mis-set `<input type="file">` pointed at a
 * podcast cannot buffer a phone's worth of audio into a serverless function.
 * The route enforces the same number as a 413 before it ever gets here.
 */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * Below this it is not audio, it is a container header. A hire who taps the mic
 * and stops instantly should be told "that recording was empty" locally, in
 * milliseconds, rather than waiting on a round trip to be told the same thing
 * in ElevenLabs' words.
 */
const MIN_AUDIO_BYTES = 256;

/**
 * Generous relative to TTS's 20s because this timeout covers an upload as well
 * as the transcription — a hire on hotel wifi pushing a two-minute clip is the
 * slow case, and it is a case we would rather serve than abandon.
 */
const TIMEOUT_MS = 30_000;

/**
 * A question, not a lecture. Recording is capped in the UI; this is the
 * server-side twin of that cap, and it exists so a stuck MediaRecorder cannot
 * turn into a large bill.
 */
export const MAX_RECORDING_MS = 120_000;

/**
 * The same failure vocabulary as the TTS client, plus the one code that only a
 * file upload can produce. Reusing the type rather than restating it means a
 * new failure mode added to `VoiceFailureCode` shows up here as a compile
 * error in the switch statements downstream, which is the point of a union.
 */
export type SttFailureCode = VoiceFailureCode | "too_large";

/**
 * Structurally identical to `VoiceError` — same `code`/`status`/`retryAfter`
 * contract — so a caller can handle both with one branch. It is a separate
 * class only because `too_large` is not in the TTS union and elevenlabs.ts is
 * not this module's file to edit.
 */
export class SttError extends Error {
  readonly code: SttFailureCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: SttFailureCode,
    message: string,
    { status = 502, retryAfterSeconds }: { status?: number; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "SttError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type Transcript = {
  /** What the hire said, trimmed. The only field the composer actually needs. */
  text: string;
  /** From `audio_duration_secs`. Used for the "heard 6s" line, not for logic. */
  durationMs?: number;
  /** ISO-639-3 as ElevenLabs returns it ("eng"), passed through untouched. */
  languageCode?: string;
  /** 0–1. Low confidence is a hint to the hire to read before sending. */
  languageProbability?: number;
  modelId: string;
  bytes: number;
};

export function sttModelId(): string {
  return process.env.ELEVENLABS_STT_MODEL_ID?.trim() || DEFAULT_STT_MODEL_ID;
}

/**
 * Whether a call is even worth attempting. Same key as TTS — one ElevenLabs
 * credential covers the briefing and the mic — so the mic button can decide
 * whether to render at all without burning a request to find out.
 */
export function isSttConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export function sttStatus(): {
  configured: boolean;
  modelId: string;
  maxBytes: number;
  provider: "elevenlabs";
} {
  return {
    configured: isSttConfigured(),
    modelId: sttModelId(),
    maxBytes: MAX_AUDIO_BYTES,
    provider: "elevenlabs",
  };
}

/**
 * Scrub anything key-shaped out of text on its way to a log or a browser.
 * Duplicated from lib/voice/elevenlabs.ts rather than imported because it is
 * module-private there and that file belongs to the briefing. Twenty lines of
 * duplication is the right trade against widening another module's exports.
 */
function redact(text: string): string {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  let out = text;
  if (key && key.length >= 8) out = out.split(key).join("[redacted]");
  return out.replace(/\b(?:sk_|xi_|xi-)[A-Za-z0-9_\-]{8,}\b/g, "[redacted]");
}

/** Keep upstream prose short enough to sit in a JSON field on a screen. */
function tidy(text: string): string {
  const clean = redact(text).replace(/\s+/g, " ").trim();
  return clean.length > 200 ? `${clean.slice(0, 197)}...` : clean;
}

type ErrorBody = {
  detail?: { status?: string; message?: string; type?: string } | string;
  message?: string;
};

function detailOf(body: unknown): { status: string; message: string; type: string } {
  if (typeof body !== "object" || body === null) return { status: "", message: "", type: "" };
  const b = body as ErrorBody;
  if (typeof b.detail === "string") return { status: "", message: b.detail, type: "" };
  return {
    status: b.detail?.status ?? "",
    message: b.detail?.message ?? b.message ?? "",
    type: b.detail?.type ?? "",
  };
}

/**
 * Map an ElevenLabs STT failure onto something the caller can reason about.
 *
 * ── THE THING THAT WILL BITE YOU HERE ────────────────────────────────────────
 *
 * The speech-to-text endpoint returns **HTTP 400 for authentication failures**,
 * not 401. Verified live: a wrong-but-well-formed key comes back as
 * `400 {"detail":{"type":"authentication_error","status":"invalid_api_key"}}`,
 * and a malformed one as `400 … "invalid_api_key_length"`. So the envelope is
 * read before the HTTP status, exactly as the TTS client does — a status-first
 * classifier would report "ElevenLabs rejected the request" for a bad key and
 * send somebody hunting through their audio encoding for twenty minutes on
 * demo day while the actual fix was a paste error.
 */
function classify(status: number, body: unknown, rawText: string, retryAfter: string | null): SttError {
  const { status: detailStatus, message, type } = detailOf(body);
  const upstream = tidy(message || rawText || `HTTP ${status}`);
  const marker = detailStatus.toLowerCase();
  const kind = type.toLowerCase();
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) || undefined : undefined;

  if (marker.includes("quota") || /quota|credits? (?:remaining|exceeded)/i.test(upstream)) {
    return new SttError("quota_exhausted", `ElevenLabs credits are exhausted. ${upstream}`, {
      status: 402,
    });
  }

  if (
    kind === "authentication_error" ||
    marker.includes("invalid_api_key") ||
    marker.includes("missing_permissions") ||
    status === 401 ||
    status === 403
  ) {
    return new SttError("unauthorized", `ElevenLabs rejected the API key. ${upstream}`, {
      status: 401,
    });
  }

  if (status === 429) {
    return new SttError("rate_limited", `ElevenLabs is rate limiting this key. ${upstream}`, {
      status: 429,
      retryAfterSeconds,
    });
  }

  // 413 from upstream means our own cap let something through that ElevenLabs
  // would not take. Surfaced as `too_large` so the UI says "that clip is too
  // long" instead of the generic "something went wrong".
  if (status === 413) {
    return new SttError("too_large", `That recording is too large to transcribe. ${upstream}`, {
      status: 413,
    });
  }

  // `invalid_content` is the corrupted/unplayable-audio case, which for us
  // means a browser produced a container ElevenLabs would not open. That is a
  // user-visible situation with a real remedy ("try the file upload"), so it
  // keeps a 400 rather than being flattened into a 502.
  if (marker.includes("invalid_content") || marker.includes("invalid_audio")) {
    return new SttError("bad_request", `That audio could not be read. ${upstream}`, {
      status: 400,
    });
  }

  if (status === 400 || status === 422) {
    return new SttError("bad_request", `ElevenLabs rejected the request. ${upstream}`, {
      status: 502,
    });
  }

  return new SttError("upstream_error", `ElevenLabs returned ${status}. ${upstream}`, {
    status: 502,
  });
}

/**
 * ElevenLabs sniffs the container, but a filename with the right extension
 * removes all doubt, and doubt here presents as "File is corrupted" — the least
 * actionable error in the set. Mapped from the MediaRecorder mime types a
 * browser will actually hand us.
 */
function filenameFor(contentType: string): string {
  const t = contentType.toLowerCase();
  if (t.includes("webm")) return "speech.webm";
  if (t.includes("ogg") || t.includes("opus")) return "speech.ogg";
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "speech.m4a";
  if (t.includes("mpeg") || t.includes("mp3")) return "speech.mp3";
  if (t.includes("wav") || t.includes("x-wav")) return "speech.wav";
  if (t.includes("flac")) return "speech.flac";
  return "speech.audio";
}

function durationMsFrom(body: Record<string, unknown>): number | undefined {
  const secs = body.audio_duration_secs;
  if (typeof secs === "number" && Number.isFinite(secs) && secs >= 0) {
    return Math.round(secs * 1000);
  }
  return undefined;
}

/**
 * Transcribe a clip.
 *
 * Takes a Blob because that is what both callers already hold: the route pulls
 * one straight off `FormData`, and the browser's MediaRecorder produces one.
 * No copy, no base64 detour, no intermediate buffer the size of the upload.
 */
export async function transcribe(
  audio: Blob,
  options: { modelId?: string; languageCode?: string; signal?: AbortSignal } = {},
): Promise<Transcript> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    throw new SttError(
      "missing_key",
      "ELEVENLABS_API_KEY is not set, so speech cannot be transcribed. Type the question instead.",
      { status: 503 },
    );
  }

  const bytes = audio.size;
  if (bytes > MAX_AUDIO_BYTES) {
    throw new SttError(
      "too_large",
      `That clip is ${(bytes / 1_048_576).toFixed(1)} MB; the limit is ${MAX_AUDIO_BYTES / 1_048_576} MB.`,
      { status: 413 },
    );
  }
  if (bytes < MIN_AUDIO_BYTES) {
    throw new SttError("bad_request", "That recording was empty — nothing was captured.", {
      status: 400,
    });
  }

  const model = options.modelId?.trim() || sttModelId();
  const contentType = audio.type || "audio/webm";

  const form = new FormData();
  form.append("file", audio, filenameFor(contentType));
  form.append("model_id", model);
  // Scribe otherwise writes "(laughter)" and "(clears throat)" into the text.
  // Charming in a transcript, noise in a question the agent has to answer.
  form.append("tag_audio_events", "false");
  // We want a sentence, not a word-level timing table. Dropping the timestamps
  // keeps the upstream response small; `audio_duration_secs` survives it
  // (verified), which is the only timing number the UI shows.
  form.append("timestamps_granularity", "none");
  form.append("diarize", "false");
  // Left auto by default. Scribe's language detection is good and a new hire on
  // an international team may well ask in their first language; forcing `eng`
  // would quietly mistranscribe them.
  if (options.languageCode?.trim()) form.append("language_code", options.languageCode.trim());

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/speech-to-text`, {
      method: "POST",
      // No content-type header on purpose: fetch must set the multipart
      // boundary itself, and setting it by hand is the classic way to get an
      // unparseable body and a baffling 400.
      headers: { "xi-api-key": key, accept: "application/json" },
      body: form,
      signal: options.signal ?? AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new SttError("timeout", "ElevenLabs did not transcribe that in time.", { status: 504 });
    }
    // Our message, not the network stack's — a DNS or TLS error string can
    // carry the request URL, and this one ends up on a screen.
    throw new SttError("network_error", "Could not reach ElevenLabs.", { status: 502 });
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    throw classify(res.status, parsed, raw, res.headers.get("retry-after"));
  }

  let body: Record<string, unknown>;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new SttError("upstream_error", "ElevenLabs returned a response we could not read.", {
      status: 502,
    });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";

  // A 200 with empty text is the "you recorded silence" case, and it is common:
  // the hire hits the mic, the OS grabs the wrong input device, six seconds of
  // nothing goes up. Saying so plainly beats dropping an empty string into the
  // composer and letting them wonder whether the button is broken.
  if (!text) {
    throw new SttError(
      "bad_request",
      "No speech was found in that recording. Check the microphone and try again.",
      { status: 400 },
    );
  }

  return {
    text,
    durationMs: durationMsFrom(body),
    languageCode: typeof body.language_code === "string" ? body.language_code : undefined,
    languageProbability:
      typeof body.language_probability === "number" ? body.language_probability : undefined,
    modelId: model,
    bytes,
  };
}
