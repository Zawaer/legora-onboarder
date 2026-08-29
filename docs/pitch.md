# The pitch — 3 minutes, then 2 minutes of questions

Top 10 teams pitch Sunday 13:00. Three minutes is roughly 400 words spoken
well. Cut anything that isn't below.

---

## 0:00–0:35 — The story (do not rush this; it is the strongest asset we have)

> Friday night we didn't have an idea. So we went out onto the street and asked
> people what was broken at their work.
>
> The first two people we spoke to worked at Legora.
>
> They told us three things. They hire tens of people every week. Most of those
> roles have never existed at the company before. And nobody has time to look
> after the new people, so they have to be independent from day one.

Say it in that order. It is a real conversation, not a market analysis, and the
judges will know the difference.

## 0:35–1:05 — The forced conclusion

> We checked the numbers. Legora went from three million to a hundred and fifty
> million ARR in eighteen months. They're going from seven hundred people to
> fifteen hundred by December. That's about fifty hires a week.
>
> So: you can't write documentation, because the role is being invented while
> they hire for it. You can't use Glean, because retrieval needs the answer to
> already exist and needs the new person to know what to ask. You can't assign a
> mentor, because there is no spare senior person — that's the whole constraint.
>
> Volume, no docs, no humans. The only thing left that scales is an agent.

**This is the load-bearing thirty seconds of the pitch.** You are closing three
doors so the fourth is the only one open. Do not soften it.

### If you get a follow-up, these two lines are the sharpest we have

Credit to Viia for both. Use them in Q&A, or swap them in above if the room
looks unconvinced.

> **"Documentation existing doesn't help, because they don't know what to search
> for. They don't know what they don't know."**

That is the single cleanest reason enterprise search loses here. Retrieval needs
a query, and a query needs you to already know the shape of the answer.

> **"Normally 'how we do things here' passes from the people who've been there to
> the people who haven't. When everyone started last week, there's nobody to
> absorb it from."**

This is the one that makes hypergrowth *qualitatively* different rather than
just more of the same. The mechanism that normally transmits tacit knowledge
requires a ratio of veterans to newcomers, and at fifty hires a week that ratio
inverts. It isn't that onboarding got harder — it's that the thing that used to
do the job silently no longer exists.

Two more worth having in your pocket:

- **Nobody sequences the work.** Twenty things land at once and no one says in
  what order, because the manager is running twenty other new people.
- **Mistakes surface late.** Someone can do a thing wrong for weeks before
  anyone notices. That's normally caught by a manager reviewing work — which
  works at five to eight reports and not at fifty a week.

## 1:05–2:05 — Demo (one minute, rehearsed, no live derivation)

Onboarding an ex-M&A lawyer into a **Legal Engineer** role — a job that did not
exist in the legal industry three years ago and that Legora invented.

Show exactly three things:

1. **The derived role**, with citations. "Nobody wrote this. It read their Slack
   and worked it out — and every line points at the message it came from."
2. **The first task**, with context attached. "Not a reading list. Real work,
   day one, with everything needed to do it without interrupting anyone."
3. **The manager screen.** "Blockers. Not scores. We deliberately show no
   productivity metrics — they hire for ownership, and a surveillance dashboard
   gets killed by the culture it's sold into."

> **Pre-record the derivation.** It takes 20–60 seconds live. That is a third of
> the pitch spent watching a spinner. Have the result already on screen.

## 2:05–2:35 — Traction

Read the actual numbers off the screen. Whatever is true on Sunday morning:
paying customers, signed LOIs, the Legora conversation, other companies spoken
to. Be specific and be honest — the judges open the GitHub and the Stripe
dashboard is real.

## 2:35–3:00 — Why this is a company

> Our market isn't "companies that onboard people". That's Rippling's market and
> it's crowded. Ours is **companies whose org chart changes faster than their
> documentation can** — which is the defining condition of an AI-era company,
> and there are more of them every quarter.
>
> Workday paid about a billion dollars for Sana, from this city, serving
> companies that already knew what their roles were. We're going after the ones
> that don't.

---

# The 2 minutes of questions

## "Isn't this just Glean?" — this is coming, have it word-perfect

> Glean is retrieval. It answers questions you already know to ask, and only if
> someone already wrote the answer down. For a role nobody has ever held,
> neither of those is true. We don't retrieve the role, we derive it from what
> the team is actually doing. And we don't wait to be asked — we drive the first
> two days.

## "Why doesn't Slack or Glean just ship this?"

The derivation compounds. Every ramp we run tells us which parts of a role were
real and which the company hadn't decided yet — that's a dataset about how roles
form inside a company, and it isn't a prompt anyone can copy in a sprint.

## "Isn't onboarding a nice-to-have? HR budgets are slow."

Our buyer isn't HR, it's the hiring manager — and at fifty hires a week it isn't
episodic, it's continuous. We're not selling a document tool, we're selling back
supervision capacity that doesn't exist at any price.

## "What happens when your customer stops hypergrowing?"

Internal mobility hits the identical wall — someone moving into a role nobody
has held inside that company has exactly the same problem. Same product.

## "How do you know ramp actually got faster?"

Honest answer: time-to-first-shipped-task, and the count of interruptions the
agent absorbed that would otherwise have hit a senior. We instrument both. We
are not going to claim a 40% number we can't defend.

## "What stops it hallucinating a job description?"

`lib/agent/ground.ts`. Every citation is verified to actually appear in the
source message; anything that doesn't is dropped. Open the file. Showing a
hiring manager invented quotes from their own Slack is worse than showing them
nothing — and they'd catch it instantly.

---

## Rules for the room

- **Never say "fastest growing company in history."** Say "$3M to $150M ARR in
  eighteen months, 700 to 1,500 people by December." Numbers can't be argued
  with; a superlative invites a judge to spend your time debating Cursor.
- **Ask the Legora contacts before naming them or putting them on a slide.**
  "We met two people from Legora on the street" is a great line and completely
  fine. Their names and anything said in confidence are not ours to use, and a
  contact who feels exposed does not sign anything.
- **Do not overclaim proactive escalation as novel.** Moveworks and the
  enterprise HR-agent vendors already advertise it. Ours is about the *work*
  ("stuck on the data model, here's who fixes it in five minutes"), not task
  completion ("IT hasn't provisioned the laptop"). Say the specific version.
