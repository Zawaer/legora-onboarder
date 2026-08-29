/**
 * GET|POST /api/brief          → audio/mpeg, the briefing spoken by ElevenLabs
 * GET|POST /api/brief?text=1   → JSON, the script only (free, no credits spent)
 *
 * ── THE ONE RULE THIS ROUTE OBEYS ────────────────────────────────────────────
 *
 * It never dies. If the ElevenLabs key is missing, rejected, rate limited, or
 * out of credits, this route returns 200 with the written briefing and a
 * machine-readable reason. That is not laziness about error handling — the
 * opposite: every failure is classified in lib/voice/elevenlabs.ts precisely so
 * that this layer can keep serving the product instead of a stack trace. On
 * demo day a dry quota must degrade to "here is the briefing, in text" and must
 * not take out the manager screen it is mounted on.
 *
 * ── WHY BOTH MODES ───────────────────────────────────────────────────────────
 *
 * `?text=1` exists so the feature is demonstrable and debuggable with curl when
 * there is no key at all, and so the UI can render the script on load without
 * spending a credit per page view. Audio is only ever generated when a human
 * presses play. The same script also rides along on the audio response in the
 * `X-Brief-Script` header (base64, because HTTP headers are Latin-1 and the
 * briefing contains real punctuation), so a single request gets you both.
 */

import { NextResponse } from "next/server";
import { listHires } from "@/lib/agent/hires";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { composeBrief, type Brief } from "@/lib/voice/brief";
import {
  VoiceError,
  textToSpeech,
  voiceStatus,
  type SpokenAudio,
} from "@/lib/voice/elevenlabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Text is free, so it can be polled. Audio costs credits, so it cannot. */
const TEXT_LIMIT = 60;
const AUDIO_LIMIT = 8;

const NO_STORE = { "cache-control": "no-store, max-age=0" } as const;

/**
 * One-entry memo of the last thing we synthesised.
 *
 * The briefing only changes when the blockers change, but a manager on a demo
 * screen will press play repeatedly, and every press is real credits against a
 * hackathon quota. Keyed on the exact script plus voice and model, so a changed
 * blocker correctly misses. Per-instance and deliberately tiny — this is a
 * credit guard, not a cache layer.
 */
let lastSpoken: { key: string; audio: SpokenAudio } | null = null;

function cacheKey(script: string, voice: string, model: string): string {
  return `${voice}|${model}|${script}`;
}

function payload(brief: Brief) {
  return {
    script: brief.script,
    wordCount: brief.wordCount,
    estimatedSeconds: brief.estimatedSeconds,
    needsHuman: brief.needsHuman,
    handled: brief.handled,
    minutes: brief.minutes,
    hires: brief.hires,
  };
}

function scriptHeader(script: string): string {
  return Buffer.from(script, "utf8").toString("base64");
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const raw = (url.searchParams.get("text") ?? "").toLowerCase();
  const textOnly = raw === "1" || raw === "true" || raw === "yes";

  const limited = rateLimit(`brief:${textOnly ? "text" : "audio"}:${clientIp(request)}`, {
    limit: textOnly ? TEXT_LIMIT : AUDIO_LIMIT,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many briefings. Give it a minute." },
      {
        status: 429,
        headers: { ...NO_STORE, "retry-after": String(limited.retryAfter) },
      },
    );
  }

  // Composing the script cannot fail on a network or a quota: it is a pure
  // function of hire state (lib/voice/brief.ts). Everything below is allowed to
  // go wrong; this is not.
  let brief: Brief;
  try {
    brief = composeBrief(await listHires());
  } catch (err) {
    console.error("[brief] could not compose the script:", (err as Error).message);
    return NextResponse.json({ error: "Could not read hire state." }, { status: 500 });
  }

  const status = voiceStatus();

  if (textOnly) {
    return NextResponse.json(
      { ...payload(brief), voice: { ...status, ok: status.configured } },
      { status: 200, headers: NO_STORE },
    );
  }

  try {
    const key = cacheKey(brief.script, status.voiceId, status.modelId);
    const spoken =
      lastSpoken?.key === key
        ? lastSpoken.audio
        : await textToSpeech(brief.script, {
            voiceId: status.voiceId,
            modelId: status.modelId,
          });
    lastSpoken = { key, audio: spoken };

    return new NextResponse(new Blob([spoken.audio], { type: spoken.contentType }), {
      status: 200,
      headers: {
        ...NO_STORE,
        "content-type": spoken.contentType,
        "content-length": String(spoken.bytes),
        // Everything the UI needs to render the transcript and the duration
        // without a second round trip.
        "x-brief-script": scriptHeader(brief.script),
        "x-brief-script-encoding": "base64",
        "x-brief-words": String(brief.wordCount),
        "x-brief-seconds": String(brief.estimatedSeconds),
        "x-brief-needs-human": String(brief.needsHuman),
        "x-brief-handled": String(brief.handled),
        "x-brief-voice-id": spoken.voiceId,
        "x-brief-model-id": spoken.modelId,
      },
    });
  } catch (err) {
    const failure =
      err instanceof VoiceError
        ? err
        : new VoiceError("upstream_error", "Speech generation failed.", { status: 502 });

    // Logged without the key and without the upstream body's headers. The one
    // line a judge or an on-call human needs: which failure, on which route.
    console.warn(`[brief] voice unavailable (${failure.code}): ${failure.message}`);

    // 200, on purpose. The client asked for the briefing; it is getting the
    // briefing, just not out loud. `voice.ok: false` and `voice.reason` carry
    // the truth, and the UI says so plainly rather than showing an error state
    // over a screen that is otherwise working.
    return NextResponse.json(
      {
        ...payload(brief),
        voice: {
          ...status,
          ok: false,
          reason: failure.code,
          message: failure.message,
          retryAfterSeconds: failure.retryAfterSeconds,
        },
      },
      {
        status: 200,
        headers: {
          ...NO_STORE,
          "x-brief-voice": "unavailable",
          "x-brief-voice-reason": failure.code,
        },
      },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

/** POST is an alias. Some clients will not let you fetch audio with a GET. */
export async function POST(request: Request) {
  return handle(request);
}
