import type { Metadata } from "next";
import TractionBoard from "@/components/traction-board";
import { isLiveMode } from "@/lib/livemode";
import { listLois, listPayments } from "@/lib/store";

/**
 * The evidence page. This is what goes on the projector and what gets
 * screenshotted into the submission form, so it must never be a cached copy of
 * a sale that has since been refunded or a signature that has since landed.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Traction · Vanav",
  description:
    "Paying customers, revenue by channel, and signed letters of intent — read live from the payment and LOI stores, with Stripe test-mode records separated out and counted nowhere.",
};

export default async function PitchPage() {
  // Both reads already swallow a missing or truncated file and return []. The
  // catch is the second belt: this page failing is strictly worse than this
  // page showing zeroes, because a judge is looking at it either way.
  const [payments, lois] = await Promise.all([
    listPayments().catch(() => []),
    listLois().catch(() => []),
  ]);

  return (
    <TractionBoard
      payments={payments}
      lois={lois}
      keysAreLive={isLiveMode()}
      renderedAt={new Date().toISOString()}
    />
  );
}
