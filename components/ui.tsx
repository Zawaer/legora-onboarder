import type { ReactNode } from "react";

/* Small shared presentational pieces. Deliberately tiny — no design system. */

export function Mark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="2.75"
        y="2.75"
        width="18.5"
        height="18.5"
        rx="5.5"
        className="stroke-ink/25"
        strokeWidth="1.4"
      />
      <path
        d="M7.5 15.4V8.6M7.5 8.6c3.4 0 3.4 3.1 0 3.1M7.5 11.7c3.9 0 3.9 3.7 0 3.7"
        className="stroke-accent"
        strokeWidth="1.7"
      />
      <circle cx="16.4" cy="9" r="1.5" className="fill-accent" />
      <path d="M16.4 12.4v3" className="stroke-ink/40" strokeWidth="1.5" />
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
        Onboarder
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
