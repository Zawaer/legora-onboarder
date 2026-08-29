/**
 * Creates the Vanav product and its two prices in Stripe, then prints the
 * env lines to paste into `.env.local`.
 *
 * Run it once per Stripe mode:
 *
 *   node scripts/stripe-setup.mjs          # uses STRIPE_SECRET_KEY from .env.local
 *
 * Why this exists: prices are mode-specific. A `price_...` created with a test
 * key does not exist in live mode, so flipping to live keys without re-running
 * this breaks checkout with "No such price" at the exact moment someone is
 * standing in front of you with a card out. This makes that a one-command fix
 * instead of a panic at 09:00 on Sunday.
 *
 * It is safe to re-run: it searches for an existing product with the same
 * name first and reuses it rather than creating duplicates.
 */

import fs from "node:fs";
import Stripe from "stripe";

// ── config ───────────────────────────────────────────────────────────────────

const PRODUCT_NAME = "Vanav";
const PRODUCT_DESCRIPTION =
  "Onboards new hires into roles that have never existed before.";

/**
 * Two prices, because the situation picks — not us.
 *
 * `once` is a pilot fee a hiring manager can authorise on a card without
 * involving procurement. That is what actually converts when you are stood
 * next to someone with forty seconds of their attention.
 *
 * `pro` is the recurring number, which is what a judge and an investor care
 * about. Both are real revenue; ship both.
 *
 * On the level: comparable tools price per employee of the whole company
 * (Enboarder ~$4-8/employee/month, Trainual $99-249/month flat). That shape is
 * wrong for us — our value scales with *hires*, not headcount. A new hire at a
 * company like our design partner costs roughly €460/day fully loaded, so
 * cutting ramp from two weeks to two days is worth about €3,700 per hire before
 * counting the senior's time we absorb. A 2 500 kr pilot is a ~10x ROI ask,
 * which is a comfortable conversation rather than a defensive one.
 */
const PRICES = [
  {
    envVar: "STRIPE_PRICE_ONCE",
    nickname: "Pilot — first cohort",
    unit_amount: 250000, // 2 500 SEK
    currency: "sek",
    recurring: null,
  },
  {
    envVar: "STRIPE_PRICE_PRO",
    nickname: "Team — monthly",
    unit_amount: 490000, // 4 900 SEK / month
    currency: "sek",
    recurring: { interval: "month" },
  },
];

// ── env ──────────────────────────────────────────────────────────────────────

/** Minimal .env.local reader — avoids a dotenv dependency for a one-off script. */
function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

loadEnvLocal();

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set (looked in env and .env.local).");
  process.exit(1);
}

const mode = key.startsWith("sk_live") ? "LIVE" : "TEST";
const stripe = new Stripe(key, { typescript: false });

// ── run ──────────────────────────────────────────────────────────────────────

console.log(`\nStripe mode: ${mode}\n`);

if (mode === "LIVE") {
  console.log(
    "  Creating LIVE prices. Real cards will be charged against these.\n",
  );
}

const existing = await stripe.products.search({
  query: `name:"${PRODUCT_NAME}" AND active:"true"`,
});

const product =
  existing.data[0] ??
  (await stripe.products.create({
    name: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
  }));

console.log(
  `${existing.data[0] ? "Reusing" : "Created"} product ${product.id} — "${product.name}"\n`,
);

const lines = [];

for (const spec of PRICES) {
  // Reuse an identical price if one already exists, so re-running doesn't
  // litter the dashboard with duplicates that all look the same.
  const found = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });

  const match = found.data.find(
    (p) =>
      p.unit_amount === spec.unit_amount &&
      p.currency === spec.currency &&
      (spec.recurring
        ? p.recurring?.interval === spec.recurring.interval
        : p.recurring === null),
  );

  const price =
    match ??
    (await stripe.prices.create({
      product: product.id,
      nickname: spec.nickname,
      unit_amount: spec.unit_amount,
      currency: spec.currency,
      ...(spec.recurring ? { recurring: spec.recurring } : {}),
    }));

  const human = `${spec.unit_amount / 100} ${spec.currency.toUpperCase()}${
    spec.recurring ? ` / ${spec.recurring.interval}` : " one-off"
  }`;

  console.log(`  ${match ? "reused " : "created"} ${spec.envVar}  ${human}`);
  lines.push(`${spec.envVar}=${price.id}`);
}

console.log(`\nPaste into .env.local:\n`);
console.log(lines.join("\n"));
console.log(
  `\nThen restart the dev server — Next reads .env.local only at startup.\n`,
);
