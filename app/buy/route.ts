import { NextResponse } from "next/server";
import { createCheckoutSession, PLAN_IDS, type PlanId } from "@/lib/stripe";
import { normaliseSource } from "@/lib/source";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Creates a session per request and must never be cached or prerendered.
export const dynamic = "force-dynamic";

/**
 * The QR target. Scanning the code on /pay lands here and bounces straight
 * into Stripe Checkout — no landing page, no account, no app install between
 * wanting it and paying for it. The whole transaction is about forty seconds.
 *
 * Deliberately does no session lookup: the phone scanning this belongs to a
 * stranger, and an auth round-trip would buy us nothing but latency at the
 * exact moment attention is most expensive. Attribution rides on `?source=`
 * instead, and the webhook records it.
 *
 *   /buy                      → the one-off, attributed to `qr`
 *   /buy?plan=pro&source=room → the subscription, attributed to the room
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;

  const limited = rateLimit(`buy:${clientIp(request)}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const requested = url.searchParams.get("plan");
  const plan: PlanId = (PLAN_IDS as readonly string[]).includes(requested ?? "")
    ? (requested as PlanId)
    : "once";
  const source = normaliseSource(url.searchParams.get("source") ?? undefined, "qr");

  try {
    const session = await createCheckoutSession({ plan, source, origin });
    if (!session.url) throw new Error("Stripe returned a session with no url");

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    // Someone is standing in front of us with a phone out. A Next error screen
    // loses the sale; the landing page at least keeps the conversation alive.
    console.error("buy redirect failed", error);
    return NextResponse.redirect(`${origin}/?checkout=unavailable`, 303);
  }
}
