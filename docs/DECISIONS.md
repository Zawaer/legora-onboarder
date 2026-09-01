# Locked decisions — read this first

Single source of truth for this repo. Any Claude session, any teammate: read
this before doing anything. If a decision changes, change it *here*.

Written 29 August 2026, ~02:00.

**Live task state is in Linear**, team `STU`, project *Vanav*:
https://linear.app/stuhi-hackathon/project/onboarder-dc7eca946d57

Linear MCP is authorised, so any Claude session can read and update it. Linear
is the task state; this file is the reasoning behind it. Update the issue when
you finish something — the "Best build with Linear" prize is judged on whether
we actually ran the build on it, not on whether a board exists.

---

## 1. The product is Vanav

An agent that onboards new hires into roles that have **never existed before**
at the company. It derives the role from the company's real Slack/docs/tickets,
builds a two-day ramp of real work, answers from company context, and escalates
to a human only when it genuinely cannot unblock the person.

**Why we switched to this.** Third idea of the weekend. We found the problem by
asking strangers on the street; the first two worked at Legora and described it
unprompted. Traction is 18 of 50 points and the warmest lead we have is the
buyer for this product, not for the previous one.

**Known risk, stated plainly:** the traction path runs through one person
replying to a LinkedIn message on a Saturday. Backup design partners get
messaged at 09:00 regardless of whether Legora replies. Contacts and what each
one is blocked on: `docs/contacts.md`.

> **Amended 2 September 2026 — see §11.** The product description above still
> holds. The *market* framing around hyper-growth does not: none of the four
> companies that actually signed are hyper-growth.

## 2. Fresh repo, deliberately

The previous repo (`sye-hackathon-2026/apps/web`) is an idea-agnostic selling
chassis and its own DECISIONS file says to build there. We chose a clean repo
anyway and **ported only what scores**: Stripe checkout, the `/buy` QR route,
`?source=` attribution, rate limiting, and LOI capture.

**Deliberately left behind:** Supabase auth, RLS, migrations, PostHog, shadcn/ui,
sonner. The demo needs no user accounts, and every one of those is
setup cost with no point value attached.

## 3. No database

State is JSON files in `data/`. It demos identically to Postgres, removes an
entire class of 3am failure, and is a twenty-minute swap if it ever has to be
real. Speed is the binding constraint this weekend, not architecture.

## 4. Evidence is verified, never trusted

`lib/agent/ground.ts` keeps only citations whose quoted text actually appears in
the cited artifact. Anything else is dropped.

A sibling project hit a real case where a scraper returned ten fully-formed,
entirely invented records with a 200 status — silent, well-formed, fabricated.
Showing a hiring manager invented quotes from their own Slack is worse than
showing them nothing, and they will catch it by opening Slack.

**Never remove this check to make a demo work.**

## 5. The manager screen shows blockers, never scores

No percentages, no rankings, no productivity metrics. The customer told us new
hires need ownership and independence; a tool that reads as surveillance gets
killed by the culture it is sold into. This is a product decision, not an
oversight — the manager screen says so out loud, which is also the right thing
for a judge to read.

## 6. The seed corpus contains no definition of the role

`lib/seed/legora.ts` deliberately includes no job description and no onboarding
doc for Legal Engineer. If a document defined the role, the derivation would
prove nothing. Keep it that way.

## 6b. OPEN — personality profiling (Viia's proposal). Team decides.

Proposal: Big Five test at the start, reports to management after a period,
team-composition suggestions from member strengths.

**Recommendation: don't, and here is why — but this is a team call, not a
locked decision.**

1. It inverts our positioning. The manager screen says, in writing, that it
   shows blockers and never scores, because a surveillance-shaped tool gets
   killed by the culture it is sold into. Psychometric profiles reported upward
   are the most surveillance-shaped feature available. We cannot argue both.
2. Joe is a People Enablement Partner. Personality testing tied to employee
   monitoring is a category HR professionals have strong, informed views on.
   It is a plausible way to lose our warmest lead.
3. EU legal exposure. Inferred personality data about employees runs into GDPR
   and employment-law questions we cannot resolve in a weekend, and a judge who
   knows that will ask.

**What the idea is actually reaching for is right**: adapt to the individual.
We can do that from observed behaviour in the work itself — what they ask,
where they stall, what they already know cold. Better signal than a
questionnaire, no consent regime, and consistent with everything else we say.

**Adopted from the same message:** the "they don't know what they don't know"
and "nobody left to absorb culture from" framings (now in `pitch.md`), delayed
error detection as a product gap, and the ElevenLabs voice briefing for
managers. **Deferred:** team-composition drafts — that is team design, a
different product, and it dilutes a sharp pitch.

## 7. Track: AI Agents. One only — the rules changed.

Decided Saturday ~11:50. We can no longer tick several tracks, so this is a real
choice. *(Hackathon-era; the scoring table lived in `docs/track.md`, deleted
2 September 2026 — recover from git history if ever needed.)*

**Why:** AI Agents weights us inversely to our weakness — the lowest traction
weight of any track (12 vs Outbuild's 18) and the highest problem-validation
weight (14). Traction is what we have none of with a day left; problem
validation is what we banked on Friday night and cannot lose.

Its 14-point band is a sentence we satisfy almost word for word: *"painful,
frequent and validated problem where an AI agent is clearly the right
solution."*

**Not Wildcard**, despite the higher ceiling — its 50 rests on one subjective
20-point originality call, and a serious B2B tool loses that to something
genuinely strange. **Not Outbuild**, which puts 36% of the score on the thing we
are worst at. **Not Edtech**, which wants student or teacher validation we do
not have.

**The afternoon target changes accordingly:** 8 of 12 traction points needs
*"multiple pilots"*, not payments. One payment and two pilot agreements, not
three paying customers.

## 8. Facts that survive a judge Googling them

All verified 29 August 2026:

- Legora: ~$3M ARR end-2024 → ~$50M end-2025 → ~$150M June 2026; 40 → 400 people
  in a year; 700 → 1,500 planned by end of 2026; $600M Series D at $5.6B
  (Accel-led); reportedly in talks at ~$10B; ~1,500 legal teams as customers.
- Workday acquired Sana (Swedish) for roughly $1.1bn — **double-check the exact
  figure before saying it on stage.**
- Y Combinator is an investor in Legora.
- Competitors split three ways: HR/provisioning (Rippling, BambooHR, Deel,
  Leena), retrieval (Glean, Sana, Moveworks, Copilot), and training docs
  (Trainual, Continu). **Every one of them takes the role as an input.**
  Kept current, with the buyer-overlap test and the weekly review rule, in
  **`docs/competitors.md`** — file new ones there instead of debating them.

**Do not use in the pitch:** "fastest growing enterprise company in history" —
say the numbers instead. Proactive escalation as a novelty — Moveworks already
advertises it; our version is about the work, not task completion.

## 9. Hard deadline

Sunday 30 August, **10:00 sharp.** Last submission before the cutoff is judged.
Required: demo video (publicly viewable — test it in an incognito window),
public GitHub link, traction screenshots, written before/during/proof.

Faking traction, including a friend paying, is instant disqualification.

## 10. Model hosting — Bedrock, EU region

*Added 1 September 2026, after the hackathon.*

Claude runs through **Amazon Bedrock on an EU regional endpoint**, called
directly from our backend — no third-party AI gateway.

Two reasons, in order:

1. **It is the only EU data-residency path.** The first-party API's
   `inference_geo` accepts `us` or `global` only. Three of our four LOIs are
   blocked on data handling, so "inference runs in Frankfurt, guaranteed" is
   worth more than the 10% regional premium it costs.
2. The €10k AWS credits from Wojtek cover Bedrock usage, confirmed 1 September.

Full numbers, the caching argument, what we give up on Bedrock, and the open
compliance questions: **`docs/model-costs.md`**.


## 11. The market is documentation drift, not hyper-growth

*Decided 2 September 2026.*

**Not one of our four signed LOIs is a hyper-growth company.** Netprofile is a
comms agency, Fermion is pharma, Apukuski and Tonava do not hire at volume.
Measurlabs, who described the problem better than our own pitch did, does not
either. The market self-selected during the hackathon and it was not
Legora-shaped.

**This is a correction to the pitch, not a pivot.** The product does not change,
the problem does not change, the customers do not change — they were never
hyper-growth. Do not tell the LOI signers we have "pivoted"; it would alarm four
people for no reason and invite them to reopen a decision they have made.

**Starting from the extreme case was correct.** Legora described the problem more
vividly than anyone else could have, which is why we could build the right thing
in 36 hours. The only error was letting the example define the market.

### The qualifying condition

From `pricing.md`, and it was always the right line:

> companies whose org chart changes faster than their documentation can

A segment is real only if it excludes someone. This one excludes companies under
~10 people (everyone just talks), companies with stable roles and maintained
playbooks, and anyone hiring repeatedly into well-defined positions. What is
left — knowledge-work companies roughly 20–2000 people where roles shift and
documentation lags — is what every one of our LOIs looks like.

**Do not over-correct into "an onboarding tool for everyone."** That is the
category containing Rippling, BambooHR, Trainual and Beam, where we have no
wedge and no HR experience. Broaden the customer, not the product.

### What changes

- **Pitch:** lead with documentation drift, not hiring velocity.
- **Outreach:** stop hunting for the next Legora. Best prospects look like
  Measurlabs and Netprofile.
- **Compliance:** build for Netprofile and Fermion, not Legora's procurement
  (`security.md` §3).
- **Pricing:** hybrid, not pure per-hire (§12).

**What does not:** the product, the wedge, or Legora — kept as the origin story,
the sharpest demo, and the expansion market once we have pilots and a
certification.

**Held loosely.** This is four LOIs and zero completed pilots. Firm enough to fix
the pitch, loose enough that the pilots can refine it.

## 12. Pricing shape: platform fee plus per hire

*Decided 2 September 2026. Full reasoning in `pricing.md`.*

Pure per-hire pricing was designed for the Legora hypothesis. At the companies
that actually signed it collapses our revenue — a 30-person agency hiring five
people a year pays ~€1 750 against ~€5 300 for the subscription.

It is also wrong on the product: the brain runs continuously, ingesting and
flagging stale documents whether or not anyone was hired that month. Netprofile
signed specifically for that half, which has nothing to do with hire volume.

**Keep the monthly fee as the floor; add per-hire on top** so price scales with
value at companies that do hire heavily. Predictable revenue from a Netprofile,
upside from a Legora.

**Then ask all four which shape they prefer.** It is measurable data, and it is
an easy question people enjoy answering.

## 13. The "it's just an AI wrapper" objection

*Written 2 September 2026. The answer we need in one sentence.*

> Retrieval tools answer the questions a new hire knows to ask. We work out what
> they do not know yet and tell them before they ask — including which of your
> documents have quietly stopped being true.

**Do not argue that Claude cannot do this.** It can. Claude with a scheduler,
Slack access and a memory store does the proactive half, and any competent
engineer could build it in a couple of weeks. Arguing from capability is a wall
that is not there.

The differentiation was never technical:

- **Data in, kept fresh** — Slack ingestion respecting per-channel permissions,
  GitHub, tickets, per-tenant isolation, incremental re-indexing. Unglamorous,
  and most of the engineering.
- **Deciding what to push and when.** The real IP, and not a model problem. Push
  too much and people mute the bot, which is terminal — we lose the only channel
  we have. Push too little and we are invisible. That threshold gets tuned
  across many customers, which is the one thing a company building this
  internally cannot do: they only see themselves.
- **Push has a far higher accuracy bar than pull.** A chatbot that answers badly
  is ignored once; a bot that pings you with something wrong is muted forever.
  This is why most people who *could* build it ship a Q&A box instead.

**Consequence, stated plainly:** if the capability is freely available,
defensibility has to come from the accumulated per-customer brain and the
cross-company pattern in how documentation rots. Not from the model.

Being replaceable in principle and being replaced in practice are different, and
the distance between them is execution. Linear, Notion and Slack were all
buildable by a good team in a year.
