# VANAV

**Onboards people into roles that have never existed at a company before.**

It reads a company's own Slack, docs and tickets, works out what the job
actually is, and hands the new hire a two-day plan of real work on day one.
It runs as a Slack agent, where they already are.

Live at **[vanav.io](https://vanav.io)**. Built at the SYE Hackathon,
Stockholm, 28–30 August 2026.

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
   quote it shows you is verified against the source message first.
2. **States what it could not see.** Before the derivation, not after it: how
   many artifacts, from whom, over what dates, and which parts of a working life
   an export structurally cannot contain.
3. **Builds a two-day ramp.** Real first work with the context needed to do it,
   not a reading list. The customer hires for ownership; the plan respects that.
4. **Supervises.** The agent speaks first, checks in, and answers from company
   context so the hire doesn't burn a senior's afternoon — or sit stuck for four
   hours because they don't want to ask the same question twice.
5. **Escalates only when it must**, with the right person named and an honest
   estimate of the minutes it will cost them.
6. **Then writes the answer down.** Which is the part that compounds.

That last point is the business: we are not selling documents, we are selling
back supervision capacity that does not exist.

## Four decisions worth defending

**Evidence is verified, never trusted.** `lib/agent/ground.ts` keeps only
citations whose quoted text actually appears in the cited artifact, checked as a
literal substring after normalising nothing but case, whitespace and the
punctuation a model silently rewrites. An elision is allowed; a splice is not.
A sibling project of ours hit a case where a scraping tool returned ten
fully-formed, entirely invented records with a 200 status — silent, well-formed,
and completely fabricated. Showing a hiring manager invented quotes from their
own Slack is worse than showing them nothing, and they will catch it by opening
Slack. **This check never comes out to make a demo work.**

**Nothing scores a person.** No percentages, no completion rates, no rankings.
The customer told us new hires need ownership and independence. A tool that
reads as surveillance gets killed by the culture it is sold into, so the manager
screen shows what is in someone's way and who can clear it, and nothing about
how "well" they are doing. Where the product does have to choose one colleague
over another — who should be the buddy, who to ask about a specific thing — it
names both and quotes the reason, because "answered the last four questions
about the extraction pipeline" is checkable and "best match, 0.87" is not.

**Say what we cannot see.** Kossinets (2006) measured what missing actors do to
an inferred network: roughly 8% absent produces more than 10% structural error,
and assortativity can flip sign outright. A Slack export is missing far more
than 8% — every DM, huddle, meeting room and corridor conversation. So
`lib/agent/coverage.ts` states the sample first, unprompted, and refuses to
invent a denominator: it will tell you what share of *the corpus* one person
wrote, and it will not tell you what share of *their communication* we can see,
because that number is unknowable and inventing it is the exact failure the
feature exists to prevent.

**Never present cached work as live.** A cold derivation is two Opus calls over
the whole corpus — two to three minutes, a dollar or two. Repeating it for an
unchanged corpus is not work, it is waiting, so the result is cached on disk and
the response says which path it took (`cached`, `derivedAt`). A spinner over a
disk read is a lie with a progress bar.

## The loop, which is the actual argument

Answering from a corpus is retrieval with better manners. What makes this an
agent is what happens when the corpus is silent.

The honest thing to do when nobody wrote the answer down is to say so and raise
a human. That is correct, and it is inert: the manager unblocks one person in a
DM and the next hire walks into the identical wall six weeks later. Every
escalation is a fact the company knows and cannot retrieve.

So instead: the agent works out who would actually know — ranked from evidence
of them doing the work, not from job titles — and sends them **one** question at
`/expert`. The question is anchored to a specific past incident rather than
asking for a process, because experts have poor introspective access to their
own cues and a "how do you handle X" prompt returns the textbook, which is not
what is missing. (The probes are the ACTA Knowledge Audit categories; the
highest-yield one is "what mistake would someone new make here?")

Then the agent writes its understanding back to them, and only the version they
confirm enters the corpus — attributed, dated, and citable like anything else.
The next hire gets it for free. That is the loop, and it is why the corpus at
the end of a month is not the corpus you uploaded.

## Two things it deliberately refuses to do

**It will not tell you what your role is and ask you to believe it.** A
synthesised role description is a confident paragraph with no way for the reader
to check it — and Jakesch et al. (CHI 2023, N=1,506) found that opinionated
model output makes readers roughly twice as likely to argue the model's position
afterwards, persisting past the task, with only about 20% noticing. So `/jd`
makes the falsifiable version of the claim: paste the job description **you**
wrote, and it breaks it into claims and shows you what your own traces say about
each one — supported, contradicted, or silent. Silence is a result, printed as
loudly as the rest. A derivation asks to be believed; a contradiction asks to be
checked, and checking it takes four seconds in Slack.

**It will not second-guess a new hire on thin evidence.** Drift detection
(`lib/agent/drift.ts`) catches the confident wrong turn — the thing somebody
does correctly-seemingly and wrong for two weeks because a manager with fifty
reports never looked. It is tuned to miss things, on purpose: a miss costs what
the product costs today, nothing, while one false "have you considered" lands on
a person three days into a job and kills the feature inside a week. Six gates
have to pass before a word reaches the hire, and it goes to the hire, never to
their manager. Information, not a verdict.

## The other surfaces

**The manager brief** (`/manager/brief`) is sent 48 hours before a start date,
because the highest-return onboarding intervention anyone has published is a
short note to the *manager*, not another portal for the hire. It needs a human
with a spare hour who notices a start date; a company hiring fifty people a week
does not have that human, so this composes one: who the buddy should be and why,
five people to meet with a specific reason each, the first real task with a
worked example beside it, and what the company still has not decided. It is
composed, not generated — no model call — and every line is quoted from the
corpus.

**Slack** (`npm run slack`) is Socket Mode, so it needs no public URL and no
tunnel; the transport is `scripts/slack-bot.mjs` and every decision about when
to speak lives in `lib/slack/app.ts` as pure functions you can test without a
workspace (`npm run slack:test`). Setup is in [docs/slack.md](docs/slack.md).
It has been verified locally (38 assertions, no network) but **not yet against a
live workspace**.

**Voice** exists because a new hire's most valuable questions do not happen at a
keyboard. They happen walking back from a meeting where three acronyms went
past, and by the time that person is sitting in front of a text box the question
has either evaporated or hardened into "I'll work it out myself". Speaking is
not a tax on asking; typing is. The transcript is never auto-sent — the first
live call transcribed "Legora" as "Ligora", and a tool teaching somebody a
company's vocabulary cannot mangle that company's name into the question it then
answers. The manager briefing runs the same stack in reverse, spoken.

## The demo

Onboarding an ex-M&A lawyer into a **Legal Engineer** role. It is a real job
title that did not exist in the legal industry three years ago, there is no
course for it, and there is no predecessor to shadow.

**The demo company, Lexhav, is invented.** Its people, its Slack, its documents
and its tickets were all written by us to mirror how a fast-growing legal-AI
company is structured. We have never had access to any real company's Slack,
and nothing in the demo is anyone's real data.

The seed corpus in `lib/seed/lexhav.ts` deliberately contains **no definition of
the role anywhere**. If a document defined it, the demo would prove nothing:
the point is that the role is derived from how people actually work, not
retrieved from a job description somebody already wrote.

## Running it

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY, Supabase and Slack keys
npm run dev
```

| Route | What it is |
| --- | --- |
| `/` | The thesis, and the button that runs a live derivation |
| `/ingest` | **Point it at your own company** — Slack export, pasted log, or CSV |
| `/hire/[id]` | The new hire's experience — derived role, ramp plan, agent chat, voice |
| `/jd` | Paste a job description; see which of its claims your traces support, contradict, or never mention |
| `/expert` | The one-question page a colleague opens. No account, works cold on a phone |
| `/manager` | Blockers, and who can clear them |
| `/manager/brief` | The note that goes out 48 hours before a start date |
| `/pitch` | Traction evidence. Not linked from the public nav |
| `/app` | The customer's admin: company profile, uploaded material, and the draft review queue where a human releases anything the agent wants to say |
| `/pricing` | Per hire, not per seat, with the ROI model shown rather than asserted |
| `/loi` | Letter of intent, signed on a phone in ninety seconds |

## It is not hardcoded for one company

`/ingest` takes a real Slack export (four shapes), NDJSON, a pasted chat log,
or CSV, detected by shape rather than extension, and derives a role from it.

We tested it on an invented company with a four-message corpus. It produced
four grounded citations and, more importantly, **refused to invent a job
description from thin data**:

> "…this is a Growth Engineer hired without a defined first mandate — the corpus
> is four messages from the week before their start date, and all four are about
> the fact that nobody has decided what they own."

An honest thin answer on thin evidence is the behaviour we want. The parser
never throws either: every per-record failure is caught, counted, and shown to
you as a warning, because a partial parse beats a 500 while a customer is
watching.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind v4 · Claude Opus 5 via the
Anthropic SDK · Slack Bolt (Socket Mode) · Supabase Postgres, Stockholm region ·
Linkup for the web rung · ElevenLabs for speech

Two stores, and the split is worth stating plainly because it is also the one
real gap.

Companies, members, the draft review queue, uploaded materials and signed
letters of intent live in **Supabase Postgres**, hosted in Stockholm, with
row-level security on every table. Both signed customers named data residency
before they named a feature, so that was not a detail to leave until later.

The **hire store is still `data/*.json`**, with committed fixtures under
`lib/seed/` so the deployed site has something to show. That is why the live
demo runs from a laptop rather than production: a serverless filesystem is
read-only, so the deployed app serves the bundled corpus instead of a live
workspace. Moving it to the Postgres we already run is the next change, and it
is the honest answer to "where does this actually run".
