/**
 * ElevenLabs text-to-speech, called directly over REST.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * The manager we are selling to does not have a spare four minutes to read a
 * dashboard; they have a commute. `lib/voice/brief.ts` writes the briefing —
 * this file is the two hundred lines that turn it into something audible in a
 * car. That is the whole integration surface, and it is deliberately small:
 * one endpoint, one content type, no SDK.
 *
 * ── WHY NO SDK ───────────────────────────────────────────────────────────────
 *
 * The ElevenLabs REST surface we need is a single POST that returns MP3 bytes.
 * A dependency for that buys us nothing and costs us a lockfile change, a
 * bundle, and a supply-chain surface on a product that is otherwise four
 * dependencies deep. `fetch` is already global on the Node runtime.
 *
 * ── WHY THE ERRORS ARE THIS DETAILED ─────────────────────────────────────────
 *
 * Everything that can go wrong here goes wrong on demo day specifically:
 * hackathon keys run out of credits, get rate limited by a neighbouring team
 * on the same account, or were never copied into the deployment at all. A
 * generic 500 tells the route nothing, so the route cannot degrade gracefully,
 * so the manager screen shows an error where the product was meant to be. Each
 * failure below is therefore distinguishable by `code`, and the caller decides
 * what the human sees.
 *
 * ── ON THE KEY ───────────────────────────────────────────────────────────────
 *
 * The API key is never logged, never returned, never put in a message, and
 * never echoed back to the client. Upstream error text is passed through
 * `redact()` before it goes anywhere, because an API that helpfully quotes your
 * bad credential back at you is a real thing that happens, and the response
 * body from this module ends up on a screen in front of a room.
 */

const API_BASE = "https://api.elevenlabs.io/v1";

/**
 * Rachel. A calm, unhurried newsreader voice — which is the register a briefing
 * about other people's blockers has to be in. Anything brighter would sound
 * like marketing, and the content is "two of your reports are stuck".
 * Overridable with ELEVENLABS_VOICE_ID once the product picks its own voice.
 */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

/**
 * Turbo v2.5: roughly half the credit cost of the multilingual model at a
 * quality difference nobody notices on a ninety-second spoken memo. On a
 * hackathon quota the binding constraint is credits, not fidelity. Override
 * with ELEVENLABS_MODEL_ID (eleven_multilingual_v2 for the richer read).
 */
const DEFAULT_MODEL_ID = "eleven_turbo_v2_5";

/** 128 kbps MP3: browser-native in a plain <audio> element, no transcoding. */
const OUTPUT_FORMAT = "mp3_44100_128";

/**
 * The briefing is capped at ~230 words upstream, so this is only ever hit by a
 * bug. We truncate rather than throw: on demo day, most of a briefing is worth
 * more than a stack trace.
 */
const MAX_CHARS = 5000;

/** TTS for two hundred words takes a few seconds. Twenty is generous; hanging is not an option. */
const TIMEOUT_MS = 20_000;

export type VoiceFailureCode =
  | "missing_key"
  | "unauthorized"
  | "quota_exhausted"
  | "rate_limited"
  | "bad_request"
  | "upstream_error"
  | "network_error"
  | "timeout";

/**
 * A failure the caller can actually branch on. `status` is the HTTP status the
 * caller *would* use if it chose to fail — the brief route mostly chooses not
 * to, and returns the script instead.
 */
export class VoiceError extends Error {
  readonly code: VoiceFailureCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: VoiceFailureCode,
    message: string,
    { status = 502, retryAfterSeconds }: { status?: number; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "VoiceError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type SpokenAudio = {
  /**
   * Explicitly backed by an ArrayBuffer (not the wider ArrayBufferLike, which
   * includes SharedArrayBuffer) so the bytes can be handed straight to a
   * Response or a Blob without a cast.
   */
  audio: Uint8Array<ArrayBuffer>;
  contentType: string;
  voiceId: string;
  modelId: string;
  bytes: number;
};

export function voiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
}

export function modelId(): string {
  return process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID;
}

/** Whether a call is even worth attempting. Lets the UI stay honest without burning a request. */
export function isVoiceConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export function voiceStatus(): {
  configured: boolean;
  voiceId: string;
  modelId: string;
  provider: "elevenlabs";
} {
  return {
    configured: isVoiceConfigured(),
    voiceId: voiceId(),
    modelId: modelId(),
    provider: "elevenlabs",
  };
}

/**
 * Scrub anything key-shaped out of text that is on its way to a log or a
 * browser. Belt and braces: we never put the key in a message ourselves, but
 * upstream bodies are not ours to trust.
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

type ErrorBody = { detail?: { status?: string; message?: string } | string; message?: string };

function detailOf(body: unknown): { status: string; message: string } {
  if (typeof body !== "object" || body === null) return { status: "", message: "" };
  const b = body as ErrorBody;
  if (typeof b.detail === "string") return { status: "", message: b.detail };
  return {
    status: b.detail?.status ?? "",
    message: b.detail?.message ?? b.message ?? "",
  };
}

/**
 * Map an ElevenLabs failure onto something the caller can reason about.
 *
 * The `detail.status` string is checked BEFORE the HTTP status on purpose:
 * ElevenLabs has returned quota exhaustion as a 401 in some versions and a 422
 * in others, and "your credits ran out" needs to read differently to "your key
 * is wrong" no matter which envelope it arrives in. Getting that wrong on demo
 * day means twenty minutes spent rotating a key that was never the problem.
 */
function classify(status: number, body: unknown, rawText: string, retryAfter: string | null): VoiceError {
  const { status: detailStatus, message } = detailOf(body);
  const upstream = tidy(message || rawText || `HTTP ${status}`);
  const marker = detailStatus.toLowerCase();
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) || undefined : undefined;

  if (marker.includes("quota") || /quota|credits? (?:remaining|exceeded)/i.test(upstream)) {
    return new VoiceError(
      "quota_exhausted",
      `ElevenLabs credits are exhausted. ${upstream}`,
      { status: 402 },
    );
  }

  if (marker.includes("invalid_api_key") || marker.includes("missing_permissions") || status === 401 || status === 403) {
    return new VoiceError(
      "unauthorized",
      `ElevenLabs rejected the API key. ${upstream}`,
      { status: 401 },
    );
  }

  if (status === 429) {
    return new VoiceError(
      "rate_limited",
      `ElevenLabs is rate limiting this key. ${upstream}`,
      { status: 429, retryAfterSeconds },
    );
  }

  if (status === 400 || status === 422) {
    return new VoiceError("bad_request", `ElevenLabs rejected the request. ${upstream}`, {
      status: 502,
    });
  }

  return new VoiceError("upstream_error", `ElevenLabs returned ${status}. ${upstream}`, {
    status: 502,
  });
}

/**
 * Speak the given text. Returns complete MP3 bytes rather than a stream: the
 * briefing is ninety seconds long, the caller wants to cache it and hand the
 * browser a seekable file, and a stream that dies halfway through is a worse
 * demo than one that takes three seconds to start.
 */
export async function textToSpeech(
  text: string,
  options: { voiceId?: string; modelId?: string; signal?: AbortSignal } = {},
): Promise<SpokenAudio> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    throw new VoiceError(
      "missing_key",
      "ELEVENLABS_API_KEY is not set, so no audio can be generated.",
      { status: 503 },
    );
  }

  const spoken = text.trim();
  if (!spoken) {
    throw new VoiceError("bad_request", "There is nothing to say.", { status: 400 });
  }

  const voice = options.voiceId?.trim() || voiceId();
  const model = options.modelId?.trim() || modelId();
  const body = spoken.length > MAX_CHARS ? spoken.slice(0, MAX_CHARS) : spoken;

  const url = `${API_BASE}/text-to-speech/${encodeURIComponent(voice)}?output_format=${OUTPUT_FORMAT}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: body,
        model_id: model,
        // A briefing, not a performance. High stability and no style
        // exaggeration keep the read even, which is what you want when the
        // content is "two of your reports are stuck" and the listener is
        // driving.
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
      signal: options.signal ?? AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new VoiceError("timeout", "ElevenLabs did not respond in time.", { status: 504 });
    }
    // The message is ours, not the network stack's — a DNS error string can
    // contain the request URL, and the URL contains nothing secret today but
    // may not stay that way.
    throw new VoiceError("network_error", "Could not reach ElevenLabs.", { status: 502 });
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

  const audio = new Uint8Array(await res.arrayBuffer());

  // A 200 with an empty or absurdly small body is not audio. Better to fail
  // here, where the caller can fall back to the written briefing, than to hand
  // the browser a zero-byte MP3 and watch the play button do nothing on stage.
  if (audio.byteLength < 512) {
    throw new VoiceError("upstream_error", "ElevenLabs returned an empty audio body.", {
      status: 502,
    });
  }

  return {
    audio,
    contentType: res.headers.get("content-type") ?? "audio/mpeg",
    voiceId: voice,
    modelId: model,
    bytes: audio.byteLength,
  };
}
