# Onboarder

**Onboards new hires into roles that have never existed before.**

Built at the SYE Hackathon, Stockholm, 28–30 August 2026.

---

## The problem, and how we found it

We went out onto the street to ask people what was actually broken at their
work. The first two people we spoke to worked at [Legora](https://legora.com) —
the Stockholm legal-AI company that went from $3M to $150M ARR in eighteen
months and is going from 700 to 1,500 employees this year.

They told us three things, in this order:

1. **They hire tens of people a week.** (We checked: ~800 hires in four months
   is roughly 50 a week. They onboarded ~97 people in a single cohort.)
2. **Most of those roles have never existed at the company before.** There is no
   predecessor to shadow and no playbook to hand anyone.
3. **Nobody has time to look after new hires.** People have to be independent
   from day one.

Those three facts close every existing door:

| The obvious fix | Why it fails here |
| --- | --- |
| Write documentation | There is nothing to document yet — the role is being invented while they hire for it |
| Enterprise search (Glean, Sana) | Retrieval needs the answer to already exist, and needs the hire to know what to ask |
| Training platforms (Trainual) | Requires someone to have codified the role first |
| Assign a mentor | There is no spare senior person. That is the constraint |

Volume, no docs possible, no humans available. The only remaining thing that
scales is an agent. That is not a hackathon rationalisation — it is what is left
once you take the other three options off the table.

## What it does

1. **Derives the role.** Reads the company's actual Slack, docs and tickets and
   reconstructs what the job really is — because nobody wrote it down. Every
   claim is cited back to a specific message.
2. **Builds a two-day ramp.** Real first work with the context needed to do it,
   not a reading list. The customer hires for ownership; the plan respects that.
3. **Supervises.** The agent speaks first, checks in, and answers from company
   context so the hire doesn't burn a senior's afternoon — or sit stuck for four
   hours because they don't want to ask the same question twice.
4. **Escalates only when it must.** A human gets pinged when the corpus
   genuinely cannot resolve the blocker, with the right person named and an
   honest estimate of the minutes it will cost them.

That last point is the business: we are not selling documents, we are selling
back supervision capacity that does not exist.

## Two decisions worth defending

**Evidence is verified, never trusted.** `lib/agent/ground.ts` keeps only
citations whose quoted text actually appears in the cited artifact. A sibling
project of ours hit a case where a scraping tool returned ten fully-formed,
entirely invented records with a 200 status — silent, well-formed, and
completely fabricated. Showing a hiring manager invented quotes from their own
Slack is worse than showing them nothing, and they will catch it by opening
Slack. **This check never comes out to make a demo work.**

**The manager screen shows blockers, not scores.** No percentages, no rankings,
no productivity metrics — deliberately. The customer told us new hires need
ownership and independence. A tool that reads as surveillance gets killed by the
culture it is sold into, so it shows what is in someone's way and who can clear
it, and nothing about how "well" they are doing.

## The demo

Onboarding an ex-M&A lawyer into a **Legal Engineer** role at Legora — a job
title that did not exist in the legal industry three years ago, that Legora
effectively invented, and that they are now hiring across sixteen cities. There
is no course for it and no predecessor to shadow.

The seed corpus in `lib/seed/legora.ts` deliberately contains **no definition of
the role anywhere**. If a document defined it, the demo would prove nothing.

## Running it

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY and the Stripe keys
npm run dev
```

| Route | What it is |
| --- | --- |
| `/` | The thesis, and the button that runs a live derivation |
| `/hire/[id]` | The new hire's experience — derived role, ramp plan, agent chat |
| `/manager` | Blockers, and who can clear them |
| `/pay`, `/buy` | Checkout, including a QR route that skips every login wall |
| `/loi` | Letter of intent, signed on a phone in ninety seconds |

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind v4 · Claude Opus 5 via the
Anthropic SDK · Stripe · JSON file persistence (deliberately — see below)

No database. State lives in `data/*.json`. It demos identically to Postgres,
removes an entire category of failure at 3am, and is a twenty-minute swap if it
ever needs to be real. Speed was the binding constraint, not architecture.
