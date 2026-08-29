"use client";

/**
 * The mic in the chat composer.
 *
 * ── THE ARGUMENT FOR THIS BEING HERE AT ALL ──────────────────────────────────
 *
 * A new hire's most valuable questions do not happen at a keyboard. They happen
 * walking back from a meeting where three acronyms went past them, or on the
 * commute home when the day finally has room to be thought about. By the time
 * that person is at a desk with a text box in front of them, the question has
 * either evaporated or hardened into "I'll work it out myself" — which is how
 * somebody spends two weeks doing the wrong thing confidently, and how their
 * manager finds out in week three.
 *
 * The product is a bet that onboarding is lost in the gap between "I don't
 * understand this" and "I asked". Typing is a tax on crossing that gap;
 * speaking is not. This button exists to capture the question at the moment it
 * forms, which is the difference between a feature and a gimmick.
 *
 * ── WHY THE TRANSCRIPT IS NOT AUTO-SENT ──────────────────────────────────────
 *
 * Because it is wrong sometimes, and specifically wrong about the things this
 * product exists to explain. The very first live call against our endpoint
 * transcribed "Legora" as "Ligora". A tool whose job is to teach somebody a
 * company's vocabulary cannot silently mangle a company's own name and then
 * answer the mangled question — the hire watches the agent confidently discuss
 * something that does not exist and quietly concludes the agent is useless.
 *
 * So the transcript lands in the composer, editable, cursor waiting. It costs
 * one keystroke. Auto-sending a garbled transcript into a room of judges costs
 * considerably more, and unlike the extra click it cannot be taken back.
 *
 * ── WHY THERE IS A FILE UPLOAD NEXT TO THE MIC ───────────────────────────────
 *
 * Mic permission is the single most reliable thing to fail in a live demo:
 * a fresh browser profile, a screen-share window, an embedded webview, a
 * conference-room machine whose input device is a disconnected USB headset.
 * The file input is thirty seconds of code and it means the feature is still
 * demonstrable when the room's audio stack is against us. It is also the
 * honest path for anyone who cannot speak to a laptop at that moment.
 *
 * ── THE INVARIANT ────────────────────────────────────────────────────────────
 *
 * Nothing in this file can break typing. It owns its own error line, its own
 * state, and it renders nothing at all when the browser or the deployment
 * cannot support it. The composer around it does not know or care.
 */

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

/** Recording cap. The server has the same number; this is so it never gets there. */
const MAX_MS = 120_000;

/**
 * In preference order. Opus in WebM is what Chrome and Firefox give you and
 * what Scribe reads happily (verified live). Safari has historically only
 * produced MP4/AAC, and older Safari produces nothing at all — hence the
 * feature detection rather than a hardcoded string. The empty entry is the last
 * resort: hand MediaRecorder no mimeType and take whatever the browser's
 * default is, which is still better than refusing to record.
 */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/mpeg",
  "",
] as const;

type Phase = "idle" | "starting" | "recording" | "transcribing";

/** Why the mic is not available, when it is not. Null means it is. */
type Unavailable =
  | { kind: "unsupported"; message: string }
  | { kind: "denied"; message: string }
  | { kind: "no-device"; message: string }
  | null;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const candidate of MIME_CANDIDATES) {
    if (!candidate) return "";
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch {
      // Safari has thrown from isTypeSupported on some versions rather than
      // returning false. Treat a throw as "no" and keep walking the list.
    }
  }
  return "";
}

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function VoiceInput({
  onTranscript,
  disabled = false,
  className = "",
}: {
  /** Called with the transcript. The parent puts it in the composer — never sends it. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<Unavailable>(null);
  /**
   * Undecided until the effect below runs. Rendering the button on the server
   * and then removing it on the client is a hydration mismatch; rendering
   * nothing until we know is not.
   */
  const [ready, setReady] = useState(false);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const alive = useRef(true);
  /** Set when the human cancels, so the stop handler knows to bin the audio. */
  const cancelled = useRef(false);

  /* ── capability check ──────────────────────────────────────────────────────
     Runs once, on the client only. Three separate things have to be true and
     they fail independently: the API has to exist, MediaRecorder has to exist,
     and on an insecure origin getUserMedia is simply absent. Each gets its own
     sentence, because "voice unavailable" tells a developer nothing. */
  useEffect(() => {
    alive.current = true;

    const hasMediaDevices =
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function";
    const hasRecorder = typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";

    if (!hasMediaDevices || !hasRecorder) {
      setUnavailable({
        kind: "unsupported",
        message:
          typeof window !== "undefined" && !window.isSecureContext
            ? "Microphone capture needs a secure connection (https or localhost). You can still upload a recording."
            : "This browser can't record audio. You can still upload a recording.",
      });
    }

    setReady(true);

    return () => {
      alive.current = false;
      if (ticker.current) clearInterval(ticker.current);
      // Release the device on unmount. A forgotten track leaves the browser's
      // recording indicator lit after the user has navigated away, which reads
      // as "this site is still listening to me" — and fairly so.
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const teardown = useCallback(() => {
    if (ticker.current) {
      clearInterval(ticker.current);
      ticker.current = null;
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recorder.current = null;
    setElapsed(0);
  }, []);

  /** Audio in, text into the composer. Shared by the mic and the file input. */
  const send = useCallback(
    async (blob: Blob) => {
      if (!alive.current) return;
      setPhase("transcribing");
      setError(null);

      try {
        const form = new FormData();
        form.append("audio", blob, "speech");

        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const body = (await res.json().catch(() => null)) as
          | { text?: string; error?: string; reason?: string }
          | null;

        if (!alive.current) return;

        if (!res.ok) {
          // The route classifies every failure and writes the sentence itself,
          // so there is nothing to translate here — just somewhere to put it.
          setError(body?.error ?? `Transcription failed (${res.status}).`);
          return;
        }

        const text = typeof body?.text === "string" ? body.text.trim() : "";
        if (!text) {
          setError("Nothing was heard in that recording.");
          return;
        }

        onTranscript(text);
      } catch {
        setError("Couldn't reach the transcriber. Type your question instead.");
      } finally {
        if (alive.current) setPhase("idle");
      }
    },
    [onTranscript],
  );

  const stop = useCallback(() => {
    if (ticker.current) {
      clearInterval(ticker.current);
      ticker.current = null;
    }
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    stop();
    teardown();
    setPhase("idle");
  }, [stop, teardown]);

  const start = useCallback(async () => {
    if (disabled || phase !== "idle") return;
    setError(null);
    cancelled.current = false;
    setPhase("starting");

    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({
        // Browser-native cleanup. A hire talking to a laptop in an open-plan
        // office is the normal case, not the exception, and these three cost
        // nothing where they are supported and are ignored where they are not.
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setPhase("idle");

      if (name === "NotAllowedError" || name === "SecurityError") {
        // Permanent until the human changes it in browser settings, so the
        // button retires rather than sitting there inviting a click that will
        // never do anything.
        setUnavailable({
          kind: "denied",
          message:
            "Microphone access was blocked. Allow it in your browser's site settings, or upload a recording.",
        });
        return;
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        setUnavailable({
          kind: "no-device",
          message: "No microphone was found. You can still upload a recording.",
        });
        return;
      }
      // NotReadableError and friends: another app has the device, or the OS
      // said no. Transient, so this stays an error and the button stays live.
      setError("Couldn't start the microphone. Try again, or upload a recording.");
      return;
    }

    if (!alive.current) {
      media.getTracks().forEach((t) => t.stop());
      return;
    }

    const mimeType = pickMimeType();
    let rec: MediaRecorder;
    try {
      rec = mimeType ? new MediaRecorder(media, { mimeType }) : new MediaRecorder(media);
    } catch {
      // The type passed isTypeSupported but the constructor still refused —
      // rare, but it happens on some Android builds. One retry with the
      // browser's own default, then give up honestly.
      try {
        rec = new MediaRecorder(media);
      } catch {
        media.getTracks().forEach((t) => t.stop());
        setPhase("idle");
        setUnavailable({
          kind: "unsupported",
          message: "This browser can't record audio. You can still upload a recording.",
        });
        return;
      }
    }

    chunks.current = [];
    stream.current = media;
    recorder.current = rec;

    rec.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.current.push(event.data);
    };

    rec.onerror = () => {
      teardown();
      setPhase("idle");
      setError("The recording stopped unexpectedly. Try again, or upload a file.");
    };

    rec.onstop = () => {
      const captured = chunks.current;
      chunks.current = [];
      teardown();

      if (cancelled.current) {
        cancelled.current = false;
        return;
      }
      if (captured.length === 0) {
        setPhase("idle");
        setError("Nothing was recorded. Check the microphone and try again.");
        return;
      }
      // rec.mimeType rather than our requested string: the browser is the
      // authority on what it actually produced, and the server picks the
      // upload's filename extension off this.
      void send(new Blob(captured, { type: rec.mimeType || mimeType || "audio/webm" }));
    };

    // A timeslice means we hold partial chunks rather than one buffer the
    // recorder flushes at the end — so a tab that dies mid-thought has still
    // handed us most of the audio.
    rec.start(1000);
    startedAt.current = Date.now();
    setElapsed(0);
    setPhase("recording");

    ticker.current = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      // Hard stop. This is a question, not a voice memo, and an unattended
      // recorder is how you end up transcribing a meeting nobody consented to.
      if (ms >= MAX_MS) stop();
    }, 200);
  }, [disabled, phase, send, stop, teardown]);

  const onFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset immediately so picking the same file twice still fires onChange.
      event.target.value = "";
      if (!file) return;
      setError(null);
      void send(file);
    },
    [send],
  );

  // Nothing renders until the capability check has run on the client — see the
  // `ready` note above. The composer is unaffected either way.
  if (!ready) return null;

  const busy = phase === "transcribing" || phase === "starting";
  const recording = phase === "recording";

  return (
    <div className={`relative flex shrink-0 items-center gap-1.5 ${className}`}>
      {recording ? (
        <>
          <button
            type="button"
            onClick={cancel}
            aria-label="Discard recording"
            title="Discard"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-muted"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={stop}
            aria-label="Stop recording and transcribe"
            className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-warn-line bg-warn-soft px-2.5 text-warn transition-colors hover:border-warn/40"
          >
            <span
              className="dot h-2 w-2 rounded-full bg-warn"
              role="status"
              aria-label="Recording"
            />
            <span className="tnum text-[12px] font-medium">{clock(elapsed)}</span>
            <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden>
              <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />
            </svg>
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={disabled || busy || unavailable !== null}
          aria-label={
            unavailable ? unavailable.message : "Record a question instead of typing it"
          }
          title={unavailable ? unavailable.message : "Speak your question"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          {phase === "transcribing" ? (
            <span className="flex items-center gap-[3px]" role="status" aria-label="Transcribing">
              <span className="dot h-1 w-1 rounded-full bg-muted" />
              <span className="dot h-1 w-1 rounded-full bg-muted" />
              <span className="dot h-1 w-1 rounded-full bg-muted" />
            </span>
          ) : (
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
              <rect
                x="5.75"
                y="1.75"
                width="4.5"
                height="8"
                rx="2.25"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M3.25 7.5v.75a4.75 4.75 0 0 0 9.5 0V7.5M8 13v1.25"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      )}

      {/* The demo insurance policy. Always present, because the moment it is
          needed is the moment the mic has already failed. */}
      {!recording && (
        <label
          title={
            unavailable
              ? `${unavailable.message} Upload an audio file instead.`
              : "Upload a voice note"
          }
          className={`grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink ${
            disabled || busy ? "pointer-events-none opacity-30" : ""
          }`}
        >
          <span className="sr-only">Upload an audio file to transcribe</span>
          <input
            type="file"
            accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.flac"
            className="hidden"
            disabled={disabled || busy}
            onChange={onFile}
          />
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
            <path
              d="M13 7.5v-3a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h3"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M11.5 9.5v4M9.5 11.5h4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </label>
      )}

      {/* Floated above the composer, out of layout flow, so a voice failure
          never reflows the text box under someone's cursor mid-sentence. The
          typing path is not allowed to so much as move because voice broke. */}
      {(error || (unavailable && unavailable.kind !== "unsupported")) && (
        <span
          role="status"
          className="pointer-events-none absolute right-0 bottom-full z-10 mb-2 w-max max-w-[16rem] rounded-md border border-warn-line bg-warn-soft px-2 py-1 text-[11px] leading-snug text-warn"
        >
          {error ?? unavailable?.message}
        </span>
      )}
    </div>
  );
}
