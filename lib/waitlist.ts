/**
 * The waitlist: two facts, kept in one place because both are public claims.
 *
 * `WAITLIST_COMPANIES` renders on a public page as a count of real companies.
 * It must be a number someone could check — set it from actual bookings, never
 * from optimism. At 0 the component shows "Booking now" instead of a number,
 * so the honest floor costs nothing and there is never a reason to round up.
 *
 * There is deliberately no email field. The ask is twenty minutes on a call,
 * which is a far stronger signal than an address and is the thing we actually
 * want; an email box beside it would harvest the weaker signal and quietly
 * cannibalise the stronger one.
 */

/** Google Calendar booking page. */
export const WAITLIST_BOOKING_URL = "https://calendar.app.google/UiygZvmbarXj5Rnq5";

/** Real companies on the list. Update by hand from bookings. */
export const WAITLIST_COMPANIES = 1;

export function waitlistCountLabel(n: number = WAITLIST_COMPANIES): string {
  if (n <= 0) return "Booking now";
  return `${n} ${n === 1 ? "company" : "companies"} waiting`;
}
