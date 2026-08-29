import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * Lazy singleton. Instantiating at module scope breaks `next build`, which
 * evaluates route modules without runtime env vars present.
 */
export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, { typescript: true });
  }
  return client;
}

/**
 * `pro` is the recurring subscription — the pilot seat a Head of People renews.
 * `once` is a single payment, which is what actually converts when you are
 * stood next to someone with 40 seconds of their attention. Both are real
 * revenue on the rubric; a subscription is worth more in the pitch, a one-off
 * is worth more in the hallway. Ship both and let the situation pick.
 */
export type PlanId = "pro" | "once";

export const PLAN_IDS = ["pro", "once"] as const satisfies readonly PlanId[];

type PlanConfig = {
  price: string;
  mode: Stripe.Checkout.SessionCreateParams.Mode;
};

/** Price ids live in env so we can swap the product without a redeploy. */
const PLANS: Record<PlanId, { envVar: string; mode: PlanConfig["mode"] }> = {
  pro: { envVar: "STRIPE_PRICE_PRO", mode: "subscription" },
  once: { envVar: "STRIPE_PRICE_ONCE", mode: "payment" },
};

export function planConfig(plan: PlanId): PlanConfig {
  const { envVar, mode } = PLANS[plan];
  const price = process.env[envVar];
  if (!price) throw new Error(`${envVar} is not set — no price for plan "${plan}"`);
  return { price, mode };
}

/**
 * The one place that builds a Checkout session. Every sale reaches it through
 * the QR route (GET /buy), so attribution is set here and nowhere else — two
 * copies of this would eventually disagree and the source breakdown would lie.
 *
 * There is no user id or email here, and that is deliberate: checkout is
 * anonymous. The person scanning the QR has no account with us and should not
 * be asked to make one between wanting the thing and paying for it.
 */
export async function createCheckoutSession({
  plan,
  source,
  origin,
}: {
  plan: PlanId;
  source: string;
  origin: string;
}) {
  const { price, mode } = planConfig(plan);

  return getStripe().checkout.sessions.create({
    mode,
    line_items: [{ price, quantity: 1 }],
    // Both modes land on /thanks. Nobody logs in, so there is no dashboard to
    // bounce a fresh customer into one second after they paid us.
    success_url: `${origin}/thanks?checkout=success&plan=${plan}`,
    cancel_url: `${origin}/?checkout=cancelled`,
    // The only attribution that survives the redirect to Stripe and comes back
    // in the webhook. Losing it means every sale reads as "unknown".
    metadata: { plan, source },
    allow_promotion_codes: true,
    // Without this a one-off session has no customer, so we lose the only
    // durable handle on who paid.
    ...(mode === "payment" ? { customer_creation: "always" as const } : {}),
  });
}

/**
 * The human price, read from Stripe rather than hardcoded, so the QR page
 * cannot drift from what the customer is actually charged.
 */
export async function describePlan(plan: PlanId) {
  const { price: priceId, mode } = planConfig(plan);
  const price = await getStripe().prices.retrieve(priceId);

  const amount =
    price.unit_amount != null
      ? new Intl.NumberFormat("sv-SE", {
          style: "currency",
          currency: price.currency,
          maximumFractionDigits: 0,
        }).format(price.unit_amount / 100)
      : null;

  return {
    mode,
    amount,
    interval: price.recurring?.interval ?? null,
    label: amount
      ? price.recurring
        ? `${amount} / ${price.recurring.interval}`
        : amount
      : null,
  };
}
