"use client";

/**
 * The briefing player on /manager.
 *
 * ── WHY IT LOOKS LIKE THIS ───────────────────────────────────────────────────
 *
 * The manager this is built for is not sitting in front of the screen; that is
 * the entire premise. So the player is one button and one line of state, and
 * the script is printed underneath it in full. The transcript is not a
 * fallback — it is half the feature. It works with the sound off, it works on a
 * projector in a room where nobody is going to play audio, it works for anyone
 * who cannot hear it, and it works when the ElevenLabs quota is dry. The audio
 * is the format that fits the commute; the text is the format that fits
 * everywhere else.
 *
 * ── WHY THE SCRIPT LOADS BUT THE AUDIO DOES NOT ──────────────────────────────
 *
 * On mount we fetch `?text=1`, which is free. Speech is generated only when a
 * human presses play. The manager screen polls itself every eight seconds; a
 * component that synthesised audio on every render would burn a hackathon quota
 * before lunch, and — more to the point — would be spending the customer's
 * money to produce something nobody asked to hear.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Label } from "./ui";

type BriefPayload = {
  script: string;
  wordCount: number;
  estimatedSeconds: number;
  needsHuman: number;
  handled: number;
  voice?: { ok?: boolean; reason?: string; configured?: boolean };
};

type Phase = "idle" | "loading" | "playing" | "paused";

/** Plain-English reasons. The manager does not care which HTTP status it was. */
function noticeFor(reason: string | undefined): string {
  switch (reason) {
    case "missing_key":
      return "No ElevenLabs key on this deployment, so there is no audio. The briefing is below.";
    case "quota_exhausted":
      return "The ElevenLabs credits for this key are used up. The briefing is below.";
    case "unauthorized":
      return "ElevenLabs rejected the API key. The briefing is below.";
    case "rate_limited":
      return "ElevenLabs is rate limiting right now. Try again in a moment.";
    case "timeout":
      return "ElevenLabs took too long to answer. Try again, or just read it.";
    default:
      return "Audio is unavailable right now. The briefing is below.";
  }
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function VoiceBrief() {
  const [brief, setBrief] = useState<BriefPayload | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  /** The script the loaded audio was generated from, so we can spot staleness. */
  const spokenScriptRef = useRef<string | null>(null);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const dropAudio = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    spokenScriptRef.current = null;
    setElapsed(0);
    setDuration(0);
    setPhase("idle");
  }, []);

  // ── the script, on mount and then on a slow poll ──────────────────────────
  // The blockers list next to this refreshes every eight seconds. A briefing
  // that still describes a blocker somebody cleared ten minutes ago is worse
  // than no briefing, so we re-read the script — but never while it is playing,
  // because swapping the transcript under a listener is disorienting.
  useEffect(() => {
    let alive = true;

    async function load() {
      if (phaseRef.current === "loading" || phaseRef.current === "playing") return;
      try {
        const res = await fetch("/api/brief?text=1", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as BriefPayload;
        if (!alive || typeof next?.script !== "string") return;

        // A changed script invalidates audio we already generated for the old
        // one. Checked against a ref, not inside a state updater — updaters run
        // twice under StrictMode and must stay free of side effects.
        if (spokenScriptRef.current && spokenScriptRef.current !== next.script) {
          dropAudio();
        }
        setBrief(next);
        if (next.voice?.configured === false) setNotice(noticeFor("missing_key"));
      } catch {
        // Silent. The blocker list on this page owns the "we can't reach the
        // server" story; two components saying it is noise.
      }
    }

    load();
    const id = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [dropAudio]);

  // Revoke the blob on unmount so a long-lived manager screen does not leak.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const toggle = useCallback(async () => {
    const el = audioRef.current;
    if (!el || !brief) return;

    if (phase === "playing") {
      el.pause();
      return;
    }

    if (objectUrlRef.current && spokenScriptRef.current === brief.script) {
      await el.play().catch(() => setPhase("paused"));
      return;
    }

    setPhase("loading");
    setNotice(null);

    try {
      const res = await fetch("/api/brief", { cache: "no-store" });
      const type = res.headers.get("content-type") ?? "";

      if (res.ok && type.startsWith("audio/")) {
        const blob = await res.blob();
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        spokenScriptRef.current = brief.script;
        el.src = objectUrl;
        await el.play().catch(() => setPhase("paused"));
        return;
      }

      // The route degraded rather than failed: it handed back the script and a
      // reason. Show both, keep the panel intact.
      const body = (await res.json().catch(() => null)) as BriefPayload | null;
      if (body?.script) setBrief(body);
      setNotice(noticeFor(res.status === 429 ? "rate_limited" : body?.voice?.reason));
      setPhase("idle");
    } catch {
      setNotice("Could not reach the briefing service. The text below is still current.");
      setPhase("idle");
    }
  }, [brief, phase]);

  const total = duration || brief?.estimatedSeconds || 0;
  const progress = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;
  const playing = phase === "playing";
  const loading = phase === "loading";

  return (
    <section className="mx-auto max-w-[1100px] px-5 sm:px-8">
      <div className="border-t border-line py-10">
        <Label>Two-minute briefing</Label>

        <p className="mt-3.5 max-w-[68ch] text-[14px] leading-[1.7] text-muted">
          You are onboarding twenty people and you are not at a desk. This is
          everything above, read out loud in under ninety seconds, what needs
          you, who can clear it, and how many minutes it costs. Spoken by
          ElevenLabs. Obstacles only, never a judgement of anyone.
        </p>

        <div
          className="mt-5 overflow-hidden rounded-xl border border-line bg-surface"
          style={{ boxShadow: "var(--shadow)" }}
        >
          {/* ── transport ── */}
          <div className="flex items-center gap-3.5 px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={toggle}
              disabled={!brief || loading}
              aria-label={playing ? "Pause the briefing" : "Play the briefing"}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper transition-opacity hover:opacity-85 disabled:opacity-35"
            >
              {loading ? (
                <svg viewBox="0 0 16 16" className="h-4 w-4 animate-spin" aria-hidden>
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.3"
                    strokeWidth="2"
                  />
                  <path
                    d="M8 2a6 6 0 0 1 6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : playing ? (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
                  <rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
                  <rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" className="ml-[2px] h-4 w-4" aria-hidden>
                  <path d="M4.5 2.9v10.2a.6.6 0 0 0 .92.5l8-5.1a.6.6 0 0 0 0-1l-8-5.1a.6.6 0 0 0-.92.5Z" fill="currentColor" />
                </svg>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium tracking-[-0.005em]">
                {brief
                  ? brief.needsHuman > 0
                    ? `${brief.needsHuman} ${brief.needsHuman === 1 ? "thing needs" : "things need"} you`
                    : "Nothing needs you"
                  : "Composing the briefing"}
              </div>
              <div className="tnum mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-faint">
                {loading ? (
                  <span>generating audio…</span>
                ) : (
                  <span>
                    {clock(elapsed)} / {clock(total)}
                  </span>
                )}
                {brief && (
                  <>
                    <span className="text-line-strong">·</span>
                    <span>{brief.wordCount} words</span>
                    {brief.handled > 0 && (
                      <>
                        <span className="text-line-strong">·</span>
                        <span>{brief.handled} handled without you</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            <span className="hidden shrink-0 text-[11px] text-faint sm:block">
              ElevenLabs
            </span>
          </div>

          {/* ── progress: two pixels, no chrome ── */}
          <div className="h-[2px] w-full bg-surface-2">
            <div
              className="h-full bg-ink transition-[width] duration-200 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          {notice && (
            <p className="border-b border-line bg-warn-soft px-4 py-2.5 text-[12.5px] text-warn sm:px-5">
              {notice}
            </p>
          )}

          {/* ── the script: half the feature, not a fallback ── */}
          <div className="px-4 py-4 sm:px-5">
            {brief ? (
              <p className="max-w-[72ch] text-[14.5px] leading-[1.8] text-ink">
                {brief.script}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="skeleton h-4 w-full rounded" />
                <div className="skeleton h-4 w-[92%] rounded" />
                <div className="skeleton h-4 w-[64%] rounded" />
              </div>
            )}
          </div>
        </div>

        {/* Real element, driven by our own transport so it matches the page. */}
        <audio
          ref={audioRef}
          preload="none"
          hidden
          onPlay={() => setPhase("playing")}
          onPause={() => setPhase((p) => (p === "playing" ? "paused" : p))}
          onEnded={() => {
            setPhase("paused");
            setElapsed(0);
          }}
          onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            // Some browsers report Infinity for a blob until it is fully
            // buffered; the composer's own estimate is a better number to show
            // than "Infinity:NaN".
            setDuration(Number.isFinite(d) ? d : 0);
          }}
          onError={(e) => {
            // Tearing down a blob (removeAttribute + load) fires an error event
            // in some browsers. Only a real source that failed is worth saying
            // anything about.
            if (!e.currentTarget.currentSrc) return;
            setNotice("The audio would not play in this browser. The briefing is below.");
            setPhase("idle");
          }}
        />
      </div>
    </section>
  );
}
