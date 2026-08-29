# Submission form — everything it asks, pre-drafted

Deadline **Sunday 30 August, 10:00 sharp.** You can resubmit as many times as
you like; the last version before the cutoff is judged. Submit a rough version
early so a late crisis can't leave you with nothing in the box.

Fill the numbers in the `[[ ]]` gaps on Sunday morning. Everything else is done.

---

## 1. Project name
**Onboarder**

## 2. Team name and members
`[[ team name ]]` — `[[ full names of everyone ]]`

Every member must have submitted their own application to be eligible.

## 3. Tracks — tick all four
Outbuild · AI Agents · Wildcard · Edtech B2C

Each track is scored on its own weighting and ticking more can only help.

## 4. Demo video link
`[[ link ]]` — **open it in an incognito window before pasting.** A restricted
Drive link is the single most common way teams lose. See `demo-video.md`.

## 5. GitHub
https://github.com/Zawaer/legora-onboarder — public, judges open it.

## 6. Live product link
`[[ Vercel URL, or blank ]]`

## 7. Proof of traction — up to 8 images
Screenshots of payments, signed LOIs, and customer conversations. Capture these
**as they happen**, not on Sunday morning. `/pitch` renders the evidence board
for screenshotting.

---

## 8. "What you built, and your traction, in writing"

> ### What existed before the weekend
>
> Nothing. We arrived with no idea. We spent Friday evening trying to invent one
> from our own daily problems and produced two weak B2C concepts with tiny
> markets.
>
> So we went out onto the street in central Stockholm and asked strangers what
> was broken at their work. The first two people we spoke to worked at Legora.
>
> They told us three things, unprompted, in this order: they hire tens of people
> every week; most of those roles have never existed at the company before; and
> nobody has time to look after new hires, so people have to be independent from
> day one.
>
> We checked the numbers afterwards. Legora went from $3M to ~$150M ARR in
> eighteen months and is going from 700 to 1,500 people this year — roughly 50
> hires a week. They onboarded ~97 people in a single cohort.
>
> ### What we built during the weekend
>
> **Onboarder** — an agent that onboards new hires into roles that have never
> existed before.
>
> Those three facts close every existing door. You cannot write documentation,
> because the role is being invented while they hire for it. You cannot use
> enterprise search like Glean, because retrieval needs the answer to already
> exist and needs the new hire to know what to ask. You cannot assign a mentor,
> because the absence of a spare senior person is the whole constraint. Volume,
> no docs, no humans — the only thing left that scales is an agent.
>
> It does five things:
>
> 1. **Derives the role** from a company's real Slack, docs and tickets, because
>    nobody wrote it down. Every claim is cited back to a specific message.
> 2. **Builds a two-day ramp** of real first work with the context needed to do
>    it — not a reading list.
> 3. **Supervises**: speaks first, answers from company context, so the hire
>    doesn't burn a senior's afternoon or sit stuck in silence.
> 4. **Notices work going wrong before a human would.** The expensive failure at
>    fifty hires a week isn't the question someone asks — it's the wrong thing
>    they do confidently, without asking. A manager normally catches that by
>    reviewing work, which holds at five to eight reports and collapses at
>    fifty. When a hire states an approach the company has already ruled out,
>    the agent says so and shows the message where it was ruled out. Nobody
>    asked it to check.
> 5. **Escalates only when it must** — naming the right person and an honest
>    estimate of the minutes it will cost them.
>
> It runs on a company's own data (`/ingest` takes a Slack export, a pasted log
> or a CSV), in the browser or **in Slack**, and the manager can take the whole
> briefing as **60 seconds of audio** on their commute — because the buyer's
> defining constraint is that they have no time.
>
> Two decisions we'd defend to anyone:
>
> **Evidence is verified, never trusted.** `lib/agent/ground.ts` keeps only
> citations whose quoted text actually appears in the cited source; everything
> else is dropped. We adversarially tested it — fabricated quotes,
> real-quote-wrong-source, and stitched-together fragments are all rejected.
> Showing a hiring manager invented quotes from their own Slack is worse than
> showing them nothing, and they would catch it instantly.
>
> **The manager screen shows blockers, never scores.** No percentages, no
> rankings, no productivity metrics — deliberately. Our customer hires for
> ownership, and a tool that reads as surveillance gets killed by the culture
> it's sold into.
>
> On a realistic 63-artifact corpus for a Legal Engineer role — a job title
> Legora effectively invented and that did not exist in the legal industry three
> years ago — the agent produced 9 grounded citations, 8 genuinely unresolved
> open questions, and a two-day plan whose first task is a real client
> deliverable with a real deadline.
>
> The corpus is synthetic and contains no definition of the role anywhere. That
> constraint is the point: if a document defined it, the derivation would prove
> nothing.
>
> Two of the open questions it surfaced — how much code the role writes, and who
> owns the playbook library — are the exact two points Legora's own public job
> posting hedges on. It found the ambiguities the company could not resolve in
> its own job ad.
>
> ### Traction
>
> `[[ FILL SUNDAY — be specific with numbers ]]`
>
> - Paying customers: `[[ n ]]`, total `[[ amount ]]` SEK
> - Signed LOIs: `[[ n ]]`
> - Companies spoken to: `[[ n ]]`
> - The Legora conversation: `[[ what actually happened ]]`
>
> Everything above is real and built by our team this weekend.

---

## Do not

- Fake anything. A friend paying for our own product is **instant
  disqualification**, and so is a fabricated screenshot.
- Claim the agent read Legora's real Slack. It did not — the corpus is
  synthetic, the seed file is in the repo, and the argument doesn't need the
  overclaim. See `jd-comparison.md`.
- Submit at 09:59. Submit at 08:00 and improve it.
