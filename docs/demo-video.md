# Demo video — shot list

**Required for submission. No video, no judging.**

Target: **90 seconds.** Judges watch a lot of these. Everything below is on
screen or it is cut.

The track is **AI Agents**, and the rubric rewards "this is an agent, not a
wrapper". So the middle of this video is not the role card — it is the two
moments where the agent *decides something*: which questions are worth a
person, and how two plans divide work between themselves. Those are the shots
a wrapper cannot produce.

---

## Before you hit record

- [ ] Open **https://vanav.io** — record production, not localhost. A judge who
      sees `localhost:3000` wonders whether anything is deployed.
- [ ] **Click "See how it works" once** to warm the cache. Cached is about a
      second; cold is three minutes and will not fit in the video.
- [ ] Tabs open and ready: `/`, `/hire/demo-legal-engineer`, `/manager`,
      `/pricing`.
- [ ] Browser zoom **125%**. Body text at default zoom is unreadable after
      upload compression.
- [ ] Quit Slack and mail. A notification banner mid-take reads as careless.
- [ ] Test the mic. Bad audio reads as low effort far more than bad video does.

## The shots

**0:00–0:12 — the problem, over the landing page**

> "We went out on the street on Friday and asked people what was broken at
> work. The first two we spoke to work at a legal-AI company here in Stockholm
> that has gone from forty people to four hundred in a year. Most of the roles
> they hire for have never existed at the company before, and nobody has time
> to look after anyone."

**0:12–0:24 — why nothing that exists works**

> "You can't write documentation, because the role is being invented while
> they hire for it. You can't search, because the answer isn't written down
> anywhere. And you can't assign a mentor, because there isn't a spare one.
> The only thing left that scales is an agent."

**0:24–0:44 — the derived role**

Scroll the role card, stop on the evidence citations.

> "Nobody wrote this. It read three weeks of their Slack, docs and tickets and
> worked out what the job is. Every claim points back at the message it came
> from — and every quote is checked as a literal substring of the source. If
> it isn't really there, we drop it rather than show it."

Stop on the open questions:

> "And where the company genuinely hasn't decided something, it says so
> instead of inventing an answer."

**0:44–1:06 — the two questions** *(the most important shot in the video)*

In the chat, paste these **in this order**. Both are verified on this corpus.

```
What's the difference between a git rebase and a git merge, and which should I use before opening a PR?
```

Comes back in a dashed grey card headed *"From the web · not from your team"*.

```
I can't see the Nordkap change-of-control workspace under my SSO login — the three SPAs won't open.
```

Routes to **Johan Lindqvist** by name.

> "Two questions, thirty seconds apart. The first one has nothing to do with
> this company, so it's answered from the web and nobody is interrupted. The
> second one only their team can answer — so it goes to one named person, with
> an honest estimate of how long it'll cost him. Deciding which of those a
> question is, is the agent."

**1:06–1:18 — two starters at once**

Open `/manager`, scroll to **"Where two ramps touch"**.

> "And when two people start the same week, the second plan is written around
> the first. Neither of them gets handed the same ticket, and the sentence
> saying so is in the new hire's own task, naming the person. That's two
> agents dividing work — no human arbitrated it."

**1:18–1:30 — blockers, and the close**

> "The manager sees blockers. Not scores, deliberately — they hire for
> ownership, and a surveillance dashboard gets killed by the culture it's sold
> into.
>
> We're not selling documents. We're selling back the supervision capacity
> that doesn't exist."

## Rules

- **Say the corpus is synthetic** if you show anything that could be mistaken
  for a real company's data. Lexhav is invented — the company, the fourteen
  people and every message. Never imply otherwise.
- **Do not name the people who talked to us** or their employer without asking
  them first. The story is true without the names, and one of them is mid-
  conversation with us.
- **No claimed revenue and no claimed LOIs.** There are none. If traction comes
  up: two target buyers replied to cold outreach and booked calls for next
  week. That is the whole claim and it is checkable.
- One take is fine. Fluency matters less than not overclaiming.

## After recording

- [ ] Watch it once at full size with sound.
- [ ] Check the URL bar is visible and reads `vanav.io` — it is free proof the
      thing is deployed.
- [ ] Confirm nothing on screen says a number you cannot source.

## The other video — do not confuse them

This is the **judge** video: 90 seconds, argues the problem, proves it is an
agent. The **prospect** demo is a different thing entirely and lives in
`docs/demo-for-prospects.md` — longer, they drive, never show the landing page.
