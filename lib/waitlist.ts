/**
 * The waitlist.
 *
 * TWO ASKS, NOT ONE, AND IN THIS ORDER
 *
 * The booking link alone was the whole waitlist, and it asked a cold visitor
 * for twenty minutes of their time before they had spoken to anyone. Most
 * people will not do that, and — worse — they leave no trace when they decline,
 * so we learn nothing from the ones we lose.
 *
 * An email box beside the booking link would cannibalise it: offered both, most
 * people take the cheaper one. So the two are sequenced instead of paired. The
 * email is the primary ask because almost anyone interested will give it, and
 * the call is offered immediately *after* it is captured, when we already have
 * the weaker signal banked and there is nothing left to lose by asking for the
 * stronger one.
 *
 * This file is imported by a client component, so it must stay free of node
 * builtins — the sink that needs them lives in lib/waitlist-sink.ts.
 *
 * WHERE AN ADDRESS ACTUALLY GOES
 *
 * This runs on serverless, where the filesystem is read-only and per-instance,
 * so writing to disk in production means dropping the signup on the floor a few
 * minutes later. Silently losing a real person's address is worse than not
 * asking for it, so `recordSignup` refuses to report success unless something
 * durable accepted it. If neither sink is available the route returns an error
 * and the form says so, rather than showing a tick over a black hole.
 */

/** Google Calendar booking page — the second ask, offered after capture. */
export const WAITLIST_BOOKING_URL = "https://calendar.app.google/UiygZvmbarXj5Rnq5";

/** Real companies on the list. Update by hand from actual signups. */
export const WAITLIST_COMPANIES = 1;

export function waitlistCountLabel(n: number = WAITLIST_COMPANIES): string {
  if (n <= 0) return "Booking now";
  return `${n} ${n === 1 ? "company" : "companies"} waiting`;
}

/** Deliberately permissive: rejecting a real address costs more than accepting a junk one. */
export function isPlausibleEmail(value: string): boolean {
  const v = value.trim();
  return v.length >= 6 && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}
