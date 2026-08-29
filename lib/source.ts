/**
 * Channel attribution. Every link we hand out carries `?source=` — `room`,
 * `linkedin`, `dm`, `lexhav`, `whatsapp` — and it rides all the way through to
 * the Stripe metadata, so we can say which channel produced the money.
 *
 * "We got three customers" is a traction claim. "We got three customers, all
 * from one afternoon of in-person conversations, at a 15% close rate" is
 * evidence we can do it again, which is what business potential is actually
 * scored on.
 */
export const KNOWN_SOURCES = [
  "room",
  "lexhav",
  "linkedin",
  "whatsapp",
  "dm",
  "landing",
  "qr",
] as const;

/** Lowercase, slug-safe, length-capped. Never throws — a bad source is not worth losing a sale over. */
export function normaliseSource(
  raw: string | string[] | undefined,
  fallback = "direct",
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const cleaned = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);

  return cleaned || fallback;
}
