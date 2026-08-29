# Saturday morning — read this first

Written overnight, ~02:15. Everything below is committed and pushed to
https://github.com/Zawaer/legora-onboarder

---

## Outreach status

**Sent — awaiting replies:**

- **Joseph Cassidy** (People Enablement Partner, Legora) — sent ~00:15. `STU-22`
- **Aino Bergius** (Head of Nordics, Lovable) — sent Saturday morning. `STU-40`
  She publicly wrote she is hiring *"people who don't need a playbook"*, which is
  our problem statement in her own words. Lovable went 80 → 250+ people in six
  months and she is personally hiring into undefined roles this month.

**When either replies, three things matter:**

1. **Get their WhatsApp number.** LinkedIn is a dead channel on a weekend and
   the deadline is 10:00 Sunday.
2. **Ask the diagnostic question:** *"Of the roles you hired for this year, how
   many had never existed at the company before?"* If both say "most of them",
   that is the market validated by two people at two different hypergrowth
   companies, and it goes straight on a slide.
3. **On the call the ask is a paid pilot**, not an LOI. LOI is the fallback —
   lead with it and a possible customer becomes a definite non-customer.

**Don't mention Joe or Legora to Aino.** Joe's Lovable stint is public on his
profile so it's tempting; it is still not ours to spend.

## Do these three things now

**1. Keep the outreach going.** (`STU-25`, ~20 min)
Two sent is not enough — 3+ paying customers is the top traction band, and both
current leads are people who may simply not open LinkedIn today. Founders House
and the room itself are next.

**2. Deploy.** (`STU-21`, ~10 min, `docs/deploy.md`)
`NEXT_PUBLIC_SITE_URL` is still `localhost`, so **the QR code on `/pay` is dead**
— scanning it on a customer's phone does nothing. Until this is fixed you cannot
take money from anyone standing in front of you.

**3. Post on LinkedIn.** (`STU-24`, ~40 min)
20 rubric points plus up to 4 500 kr across two separate marketing prizes.
Judged on real distribution, so morning beats evening. The street story is a
genuinely good post regardless of the prize.

None of these are engineering. All three are worth more points than any feature.
Aino has 19,850 followers and Joe has 13,115 — if either engages with a post,
that is distribution you cannot buy.

---

## What got built overnight

| | |
| --- | --- |
| Role derivation + grounding | ✅ verified live, 9/9 citations |
| Two-day ramp + supervision + escalation | ✅ verified live |
| **Drift detection** (Viia's idea) | ✅ 9 negatives, 0 false positives |
| **Ingest real company data** | ✅ verified on a real Slack export |
| **ElevenLabs voice briefing** | ✅ real audio, 664KB MP3 in 2.7s |
| **Voice input (Scribe STT)** | ⚠️ server verified, mic never clicked |
| **Slack bot** | ⚠️ 38 local assertions, never contacted Slack |
| Payments, QR, LOI capture | ✅ verified end to end |
| `/pitch` traction board | ✅ live/test money separated |

## Three things need one manual test before you demo them

These are built and I could not verify them headlessly. **Do not discover these
live.**

1. **Slack** (`STU-37`, ~10 min) — create the app, run `/onboard` once. The first
   real command is the first execution of the handshake, scopes and block
   payloads. Click-path in `docs/slack.md`.
2. **The microphone** (`STU-39`, ~1 min) — click it once in a real browser.
   `getUserMedia` has never run.
3. **Press play on `/manager`** (~1 min) — the audio generates correctly server
   side, but browser playback of the blob URL is untested.
4. **Open `/hire/[id]` and look at the chat** (~1 min) — the agent writes light
   markdown and both surfaces were printing it raw, so the opening brief showed
   literal `**asterisks**` around the first task. Now rendered properly, but the
   chat is client-side so I could only verify it typechecks and is bundled, not
   that it looks right.

## What overnight QA caught that would have gone live

Worth knowing, because each one only shows up in front of an audience:

- **The Slack DM was unusable.** Setup never enabled the App Home Messages tab,
  so the hire physically could not type. And the failure is silent — no event is
  generated at all, so every scope check passes and debug logging prints
  nothing. Both DM turns of the demo run through that composer.
- **The no-scoring rule was not actually enforced on the voice path.** It held in
  the drift detector but the briefing composer had it only in a comment. Four
  vectors got scoring language into spoken audio — the worst possible surface,
  since a briefing gets played on a speaker with other people in the room.
- **Duplicate artifact ids silently broke grounding.** Two channels whose names
  collapse to the same slug both got `-001`, so a *correct* quote from the first
  one failed verification and was dropped as fabricated — degrading exactly the
  proof the product sells.
- **Every uncached derivation would have died on Vercel.** `maxDuration` was 60
  against a 140-186 second job, and `next dev` does not enforce it, so it passes
  every rehearsal and fails only on the deployed URL.
- **A corpus with no author names** was accepted, offered for derivation, and
  then crashed three minutes and ~$2 in. Now refused at the door.
- **The Slack thinking-indicator could permanently overwrite the answer** — the
  ticker and the reply both edit the same message and Slack applies whichever
  lands last.

## Money

- Anthropic: roughly **$15–25** spent overnight across derivations, chat turns
  and testing. Each cold derivation is ~$1–2; the demo path is cached and free.
- **Rotate the Anthropic key if you haven't** — I printed one in full earlier
  through a redaction bug of mine.
- Stripe is still on **test keys**, so any payment scores zero. `STU-23` has the
  swap, and it must be paired with re-running `scripts/stripe-setup.mjs`
  because prices are mode-specific.

## Two demo moments worth building the pitch around

**The drift catch.** The hire says they'll fix the Italian miss with a keyword
list. Unprompted, the agent produces the message where that was already ruled
out:

> *"NOT shipping: a keyword list. If anyone adds 'cessione' to a keyword list I
> will find you."* — Marta Nowak, 19 Aug

Nobody asked it to check. That is the answer to "is this actually an agent?"

**The voice briefing closing line.** *"…Johan can clear it in five minutes.
… Nothing else needs you."* The product promise in four words.

## Honesty rules — non-negotiable

- The corpus is **synthetic**. Never imply it read Legora's real Slack. The seed
  file is in the repo and judges will see it. The argument does not need it.
- Say the numbers, not "fastest growing company in history".
- Ask the Legora contacts before naming them on a slide.
- Test payments are not traction, and the `/pitch` board enforces that.

## Where everything is

`docs/pitch.md` (3-min script + the "isn't this Glean?" answer word-for-word) ·
`docs/judges.md` (who asks what) · `docs/jd-comparison.md` (their real job ad vs
what the agent derived) · `docs/traction.md` · `docs/pricing.md` ·
`docs/demo-video.md` · `docs/submission.md` (pre-drafted, gaps marked) ·
`docs/deploy.md` · `docs/slack.md` · `docs/DECISIONS.md`

Live task state: https://linear.app/stuhi-hackathon/project/onboarder-dc7eca946d57
