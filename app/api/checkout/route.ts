import { NextResponse } from "next/server";
import { z } from "zod";
import { createCheckoutSession, PLAN_IDS } from "@/lib/stripe";
import { normaliseSource } from "@/lib/source";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  plan: z.enum(PLAN_IDS).default("pro"),
  source: z.string().max(64).optional(),
});

/**
 * What the buy button on a page posts to. Anonymous — there is no account to
 * look up, so the only thing worth carrying into Stripe is the channel the
 * click came from.
 */
export async function POST(request: Request) {
  const limited = rateLimit(`checkout:${clientIp(request)}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  try {
    const session = await createCheckoutSession({
      plan: parsed.data.plan,
      source: normaliseSource(parsed.data.source, "landing"),
      origin,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    // Surface a message the button can render instead of a blank redirect.
    console.error("checkout session failed", error);
    return NextResponse.json({ error: "checkout unavailable" }, { status: 500 });
  }
}
