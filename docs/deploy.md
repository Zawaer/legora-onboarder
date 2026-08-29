# Deploy — do this before you try to sell anything

**Blocking issue right now:** `NEXT_PUBLIC_SITE_URL` is `http://localhost:3000`,
so the QR code on `/pay` encodes localhost. Scanning it on a customer's phone
does nothing. `/pay` shows a warning when this is the case, but the fix is
below and takes five minutes.

Without a public URL you cannot take money from someone standing in front of
you, and that is the whole traction mechanism.

---

## 1. Deploy (5 min)

```bash
npm i -g vercel
vercel login
vercel --prod
```

Root directory is the repo root — unlike the old repo, this is not a monorepo,
so no Root Directory override is needed.

## 2. Environment variables in Vercel

Set all of these in the Vercel dashboard (Project → Settings → Environment
Variables), then **redeploy** — Next inlines `NEXT_PUBLIC_*` at build time, so
changing them without a rebuild silently does nothing.

| Variable | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | your rotated key |
| `NEXT_PUBLIC_SITE_URL` | **the real Vercel URL**, no trailing slash |
| `STRIPE_SECRET_KEY` | live key when you're selling for real |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | matching mode |
| `STRIPE_WEBHOOK_SECRET` | from the webhook you create in step 3 |
| `STRIPE_PRICE_ONCE` / `STRIPE_PRICE_PRO` | **re-run `scripts/stripe-setup.mjs` in live mode** |

`NEXT_PUBLIC_SITE_URL` is the one people forget. It controls the QR target and
the Stripe success/cancel redirects.

## 3. Stripe webhook

In the Stripe dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://<your-vercel-url>/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.

Without this, payments succeed in Stripe but never reach `/pitch`, so your own
evidence board under-reports your traction.

## 4. Going live with money

1. Swap to `sk_live` keys.
2. **Re-run `node scripts/stripe-setup.mjs`** — prices are mode-specific and the
   test `price_...` ids do not exist in live mode. Skipping this fails checkout
   with "No such price" in front of a customer.
3. Paste the new live price ids into Vercel and redeploy.
4. **Test with your own real card and refund it.** Prove the whole path works
   before someone else is watching.

## Known limitation — read this

`data/*.json` is per-instance and ephemeral on Vercel serverless. Consequences:

- **Payments are safe.** Stripe is the system of record and the webhook
  re-populates.
- **LOIs and derivation cache are not.** A cold start can wipe them.

Mitigations already in place: every signed LOI is written to the logs as a
single `LOI_SIGNED {...}` line (recover with `vercel logs | grep LOI_SIGNED`),
and the signed artefact renders client-side so the screenshot always works.

**So: screenshot every LOI the moment it is signed.** That screenshot is the
actual proof artefact for the submission, not the database row.

If you want durability, the twenty-minute fix is to point `lib/store.ts` at the
Supabase project already provisioned in the old repo. Only worth doing if you
have spare time on Saturday — the screenshots are what get scored.

## Cost guard

`/api/derive` costs roughly $1–2 per cold run and takes ~3 minutes. Once you
post a public link, strangers can click it.

The route is rate-limited and results are cached per company+role, so the
common path is free. But before you push the URL to LinkedIn, either warm the
cache for the demo role or accept that a cold call is a real charge.
