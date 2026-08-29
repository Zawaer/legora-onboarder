#!/usr/bin/env bash
#
# One-command deploy to Vercel.
#
#   npx vercel login      # do this once, yourself — it needs a browser
#   ./scripts/deploy.sh
#
# Solves the chicken-and-egg that makes this fiddly by hand: NEXT_PUBLIC_SITE_URL
# has to point at the deployment, but you don't know the URL until you've
# deployed. Vercel inlines NEXT_PUBLIC_* at build time, so setting it afterwards
# does nothing without a rebuild — which is exactly the trap that leaves the QR
# code on /pay pointing at localhost on a deployed site.
#
# So: deploy once to learn the URL, push every env var, then deploy again.
# The second build is the one that counts.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "No .env.local — nothing to push. Aborting."; exit 1
fi

if ! npx --yes vercel@latest whoami >/dev/null 2>&1; then
  echo
  echo "Not logged in to Vercel. Run this yourself first (it opens a browser):"
  echo
  echo "    npx vercel login"
  echo
  exit 1
fi

# Everything the app actually reads. SLACK_* is deliberately absent: the bot is
# a separate long-running process and does not run on Vercel.
VARS=(
  ANTHROPIC_API_KEY
  STRIPE_SECRET_KEY
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRICE_PRO
  STRIPE_PRICE_ONCE
  ELEVENLABS_API_KEY
  ELEVENLABS_VOICE_ID
  ELEVENLABS_MODEL_ID
  ELEVENLABS_STT_MODEL_ID
)

# Reads a key out of .env.local without echoing the value anywhere.
value_of() {
  sed -n "s/^$1=//p" .env.local | head -1
}

push_var() {
  local key="$1" val="$2"
  [ -z "$val" ] && return 0
  # `vercel env rm` is not idempotent and errors when the var is absent, so
  # swallow it; the add is what matters.
  npx --yes vercel@latest env rm "$key" production --yes >/dev/null 2>&1 || true
  printf '%s' "$val" | npx --yes vercel@latest env add "$key" production >/dev/null 2>&1
  echo "  set $key"
}

echo "==> Linking project (creates it on first run)"
npx --yes vercel@latest link --yes >/dev/null

echo "==> First deploy, to learn the URL"
URL="$(npx --yes vercel@latest deploy --prod --yes 2>/dev/null | tail -1)"
if [ -z "$URL" ]; then echo "Deploy produced no URL. Aborting."; exit 1; fi
echo "  $URL"

echo "==> Pushing environment"
for key in "${VARS[@]}"; do push_var "$key" "$(value_of "$key")"; done
push_var NEXT_PUBLIC_SITE_URL "$URL"

echo "==> Rebuilding so NEXT_PUBLIC_* is inlined with the real URL"
FINAL="$(npx --yes vercel@latest deploy --prod --yes 2>/dev/null | tail -1)"

echo
echo "Live: ${FINAL:-$URL}"
echo
echo "Two things this script cannot do for you:"
echo
echo "  1. Stripe webhook — add an endpoint at ${FINAL:-$URL}/api/stripe/webhook"
echo "     for checkout.session.completed, customer.subscription.updated and"
echo "     .deleted, then put the signing secret in STRIPE_WEBHOOK_SECRET and"
echo "     re-run this. Without it, payments succeed in Stripe but never reach"
echo "     /pitch, so your own evidence board under-reports your traction."
echo
echo "  2. Live Stripe keys. You are on test keys, so any payment scores zero."
echo "     Swap them, RE-RUN scripts/stripe-setup.mjs (prices are mode-specific,"
echo "     and a test price id does not exist in live mode), then re-run this."
echo
echo "Then open ${FINAL:-$URL}/pay on a phone and check the QR resolves."
