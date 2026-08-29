import type { ReactNode } from "react";
import { PRODUCT } from "@/lib/product";

/* Small shared presentational pieces. Deliberately tiny — no design system. */

/**
 * The mark: a vana — the trail someone leaves behind — with one point picked out.
 *
 * Sampled from the full lockup onto a 24 grid at nine dots rather than the
 * original twenty-four. At the 18px the wordmark actually renders it,
 * twenty-four dots collapse into a smudge; nine keep the wave legible and the
 * highlighted point distinct, which is the whole idea of the mark.
 *
 * The dots take their colour from tokens rather than the source's #0a0a0a and
 * #c99a3a, so the mark inverts correctly in dark mode. The brass in the
 * original is within a few points of our accent already.
 */
export function Mark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="3.0" cy="12.0" r="1.15" className="fill-ink/45" />
      <circle cx="5.25" cy="15.54" r="1.15" className="fill-ink/45" />
      <circle cx="7.5" cy="17.0" r="1.15" className="fill-ink/45" />
      <circle cx="9.75" cy="15.54" r="1.15" className="fill-ink/45" />
      <circle cx="12.0" cy="12.0" r="1.9" className="fill-accent" />
      <circle cx="14.25" cy="8.46" r="1.15" className="fill-ink/45" />
      <circle cx="16.5" cy="7.0" r="1.15" className="fill-ink/45" />
      <circle cx="18.75" cy="8.46" r="1.15" className="fill-ink/45" />
      <circle cx="21.0" cy="12.0" r="1.15" className="fill-ink/45" />
    </svg>
  );
}

export function Wordmark({ muted = false }: { muted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark className="h-[18px] w-[18px]" />
      <span
        className={`text-[15px] font-semibold tracking-[-0.01em] ${
          muted ? "text-muted" : "text-ink"
        }`}
      >
        {PRODUCT}
      </span>
    </span>
  );
}

export function Label({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`label ${className}`}>{children}</div>;
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface ${className}`}
      style={{ boxShadow: "var(--shadow)" }}
    >
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warn" | "ok";
}) {
  const tones = {
    neutral: "border-line bg-surface-2 text-muted",
    accent: "border-accent/25 bg-accent-soft text-accent-ink",
    warn: "border-warn-line bg-warn-soft text-warn",
    ok: "border-ok-line bg-ok-soft text-ok",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-medium tracking-[0.01em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * What a screen has to say about itself when the people on it were written.
 *
 * Resolved on the server (`getCompany`) so it is `undefined` for a corpus a
 * customer uploaded themselves — that Slack is real, and calling it fictional
 * would be a worse falsehood than the one this notice exists to prevent.
 */
export type SyntheticCorpus = { companyName: string; people?: number };

/**
 * Says out loud, inline and before anyone asks, that the demo workspace is
 * invented.
 *
 * Lexhav is a real company in Stockholm and this corpus is not theirs: the
 * fourteen names, their titles and every message in the export were written
 * for the demo. That is fine right up to the moment somebody who works there
 * opens it and has to work out for themselves whether it is real — and trust
 * damaged by working it out yourself is trust that does not come back, while
 * a disclosure made first costs almost nothing. So it is stated adjacent to
 * the content, above the fold, on every screen that puts an invented person's
 * name on it: never a footer, never behind a disclosure triangle, and with
 * nothing to click that makes it go away.
 *
 * Deliberately not a warning — no amber, no icon, no alert. It is a line of
 * spec in the same register as the coverage panel, and it says a different
 * thing: the coverage panel is "here is what we could not see", this is "none
 * of this is real". Both have to survive; neither replaces the other.
 */
export function SyntheticNote({
  companyName,
  people,
  className = "",
}: SyntheticCorpus & { className?: string }) {
  return (
    <div
      className={`flex gap-2.5 rounded-lg border border-line-strong bg-surface-2 px-3.5 py-2.5 ${className}`}
    >
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
      <p className="max-w-[88ch] text-[12.5px] leading-[1.55] text-muted">
        <span className="font-semibold text-ink">Synthetic workspace.</span> The
        company, the{" "}
        {typeof people === "number" && (
          <>
            <span className="tnum">{people}</span>{" "}
          </>
        )}
        people and every message are invented &mdash; built to mirror how a
        fast-growing company is structured. Nothing here is real {companyName}{" "}
        data.
      </p>
    </div>
  );
}

/** Avatar initials. Two words at most — three letters in a circle reads as a logo. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

export function Spinner() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 animate-spin" aria-hidden fill="none">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.6" opacity="0.25" />
      <path
        d="M14.25 8A6.25 6.25 0 0 0 8 1.75"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Deterministic, locale-stable time. Avoids server/client hydration drift. */
export function clockTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function agoFrom(iso?: string, now = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
