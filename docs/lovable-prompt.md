# Lovable prompt — UI bake-off

Paste everything below the line into Lovable. It builds the same screens as our
app with static data, so the comparison is like-for-like: visual design only,
no agent, no API.

---

Build a marketing site plus product UI for **Onboarder**, a B2B SaaS product.
Use static data throughout — no backend, no auth, no API calls. This is a
visual build.

## What the product is

Onboarder onboards new hires into roles that have **never existed before** at a
company. At companies hiring 50 people a week, most new roles have no
predecessor, no playbook and no documentation. So the role can't be looked up —
it has to be *derived* from the company's real Slack messages, docs and tickets.

The product then builds the new hire a two-day plan of real work, answers their
questions from company context, and escalates to a human manager only when it
genuinely can't help.

## The argument the landing page must make

Three facts, in this order, each closing a door:

1. Hypergrowth companies hire faster than they can document. One went from 700
   to 1,500 people in a year — roughly 50 hires a week.
2. Most of those roles have never existed at the company before, so there is no
   playbook to hand anyone.
3. Nobody has time to supervise, so the new hire must be independent from day one.

Then the conclusion: **documentation can't fix it** (the role is being invented
while they hire for it), **search can't fix it** (retrieval needs the answer to
already exist, and the new hire doesn't know what to ask), **a mentor can't fix
it** (the absence of a spare senior person is the whole constraint). The only
thing left that scales is an agent.

## Visual direction

This is the important part. Aim for the restraint of Linear, Stripe or Vercel —
a serious B2B tool someone pays for.

- **Avoid the AI-startup cliché completely**: no purple-to-blue gradients, no
  glowing orbs, no glassmorphism, no floating 3D shapes, no "âœ¨" emoji.
- Near-monochrome palette: an off-white paper, near-black ink, two or three
  greys, and exactly **one** accent colour used sparingly. Add one amber for
  "needs a human" and one green for "handled" — nothing else.
- Typography does the work. Generous line height (1.6), a real type scale,
  comfortable measure (~65 characters). Tight, confident headings.
- Hairline borders (1px) and lots of whitespace instead of heavy shadows.
- Full light and dark mode via `prefers-color-scheme`, both deliberately
  designed rather than an inverted afterthought.
- Fully responsive; nothing may cause horizontal page scroll. Long quotes and
  tables scroll inside their own container.

## Screen 1 — Landing page

- Hero with the headline **"Onboarding for a job that has never existed."** and a
  subhead explaining the derivation in one sentence. Primary CTA "See it derive a
  role", secondary "How it works".
- The three facts as a bordered three-up: **700 → 1,500** (people this year),
  **0** (playbooks for the role), **Day 1** (when they need to be useful).
- The "documentation can't → search can't → a mentor can't → so we built the
  agent" progression as a clean visual sequence.
- A four-step "how it works": derives the role, builds a two-day ramp,
  supervises, escalates only when it must.
- A section titled **"What it deliberately refuses to do"** covering: it never
  scores or rates a person, it drops any citation it can't verify word-for-word
  in the source, and it stays silent rather than guessing.
- Pricing: **2 500 kr** one-off pilot, **4 900 kr / month** team plan.
- Footer.

## Screen 2 — `/hire` — the new hire's view

Two columns on desktop, stacked on mobile. Header shows "Rebecca Hartley ·
Legal Engineer · Day 1".

**Left column — the derived role.** This is the money shot.

- Summary paragraph, styled as the centrepiece:
  > At Legora a Legal Engineer is an ex-practitioner who is the only person who
  > can say what the right answer to a contract question is — and is therefore
  > the binding constraint on extraction quality, escalations and eval labelling.
- **Evidence citations, visually prominent — not a footnote.** These are the
  proof the role wasn't invented. Each is an accent-ruled quote card showing the
  verbatim quote, the channel, the author, their role, and the date. Use these:
  - `#legal-eng · Elin Sandberg · 27 Aug` — "i have three people starting monday
    and i have written exactly nothing for any of them"
  - `#legal-eng · Johan Lindqvist · 22 Aug` — "we keep losing a day per deal
    turning the lawyer's review notes into something the model can actually use"
  - `ticket LE-2231 · Anders Falk · 27 Aug` — "holding this for the joiner
    starting 1 Sept. It is a real client deliverable with a real date"
- Responsibilities and first-week outcomes as lists.
- **"What the company hasn't settled yet"** in a distinct amber block — these are
  things the agent honestly could not determine:
  - Who owns the client escalation conversation, Anders or Elin
  - Who owns the playbook library
  - How much code this role actually writes

**Right column — the plan and the chat.**

- Day 1 / Day 2 tabs. Each task is an expandable card with title, why it
  matters, the context needed, "done when", and who to ask if stuck. First task:
  *"Write the list of every place we are wrong on three Nordkap SPAs"* — 90 min,
  ask Johan Lindqvist.
- A chat that looks like a real messaging surface. Agent messages visually
  distinct from the hire's. Include this exchange:
  - **Agent:** an opening message assigning the first task with context
  - **Hire:** "I'm going to fix the Ardent Italian miss by adding cessione del
    contratto and a few other Italian synonyms to the assignment playbook
    keyword list."
  - **Agent:** a "Worth knowing before you go further" block containing a
    blockquote citation — *"NOT shipping: a keyword list. If anyone adds
    'cessione' to a keyword list I will find you." — Marta Nowak, ESC board, 19
    Aug* — then a line explaining what the team does instead, closing with "Your
    call — you have the source, I'm not going to make it for you."
  - A microphone button in the composer alongside the text input.

## Screen 3 — `/manager` — the manager's view

- Prominent one-line explainer at the top: **"Blockers. Nothing else."** — this
  screen deliberately shows no productivity metrics, because the customer hires
  for ownership and a surveillance dashboard gets killed by the culture it's
  sold into.
- Hard visual separation between two groups:
  - **Needs a human** (amber): "Rebecca is blocked — the Nordkap
    change-of-control workspace isn't visible under the new SSO account. **Johan
    can clear it in 5 minutes.**"
  - **The agent handled it** (green): nine items, each one compact line.
- The only numbers on this page are counts of blockers and minutes of *your*
  time. No scores, no percentages, no rankings of people.
- An audio player card: "Your briefing · 45 sec", play button, and the
  transcript below it ending with the line **"Nothing else needs you."**

## Screen 4 — `/ingest` — point it at your own company

- Drop zone for a Slack export, plus a paste box, plus company name and role
  title fields.
- A results panel showing what it understood *before* anything expensive
  happens: 63 artifacts, 14 people, 4 channels, a date range, and any warnings.
- A separate, explicitly-priced "Derive the role" button noting it takes two to
  three minutes.

## Screen 5 — `/pitch` — traction evidence

- Headline stats: paying customers, revenue, signed LOIs.
- Revenue by channel as simple horizontal bars (room, LinkedIn, DM, QR).
- **An unmissable banner if any record is test-mode**, stating those records are
  excluded from every number above.
- Signed letters of intent as quotable cards with name, role, company, what they
  intend to do, and a timestamp.

## Rules

- Static demo data only. No backend, no auth.
- Every page must look finished with realistic content — no lorem ipsum, no
  empty states left unstyled.
- Accessible: real contrast, focus states, semantic headings.
- No component library that imposes its own look. Tailwind and hand-built
  components.
