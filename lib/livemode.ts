/**
 * Is this deployment taking real money?
 *
 * Derived from the Stripe key rather than a separate flag, because a separate
 * flag is one more thing to remember to flip on Saturday — and the failure
 * mode of forgetting is that sandbox tests get counted as real traction.
 *
 * Stripe events carry an authoritative `livemode` of their own; the webhook
 * uses that. This is for the captures Stripe knows nothing about — signed LOIs
 * — where "are we live yet" is the only signal there is. Not perfect, but it
 * moves with the keys, and nothing has to be remembered.
 *
 * Server-only: it reads a secret. Never import into a client component.
 */
export function isLiveMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live");
}
