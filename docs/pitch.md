# The pitch — 3 minutes, then 2 minutes of questions

**Track: AI Agents.** Re-cut Saturday ~12:00 for that rubric — see `docs/track.md`.

Three minutes is roughly 400 words spoken well. Time is allocated by where the
points are, not by what is most fun to show:

| | Points | Airtime |
| --- | --- | --- |
| Problem & validation | **14** | 0:00–1:00 |
| Business potential | **16** | 2:20–3:00 |
| Traction | 12 | 2:00–2:20 |
| Originality | 8 | woven through the demo |

Note what that means: **business potential is the second-biggest number and it
is the thing teams always run out of time for.** Do not let the demo eat it.

---

## 0:00–0:30 — Where the problem came from

> Friday night we didn't have an idea. So we went out onto the street and asked
> people what was broken at their work.
>
> The first two people we spoke to worked at Legora.
>
> They told us three things. They hire tens of people every month. Most of those
> roles have never existed at the company before. And nobody has time to look
> after the new people, so they have to be independent from day one.

Say it in that order. This is not a warm-up — on this track it is **validation**,
the 14-point criterion. It is a real conversation, not a market analysis, and the
judges will know the difference.

## 0:30–1:00 — Why an agent is the only thing left

**The load-bearing thirty seconds.** The 14-point band reads *"painful, frequent
and validated problem where an AI agent is clearly the right solution."* This is
you satisfying that sentence.

> You can't write documentation, because the role is being invented while they
> hire for it.
>
> You can't use enterprise search, because retrieval needs the answer to already
> exist, and the new person doesn't know what to search for. They don't know what
> they don't know.
>
> You can't assign a mentor, because the absence of a spare senior person *is*
> the constraint.
>
> Volume, no docs, no humans. An agent isn't a choice we made. It's what's left.

Do not soften it. You are closing three doors so the fourth is the only one open.

Two lines to have in your pocket if the room looks unconvinced (credit Viia):

> **"They don't know what to search for. They don't know what they don't know."**
> — the cleanest reason retrieval loses here.

> **"'How we do things' normally passes from the people who've been there to the
> people who haven't. When everyone started last week, there's nobody to absorb
> it from."** — why hypergrowth is *qualitatively* different, not just more.

## 1:00–2:00 — Demo: prove it isn't a chat wrapper

The rubric scores *"generic chatbot or basic AI wrapper"* at **zero** originality.
The field will be full of them. Every second here exists to separate you.

**Show two things. Not five.**

**1 · It speaks without being asked.** The hire says they'll fix the Italian miss
with a keyword list. Unprompted, the agent surfaces the message where that was
already ruled out:

> *"NOT shipping: a keyword list. If anyone adds 'cessione' to a keyword list I
> will find you."* — Marta Nowak, 19 Aug

> **"Nobody asked it to check. A chatbot answers questions. This noticed
> something no one reported."**

That line is the whole track in one sentence.

**2 · It refuses to make things up.** Every citation verified word-for-word
against the source; anything failing is dropped. Then show the coverage panel:

> **"It also tells you what it can't see. Four artifacts, three people, one day —
> it says the corpus is thin before you read a word of what it derived."**

Third beat if time allows: the manager screen, *"blockers, not scores —
deliberately."* Cut this before you cut business potential.

> **Never derive live.** Cached at 1.3s on the deployed site; a cold run is three
> minutes. Have the result on screen already.

## 2:00–2:20 — Traction, briefly and honestly

Read the real numbers. Whatever is true Sunday morning: pilots agreed, LOIs,
payments, companies spoken to. Twenty seconds, no padding, no spin — the judges
open the GitHub and the Stripe dashboard is real.

Traction is 12 here, not 18. Don't spend business-potential time on it.

## 2:20–3:00 — Why this is a company

**16 points. The biggest number after validation. Give it the airtime.**

> Our market isn't "companies that onboard people" — that's Rippling's, and it's
> crowded. It's **companies whose org chart changes faster than their
> documentation can.**
>
> The buyer is engineering, not HR. HR software budget is around $250 per
> employee per year and shrinking. Engineering spends $500 to $3,000 per head on
> AI tooling alone, ring-fenced and growing. Same motion, same product:
> Enboarder's median contract is $17,000; Glean's is $99,000.
>
> Bottom-up: roughly 16,000 companies in the US and Western Europe with 200-plus
> engineers. At $25 per engineer per month that's a $1.7 billion market and a
> $105,000 average contract. **Thirty-three customers clears a Series A.**
>
> And it compounds — every question the agent takes to a human becomes corpus the
> next hire never has to ask about.

---

# The 2 minutes of questions

## "Is this actually an agent, or a loop with a prompt?" — Charles Maddock will ask this

> It derives a role nobody wrote down, decides what's worth a human's attention,
> declines to escalate what it can answer itself, and speaks unprompted when it
> spots a conflict nobody reported. The *judgment about when not to act* is the
> product. A wrapper can't decline.

## "Isn't this just Glean?"

> Glean is retrieval. It answers questions you already know to ask, and only if
> someone already wrote the answer down. For a role nobody has held, neither is
> true. And when the answer exists nowhere, we get it from the person who'd know —
> that's corpus that exists in no connector.

## "What stops it inventing quotes?"

> `lib/agent/ground.ts` — every citation verified verbatim, unverifiable ones
> dropped. And we found a subtler failure ourselves: a quote can be completely
> genuine and still mislead if it stops one sentence early. So citations expand
> forward to show what the person said next. Open the file.

That admission scores better than the claim it replaces. Use it.

## "How do you know ramp actually got faster?"

> Time to tenth merged PR — never satisfaction. And be careful with satisfaction:
> active-learning research finds it moves *down* while actual learning moves up.
> We're not going to claim a 40% number we can't defend.

## "Who actually answers when the agent asks a human?"

> Honestly, unproven. Published expert-response rates sit near 25% within 24
> hours, so we route to peers first, cap it at one or two asks per person per
> week, and make refusing free. Completion rate per expert is what we'd
> instrument on day one.

## "What happens when your customer stops hypergrowing?"

> Internal mobility hits the identical wall — someone moving into a role nobody
> inside the company has held has exactly the same problem.

---

## Rules for the room

- **Never say "fastest growing company in history."** Say the numbers: $3M to
  $150M ARR in eighteen months, 700 to 1,500 people by December.
- **Say "tens of hires a month", not "fifty a week."** Fifty a week is 2,600 a
  year, implying a 6,000-person company — above our stated ICP, and a judge with
  a calculator will check.
- **The corpus is synthetic.** Never imply it read Legora's real Slack. The seed
  file is in the repo; the argument doesn't need the overclaim.
- **Ask the Legora contacts before naming them or putting them on a slide.**
- **Don't claim proactive escalation is novel** — Moveworks advertises it. Ours
  is about the work, not task completion. Say the specific version.
- **Don't say "Pyn died."** It isn't dead. Use Almanac, or better, Microsoft Viva
  Topics: perfect distribution, zero acquisition cost, dead in under four years.
