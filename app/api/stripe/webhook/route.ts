import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { listPayments, savePayment } from "@/lib/store";
import type { Payment } from "@/lib/types";

// Signature verification needs the untouched request body.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "no signature" }, { status: 400 });
  }

  // Raw body is required for signature verification — do not parse as JSON first.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error("stripe signature verification failed", error);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;

      const record: Payment = {
        // A one-off has no subscription, so the session id is the only key
        // present in both modes and stable across Stripe's retries.
        stripe_session_id: session.id,
        stripe_customer_id: (session.customer as string | null) ?? null,
        stripe_subscription_id: (session.subscription as string | null) ?? null,
        plan: session.metadata?.plan ?? "pro",
        mode: session.mode,
        source: session.metadata?.source ?? "unknown",
        // Stripe's own flag, not ours — the one source of truth for whether
        // this was real money or a card-4242 test.
        livemode: event.livemode,
        // `paid` covers the one-off; a subscription session is only completed
        // once the first invoice has actually gone through.
        status: session.payment_status === "paid" ? "active" : "incomplete",
        amount_total: session.amount_total,
        currency: session.currency,
        created_at: new Date(event.created * 1000).toISOString(),
      };

      await savePayment(record);
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      // Subscription events carry no session id, so find the row by the
      // subscription we stored at checkout and re-upsert it. A subscription we
      // never saw a checkout for is not ours to record.
      const existing = (await listPayments()).find(
        (row) => row.stripe_subscription_id === subscription.id,
      );
      if (existing) {
        await savePayment({ ...existing, status: subscription.status });
      }
      break;
    }

    default:
      break;
  }

  // Always 2xx once the signature checked out. A non-2xx makes Stripe retry
  // forever over something we already have on disk.
  return NextResponse.json({ received: true });
}
