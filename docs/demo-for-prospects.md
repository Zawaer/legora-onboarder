# The demo, for a customer meeting

Not the judge demo. Different audience, different goal, opposite structure.

| | Judge (Sunday, 13:00) | Prospect (Joe, Aino, a founder in the room) |
| --- | --- | --- |
| Knows the problem? | No — you must argue it | **Yes. They live it.** |
| Who drives | You | **They do** |
| Goal | Prove it's an agent, not a wrapper | **"Can we try it on ours?"** |
| Length | 60 seconds, rehearsed | 5–10 minutes, interruptible |
| Landing page | n/a | **Never show it** |

---

## Do not explain the problem

Joe onboards around a hundred people a month. Aino publicly posted that she is
hiring "people who don't need a playbook". Explaining that onboarding is hard at
a fast-growing company wastes the meeting and mildly insults them.

Open in their world instead.

## The opening: their own job ad

> "Can I show you something? This is your actual posting for [role]."

Paste their real public job description into `/jd`. It breaks it into claims.
Then say the honest thing, which is also the ask:

> "I can tell you which of these your own Slack supports, contradicts, or is
> silent on. I just can't do it without your data — that's what I'd want from a
> pilot."

Why this works: it uses **their** content, it demonstrates the mechanism without
overclaiming, and it ends naturally on the ask rather than needing a pivot.

**Be explicit that our corpus is synthetic.** "This is a corpus we built to look
like a company like yours." Never imply we read their Slack. With Joe especially
— he can check, and losing him is worse than any demo.

## Then the mechanism, sixty seconds, on our corpus

Open `/hire/demo-legal-engineer`. Three beats, in this order:

**1 · The coverage panel first, before anything derived.**

> "It tells you what it couldn't see before it tells you anything else. Sixty-
> three messages, fourteen people, twenty-two days — and no DMs, no meetings, no
> calls."

Counter-intuitive, and it is the right opening for a sophisticated buyer. Both
of them will be thinking *how do I know this isn't made up*. Answering before
they ask it buys you the next five minutes.

**2 · The derived role, and scroll to the citations.**

> "Nobody wrote this. Every quote is checked word-for-word against the source
> message — anything that fails, we drop rather than show."

Then the open questions:

> "And where the company genuinely hasn't decided something, it says so instead
> of inventing an answer."

For Joe, this is the beat that lands — it is his job, described back to him.

**3 · Hand them the phone.**

Let *them* type a question into the chat. A demo you drive is a presentation; a
demo they touch is an evaluation. It is also how you find out what they actually
care about, which is worth more than anything you planned to say.

## Tailoring

**Joe (People Enablement, Legora)** — his currency is manager time. After the
role, go to `/manager`: *"blockers, not scores — deliberately, because you hire
for ownership."* Then `/manager/brief`: the buddy suggestion with the reason
quoted, including who it did **not** pick and why. That is his job, automated,
and it is the strongest single screen for him.

**Aino (Head of Nordics, Lovable)** — she will grasp it in seconds; Lovable runs
its own internal agents. Skip the explanation and go to the open questions and
the drift catch. Her hook is her own sentence: *"you wrote you're hiring people
who don't need a playbook — this is for the fact that there isn't one."*

**A founder in the room** — go straight to `/ingest`. Ask them to paste thirty
messages from any channel. Watching it work on their own words in ninety seconds
converts better than anything on our corpus.

## Do not show

- The landing page. They're already in the room.
- A live derivation. Cached is 1 second; cold is three minutes.
- Voice, Slack, `/pitch`, the elicitation loop. **Hold these as answers to
  questions.** If they ask "does it work where we already are?", *then* open
  Slack. Leading with them dilutes.

## Close on the ask, not a summary

> "Want to try it on one channel? Paste me thirty messages from anywhere work
> actually happens and I'll show you what it says about a role you've hired for
> recently. Ten minutes."

For a bigger company where an export needs approval, the smaller ask still
works: **thirty pasted messages needs no admin, no export flow, no legal
review.**

## Send the link afterwards

`https://legora-onboarder.vercel.app/hire/demo-legal-engineer`

Stable and bookmarkable, so it survives a cold start and can be forwarded
internally. The person you demoed to is rarely the only person who has to say
yes — give them something to forward.

## The three questions to ask them

Worth more than the demo. Ask at least one.

1. *"When was the last time someone new interrupted you with a question — and
   had you already written that answer down somewhere?"*
2. *"Of the roles you hired for this year, how many had never existed at the
   company before?"*
3. *"Which budget would this come out of?"* (People vs engineering — the answer
   settles a strategy question we cannot settle ourselves.)

---

## The 15-second beat: two questions that resolve differently

The strongest thing to do with the chat is not to ask it one good question. It
is to ask it two, back to back, and let the prospect watch the agent decide
which one is worth a colleague's time.

Open `/hire/demo-legal-engineer` and paste these in order. Do not paraphrase
them — both are verified on this corpus, and both are load-bearing.

**1 · Answered from the web. Nobody contacted.**

```
What's the difference between a git rebase and a git merge, and which should I use before opening a PR?
```

Comes back in about 14 seconds in a **dashed grey card headed "From the web ·
not from your team"**, with three real links and a closing line: *"If this is
actually about how we do it, say so and I'll ask someone."* Nothing appears on
`/manager`. Nobody at the company was interrupted.

The line to say over it:

> "It didn't guess, and it didn't go ask anyone. It worked out that this has
> nothing to do with this company — and then it told her where the answer came
> from, in a box that deliberately looks nothing like a quote from her team."

**2 · Escalated to a named person.**

```
I can't see the Nordkap change-of-control workspace under my SSO login — the three SPAs won't open.
```

Routes to **Johan Lindqvist**, who owns Nordkap technically. Open `/manager` in
a second tab: the blocker is there with his name on it and an honest five
minutes.

> "Same agent, same corpus, thirty seconds apart. That one it could not answer
> and would not fake, so it spent a person — and it told her which person and
> how long it would cost him."

**Why these two and not others.** The corpus always wins, so a demo question has
to be one the corpus genuinely cannot settle. Git conventions appear nowhere in
this workspace, which is why the first one reaches the web; and the classifier
is tuned to assume INTERNAL unless it is sure, so a question that merely *sounds*
general (*"what's the difference between precision and recall?"*) gets answered
from the corpus instead — Johan's review checklist covers it. Do not swap these
out without checking the replacement first.

**One honest note if a prospect is watching closely.** The Nordkap blocker is
already open on the demo hire, so on question 2 the agent routes to Johan
rather than opening a second row. That is deliberate — one obstacle is one row,
and re-raising it every turn is how a manager's queue becomes noise. Say so if
asked; it is a better answer than the one they were expecting.

### The number to show afterwards

`/manager` now carries two figures above the roster, both about the agent and
neither about a person:

- **questions resolved without interrupting anyone**
- **the share of questions the corpus could not answer that turned out to be
  general knowledge** — the ones that would otherwise have cost a colleague
  something for nothing

The second one is queryable, not just drawn, so it can go in a write-up with a
date on it:

```
curl https://legora-onboarder.vercel.app/api/resolutions
curl 'https://legora-onboarder.vercel.app/api/resolutions?company=legora&records=1'
```

Filters: `company`, `hire`, `since` (ISO 8601), and `records=1` for the rows
each number was computed from.
