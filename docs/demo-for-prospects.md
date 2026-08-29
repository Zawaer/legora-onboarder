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
