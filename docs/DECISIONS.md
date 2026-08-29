# Locked decisions — read this first

Single source of truth for this repo. Any Claude session, any teammate: read
this before doing anything. If a decision changes, change it *here*.

Written 29 August 2026, ~02:00.

**Live task state is in Linear**, team `STU`, project *Onboarder*:
https://linear.app/stuhi-hackathon/project/onboarder-dc7eca946d57

Linear MCP is authorised, so any Claude session can read and update it. Linear
is the task state; this file is the reasoning behind it. Update the issue when
you finish something — the "Best build with Linear" prize is judged on whether
we actually ran the build on it, not on whether a board exists.

---

## 1. The product is Onboarder

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
messaged at 09:00 regardless of whether Legora replies. See `docs/traction.md`.

## 2. Fresh repo, deliberately

The previous repo (`sye-hackathon-2026/apps/web`) is an idea-agnostic selling
chassis and its own DECISIONS file says to build there. We chose a clean repo
anyway and **ported only what scores**: Stripe checkout, the `/buy` QR route,
`?source=` attribution, rate limiting, and LOI capture.

**Deliberately left behind:** Supabase auth, RLS, migrations, PostHog, shadcn/ui,
sonner. The Legora demo needs no user accounts, and every one of those is
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

## 7. Tracks: Outbuild, AI Agents, Wildcard, Edtech B2C

Ticking more can only help — each track is scored on its own weighting. Outbuild
carries the points. AI Agents is why the derivation must be genuine rather than
a template. Edtech B2C is a stretch but free to tick.

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

**Do not use in the pitch:** "fastest growing enterprise company in history" —
say the numbers instead. Proactive escalation as a novelty — Moveworks already
advertises it; our version is about the work, not task completion.

## 9. Hard deadline

Sunday 30 August, **10:00 sharp.** Last submission before the cutoff is judged.
Required: demo video (publicly viewable — test it in an incognito window),
public GitHub link, traction screenshots, written before/during/proof.

Faking traction, including a friend paying, is instant disqualification.
