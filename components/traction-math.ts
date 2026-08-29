/**
 * The arithmetic behind /pitch, kept out of the view.
 *
 * One rule governs everything in this file: a record only counts when Stripe
 * says it was real money. Traction is 18 of the 50 points and inflating it is
 * disqualifying, so every helper here defaults to *not* counting — an unknown
 * status, a missing `livemode`, a malformed row all fall on the "does not
 * count" side rather than quietly adding to a headline number.
 */

import type { Loi, Payment } from "@/lib/types";

/**
 * Stripe statuses that mean the money actually arrived.
 *
 * The webhook writes "active" for a paid one-off and otherwise mirrors Stripe's
 * own subscription status, so a row on disk can read "incomplete", "past_due"
 * or "canceled" too. Those are shown on the page but never counted, because a
 * checkout that started is not a customer.
 */
const COLLECTED = new Set(["active", "trialing", "paid", "complete"]);

/** Currencies Stripe quotes in whole units — `amount_total` is not /100 there. */
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

const DEFAULT_CURRENCY = "sek";

export type Band = 0 | 6 | 12 | 18;

// ────────────────────────────────────────────────────────────── formatting

/** `amount` is Stripe minor units (öre). */
export function formatMoney(amount: number, currency?: string | null): string {
  const code = (currency || DEFAULT_CURRENCY).toLowerCase();
  const major = ZERO_DECIMAL.has(code) ? amount : amount / 100;
  // Round price points read better on a projector without the ",00" — the
  // decimals are noise at three metres, and we never drop a real fraction.
  const digits = Number.isInteger(major) ? 0 : 2;

  try {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(major);
  } catch {
    // An unrecognised ISO code makes Intl throw. A page of live evidence must
    // not 500 because Stripe sent a currency we did not anticipate.
    return `${major.toLocaleString("sv-SE")} ${code.toUpperCase()}`;
  }
}

/**
 * Absolute, unambiguous, and pinned to one timezone.
 *
 * These timestamps get screenshotted into a submission form, so a relative
 * "2h ago" is worthless there and a locale-dependent format invites the reading
 * where 08-09 is September. ISO date + Stockholm wall clock survives both.
 */
const STAMP = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Stockholm",
});

export function stamp(iso?: string | null): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return STAMP.format(at);
}

// ─────────────────────────────────────────────────────────────── the bands

export type Rung = {
  band: Band;
  criterion: string;
  met: boolean;
  /** Empty when met. Otherwise the exact shortfall, e.g. ["2 more paying customers"]. */
  remaining: string[];
};

function shortfall(have: number, need: number, singular: string): string | null {
  const gap = need - have;
  if (gap <= 0) return null;
  const noun = gap === 1 ? singular : `${singular}s`;
  // "2 more paying customers" only reads correctly once at least one exists.
  return have > 0 ? `${gap} more ${noun}` : `${gap} ${noun}`;
}

function buildLadder(customers: number, lois: number): Rung[] {
  const sixth = customers >= 1 || lois >= 1;

  const twelfth = [
    shortfall(customers, 1, "paying customer"),
    shortfall(lois, 1, "signed LOI"),
  ].filter((n): n is string => n !== null);

  const eighteenth = [shortfall(customers, 3, "paying customer")].filter(
    (n): n is string => n !== null,
  );

  return [
    { band: 0, criterion: "Nothing captured.", met: true, remaining: [] },
    {
      band: 6,
      criterion: "A captured demand signal, a waitlist entry or a demo request.",
      met: sixth,
      remaining: sixth ? [] : ["1 signed LOI"],
    },
    {
      band: 12,
      criterion: "One paying customer, plus signed letters of intent.",
      met: twelfth.length === 0,
      remaining: twelfth,
    },
    {
      band: 18,
      criterion: "Three or more paying customers.",
      met: eighteenth.length === 0,
      remaining: eighteenth,
    },
  ];
}

// ───────────────────────────────────────────────────── channel attribution

export type ChannelRow = {
  source: string;
  revenue: number;
  currency: string;
  customers: number;
  lois: number;
  /** Whatever the bar is measuring, per `ChannelBreakdown.basis`. */
  value: number;
  /** Bar width, 0–100, relative to the largest row. */
  width: number;
  /** Share of the whole, 0–100. */
  share: number;
};

export type ChannelBreakdown = {
  basis: "revenue" | "customers" | "lois";
  currency: string;
  rows: ChannelRow[];
};

function customerKey(payment: Payment): string {
  // Stripe creates a customer for both plans, so this is normally the real
  // identity. The session id is the fallback so a row missing a customer still
  // counts exactly once rather than collapsing into another row's undefined.
  return payment.stripe_customer_id || payment.stripe_session_id || "unknown";
}

function breakdown(counted: Payment[], lois: Loi[]): ChannelBreakdown {
  type Bucket = { revenue: number; customers: Set<string>; lois: number; currency: string };
  const buckets = new Map<string, Bucket>();

  const at = (source: string): Bucket => {
    const key = source || "unknown";
    const found = buckets.get(key);
    if (found) return found;
    const fresh: Bucket = { revenue: 0, customers: new Set(), lois: 0, currency: DEFAULT_CURRENCY };
    buckets.set(key, fresh);
    return fresh;
  };

  for (const payment of counted) {
    const bucket = at(payment.source);
    bucket.revenue += payment.amount_total ?? 0;
    bucket.customers.add(customerKey(payment));
    bucket.currency = (payment.currency || DEFAULT_CURRENCY).toLowerCase();
  }
  for (const loi of lois) at(loi.source).lois += 1;

  const currencies = new Set(
    counted.map((p) => (p.currency || DEFAULT_CURRENCY).toLowerCase()),
  );
  const revenue = counted.reduce((sum, p) => sum + (p.amount_total ?? 0), 0);

  /**
   * Bars measure money where money exists and the money is comparable. Adding
   * minor units across currencies is arithmetic on incompatible numbers, so a
   * mixed-currency account counts customers instead, and an account with no
   * revenue yet counts LOIs. In all three cases the bar answers the same
   * question — which channel produced this — which is the claim being made.
   */
  const basis: ChannelBreakdown["basis"] =
    revenue > 0 && currencies.size <= 1 ? "revenue" : counted.length > 0 ? "customers" : "lois";

  const partial = [...buckets.entries()].map(([source, b]) => ({
    source,
    revenue: b.revenue,
    currency: b.currency,
    customers: b.customers.size,
    lois: b.lois,
    value: basis === "revenue" ? b.revenue : basis === "customers" ? b.customers.size : b.lois,
  }));

  const total = partial.reduce((sum, r) => sum + r.value, 0);
  const max = partial.reduce((hi, r) => Math.max(hi, r.value), 0);

  const rows = partial
    .map((r) => ({
      ...r,
      width: max > 0 ? (r.value / max) * 100 : 0,
      share: total > 0 ? (r.value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value || b.revenue - a.revenue || a.source.localeCompare(b.source));

  return {
    basis,
    currency: currencies.size === 1 ? [...currencies][0] : DEFAULT_CURRENCY,
    rows,
  };
}

// ──────────────────────────────────────────────────────────── the summary

export type Money = { currency: string; amount: number };

export type Summary = {
  /** Real money, real signatures. The only inputs to any headline number. */
  live: { counted: Payment[]; pending: Payment[]; lois: Loi[] };
  /** Stripe test mode. Shown in full, counted nowhere. */
  test: { payments: Payment[]; lois: Loi[] };
  payingCustomers: number;
  revenue: Money[];
  testRevenue: Money[];
  loiCount: number;
  band: Band;
  ladder: Rung[];
  /** The immediate next rung and its exact shortfall. Null at 18. */
  next: Rung | null;
  channels: ChannelBreakdown;
  totalRecords: number;
  hasTestRecords: boolean;
};

function totalsByCurrency(payments: Payment[]): Money[] {
  const sums = new Map<string, number>();
  for (const p of payments) {
    const code = (p.currency || DEFAULT_CURRENCY).toLowerCase();
    sums.set(code, (sums.get(code) ?? 0) + (p.amount_total ?? 0));
  }
  return [...sums.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function summarise(payments: Payment[], lois: Loi[]): Summary {
  // `!== true` rather than `=== false`: a row that somehow lost its livemode
  // flag is treated as test. The safe direction for an unknown is always down.
  const livePayments = payments.filter((p) => p.livemode === true);
  const testPayments = payments.filter((p) => p.livemode !== true);
  const liveLois = lois.filter((l) => l.livemode === true);
  const testLois = lois.filter((l) => l.livemode !== true);

  const counted = livePayments.filter((p) => COLLECTED.has(p.status));
  const pending = livePayments.filter((p) => !COLLECTED.has(p.status));

  const payingCustomers = new Set(counted.map(customerKey)).size;
  const loiCount = liveLois.length;

  const ladder = buildLadder(payingCustomers, loiCount);
  // The band is the highest rung whose criterion is actually satisfied.
  const band = ladder.reduce<Band>((best, r) => (r.met ? r.band : best), 0);
  // The next rung *above* where we are. Three paying customers with no LOI
  // scores 18 while rung 12 reads unmet, and pointing that team at rung 12
  // would be telling them to work for points they already have.
  const next = ladder.find((r) => r.band > band && !r.met) ?? null;

  return {
    live: { counted, pending, lois: liveLois },
    test: { payments: testPayments, lois: testLois },
    payingCustomers,
    revenue: totalsByCurrency(counted),
    testRevenue: totalsByCurrency(testPayments),
    loiCount,
    band,
    ladder,
    next,
    channels: breakdown(counted, liveLois),
    totalRecords: payments.length + lois.length,
    hasTestRecords: testPayments.length + testLois.length > 0,
  };
}
