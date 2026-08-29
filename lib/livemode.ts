/**
 * Is this a real capture, or someone testing?
 *
 * It used to derive from the Stripe key: `sk_live` meant we were taking real
 * money, which was a decent proxy for "this signature is real" back when there
 * was a checkout. Stripe was removed, so that check now returns false for
 * everything — and a letter of intent signed by a real COO on the live site
 * was being labelled "test mode — does not count as traction". Mislabelling
 * real traction as fake is a worse failure than the one the flag was guarding
 * against, and it is the one that was actually happening.
 *
 * The honest signal now is where the capture happened. Signed against the
 * production deployment: real. Signed on a laptop or a preview build while
 * someone was checking the form worked: not. Vercel sets VERCEL_ENV itself, so
 * there is still nothing to remember to flip.
 *
 * Server-only.
 */
export function isLiveMode(): boolean {
  return process.env.VERCEL_ENV === "production";
}
