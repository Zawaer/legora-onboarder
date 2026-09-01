# Pricing — and how to defend it

**Live now:** 2 500 SEK one-off pilot · 4 900 SEK / month.

Set with `node scripts/stripe-setup.mjs`. Re-run it after switching to live
keys — prices are mode-specific and a test `price_...` does not exist in live
mode.

---

## What we fixed

Checkout was inherited from the previous pivot and showed **"Svara — 299 SEK"**,
the restaurant review agent. Anyone handed a phone would have seen the wrong
product at an SMB price. That is now the Vanav product at a B2B price.

## Why two prices

A one-off converts in a hallway; a subscription converts in a pitch. Neither is
the "real" price — the situation picks.

- **2 500 SEK pilot** is the number a hiring manager can authorise on a card
  without going near procurement. That is what actually closes when you have
  forty seconds of someone's attention in a room.
- **4 900 SEK / month** is the recurring number, which is what a judge and an
  investor are actually scoring.

## The ROI argument (say this when asked)

> A new hire at a company like Legora costs roughly €460 a day fully loaded.
> Cutting ramp from two weeks to two days saves about eight days — call it
> €3,700 per hire — before you count the senior engineer's afternoon we stop
> them burning. A 2 500 kr pilot is a ten-times return on one hire. They hire
> ten to forty a month, every month.

That is the whole pricing conversation. Do not get drawn into per-seat
haggling; move to the per-hire frame, because it is the one where our number
looks small.

## Why not price like everyone else

| Competitor | Model | Why it's the wrong shape for us |
| --- | --- | --- |
| Enboarder | ~$4–8 per **employee** per month | Charges for the 1,400 people who already work there and don't need us |
| Trainual | $99–249 / month flat | Flat fee ignores that our cost and value both scale with hires |
| Rippling / BambooHR | $8–25 per employee / month | HR admin per headcount — a different product to a different buyer |

They all price against **headcount**. Our value scales with **hires**, which is
the number that is exploding at our customers. Same logic as why our market
isn't "companies that onboard people" — it's companies whose org chart changes
faster than their documentation can.

## The long-term model: platform fee plus per hire

*Revised 2 September 2026. This section previously said the long-term model was
almost certainly per hire onboarded (~€200–500). That was written under the
hyper-growth hypothesis, and it does not survive the customers we actually
signed — see `DECISIONS.md` §11.*

**Per-hire pricing is not one-off revenue.** It is usage-based recurring, the
same category as Stripe per transaction. If the customer keeps hiring, the
revenue keeps coming.

**But pure per-hire is the wrong shape for our customers.** €350 a hire makes
sense at fifty hires a week. None of our four LOIs hire at volume:

| | Per-hire (€350) | Subscription (4 900 SEK/mo) |
| --- | --- | --- |
| Netprofile-sized: 5 hires/yr | ~€1 750/yr | ~€5 300/yr |
| Legora-sized: 500 hires/yr | ~€175 000/yr | ~€5 300/yr |

Per-hire alone would cut revenue by roughly two thirds at the companies that
actually signed.

**And it is wrong on the product.** The brain runs continuously — ingesting,
staying current, flagging documents that have rotted — whether or not anyone was
hired that month. Netprofile signed specifically for that half. Pure per-hire
gives it away free and stops billing during a hiring freeze while we keep
serving them.

**So: keep the monthly fee as the floor and add per hire on top.** Not a
rewrite — a component above the existing 4 900 SEK/month, not a replacement for
it. Predictable revenue from a Netprofile, upside from a Legora. Usage revenue
is also lumpy on its own; a floor is what makes a hiring freeze survivable.

Gross margin supports either: inference costs roughly €10–30 for an entire pilot
(`model-costs.md` §5).

**Ask all four which they prefer.** *"Would you rather pay a flat monthly fee, or
per person onboarded?"* alongside *"what does onboarding one person cost you
today, in hours of other people's time?"* That is the measurable data we do not
have.

## Before you sell anything for real

1. Swap to live Stripe keys.
2. **Re-run `node scripts/stripe-setup.mjs`** — it detects the mode from the key
   and prints the new live price ids.
3. Paste those into `.env.local` (and into Vercel's env vars) and restart.
4. Take one real payment yourself with a real card and refund it, to prove the
   whole path works before a customer is watching.

`isLiveMode()` derives from the key prefix, and the webhook trusts Stripe's own
`livemode` flag, so a test payment can never be silently counted as traction —
but it also means test payments score **zero**. Live keys are not optional if
you want the points.
