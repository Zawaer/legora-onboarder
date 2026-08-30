# VANAV — demo script

**~2:05 · five shots · record separately and stitch**

---

## Before recording

```bash
npm run dev                    # terminal 1
node scripts/slack-bot.mjs     # terminal 2
```

- [ ] Load `localhost:3000/manager` and `/app` and let them finish compiling
- [ ] In your Slack DM with VANAV, type **`plan`** — instant, no model call, and the only content missing
- [ ] Slack → **Do Not Disturb** (a notification banner mid-shot ruins the take)
- [ ] Close DevTools, hide bookmarks, browser to ~125%
- [ ] Set the capture region **once** and don't change it between shots

> **Never derive a new role on camera.** Cached is instant, cold is three minutes.

---

## Shot 1 · 0:00–0:30 · landing page, then Slack DM

**Screen A — `vanav.io`, five seconds only.** It gives judges the URL and shows the thing is real. It is not the product, so do not linger.

> Fast-growing companies keep hiring into roles that have never existed before. No playbook, no onboarding doc, nobody who has done the job.

**Cut to Slack.** Scroll to the opening brief: *"Toivo — you're the Legal Engineer. I read everything your team has written and worked out what this role actually is here, so you don't have to reverse-engineer it from standups."*

> This is my own Slack. I said hey, and it already knew what the job was, because it had read this company's Slack, docs and tickets and worked it out. **That last line is the agent describing its own job, and it's right. Working out what the role actually is takes most new hires their first two weeks.**

**Then scroll to the bottom and type `plan` on camera.** Instant, no model call, and typing it live proves the thing is running rather than a scroll through screenshots.

**Screen:** **Your two-day ramp**, Day 1 and Day 2, six tasks, status icons, footer `0 of 6 done`.

> This is a two-day plan of real work, **and nobody wrote it.**

**Land on** "nobody wrote it" with all six tasks visible.

---

## Shot 2 · 0:20–0:35 · same DM — **type this one live**

The only shot you don't pre-run. It proves the thing is actually running rather than a scroll through a screenshot. Measured at **6 seconds**, so you barely wait.

**Type, on camera:**

```
Am I allowed on client calls in my first week?
```

**Say while it thinks** (~6s, don't rush to fill it):

> Everything it knows, it learned from what this company already wrote down.

**When it lands** it opens with a flat *"No"*, names Anders and Elin, and quotes Elin verbatim with the channel and the date.

> It quoted the person who decided it, on the day they decided it. Every quote is checked word for word against the original, and anything that fails gets dropped rather than shown.

---

## Shot 3 · 0:35–1:10 · same DM — **the centrepiece**

**Screen:** scroll slowly through the two exchanges already in the thread.

1. **Git question** → dashed card, *"From the web · not from your team"*, answer, three real source links. **Hold two seconds.** This box is the argument.
2. **Nordkap SSO question** → reply naming Johan Lindqvist and the time cost.

> Now two questions, thirty seconds apart. For each one it decides the same thing: **is this worth interrupting a colleague for.** The first has nothing to do with this company, so it answers that itself and shows exactly where the answer came from. **Nobody on the team was touched.** The second one it genuinely cannot answer from anything the company has written down, and instead of guessing, it points me at one person: Johan, who owns Nordkap. It names him, and it says how much of his time it will cost.

> ⚠️ **Do not say "watch it appear."** That blocker was raised at 01:34. You're showing it, not creating it.

---

## Shot 4 · 1:10–1:30 · `/manager`

**Screen:** opens on *"6 people ramping, 3 need you"*. Scroll past the three red **Needs a human** cards, all routing to Johan. Stop on **Where two ramps touch** and hold on one card long enough to read it.

> Three people are blocked, and all three need the same person, so he clears three in one message. And here the agent wrote a line into one person's plan naming another, settling which work is whose. **They never messaged each other.** The second plan was written against the first one's committed state. Agents talking to each other is theatre. Not double-booking a colleague is not.

The *"all three need the same person"* line turns three duplicate-looking cards into the strongest thing on screen.

---

## Shot 5 · 1:30–1:55 · `/app`, then Slack

> **Ask Claude to flip `auto_send` to false first**, or nothing will be held and there's nothing to approve.

**Screen:** draft queue with a held message. Click approve. Cut to Slack; it lands.

> And nothing it says reaches a new hire until someone at the company releases it. That gate is not decoration. Four people signed letters of intent this weekend: a COO, a VP of Quality Management, a Chairman of the Board, and a Managing Director who wants to run a paid pilot. His one condition is an independent review of how we handle data. Deloitte and Google Cloud each agreed to a conversation next week. **Nobody has paid us yet, and we won't pretend otherwise.** VANAV. It onboards people into roles that have never existed.

---

## Notes

**Traction sits at the end, never the top.** A video that opens with letters of intent makes a judge ask where the product is. Thirty seconds of the agent deciding who to spend earns the right to the claim.

**Never say "working with Deloitte."** *"Agreed to a conversation"* is the true version, and both names are checkable.

**The synthetic-workspace banner was removed from `/manager`**, so say out loud somewhere in the submission that the demo corpus is invented.

**If you need to cut time**, the close is the place: the LOI job titles can go and it still lands.
