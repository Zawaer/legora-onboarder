# VANAV — 3 minute pitch, with live demo

*Revised 2 September 2026 for the market correction in `DECISIONS.md` §11.
Written for the hackathon stage; the structure holds for a prospect or an
investor, and the demo mechanics are the same. `demo-for-prospects.md` is the
longer customer-meeting version.*

**3 min total, including the demo. 2 min questions after.**
Budget: ~2:15 talking, ~45s demo. Have the DM and `/manager` already open in
two tabs. Do not load a page on stage.

---

## 1 · The problem (30s)

> Six hours into this hackathon, at midnight on Friday, we threw away every idea
> we had and went out onto the street to ask people what was actually broken at
> work.
>
> The first people we met worked at Legora, and they gave us the problem at its
> most extreme: eight hundred hires in four months, most into roles that had
> **never existed at the company before.** No playbook, no onboarding doc,
> nobody to shadow.
>
> Then we heard the same thing from Lovable, Deloitte, Avance, Fermion and
> Tonava — and none of those hire at anything like that speed. So the problem is
> not hiring velocity. It is that a company's org chart changes faster than its
> documentation can. What a new person gets handed on day one is already wrong,
> and nobody knows which parts.
>
> A company pays someone senior for three weeks while everyone works out what
> the job even is.

## 2 · Live demo (45s) — SLACK, ALREADY OPEN

**Type `plan`.** Instant, no model call, zero risk.

> This is a real Slack workspace. I said hey to it this morning and it already
> knew what my job was, because it had read this company's Slack, docs and
> tickets. Here is the whole two-day ramp. **Nobody wrote any of it.**

**Then type:** `Am I allowed on client calls in my first week?`
Measured at six seconds. Say the next line while it thinks, then stop talking.

> Everything it knows, it learned from what this company already wrote down.

**It answers "No", names two people, quotes one verbatim with the date.**

> It quoted the person who decided it, on the day they decided it. Every quote
> is checked word for word against the original message.

## 3 · Why this is an agent, not a wrapper (40s)

**Scroll up to the dashed web card. Do not wait for anything.**

> A wrapper answers whatever you ask it. **Ours decides who to spend.**
>
> This question had nothing to do with the company, so it answered it itself and
> labelled where that came from. Nobody was interrupted. This one it could not
> answer, and instead of guessing it pointed me at one named person and said
> what it would cost him.
>
> And when two people ramp at once, the second plan is written against what the
> first already committed to, so two hires never get sent to the same colleague
> for the same thing.

## 4 · Traction (30s)

> We only had something to sell late on Saturday night. We still got **four
> signed letters of intent**, every one from someone senior enough to actually
> sign a contract — a COO, a VP of Quality, a Chairman, a Managing Director.
> **One of them is willing to pay for the pilot.** And we have conversations
> booked with Legora, Deloitte and Google Cloud.
>
> *(Keep this list current — it dates fast. Who is blocked on what:
> `contacts.md`.)*
>
> **Nobody has paid us yet and we will not pretend otherwise.** What we can
> measure: thirty-two questions answered this weekend without interrupting a
> single colleague.

## 5 · Close (15s)

> We charge a monthly fee for keeping the brain current, and per hire on top —
> so the price scales with how much you actually use us, not with headcount that
> was already there. We are live at vanav.io. What we want next is one real
> pilot, on one real Slack.

---

## If the wifi dies

Do not debug on stage. Say **"I have this on video"**, play the recording, keep
talking over it. Have the video open in a third tab before you go up.

---

# The 2 minutes of questions

**"Why won't people just ask the person next to them?"**
The strongest objection, and it was put to us by a mentor here. They will, and
they should. This is not for the question you ask over a desk. It is for the
answer that already exists in a thread from six weeks ago that nobody can find,
and for the fifth hire asking what the first four already asked. Below about
thirty people, co-located, we are not the right tool. Our LOIs are all from
companies past that.

**"Where does this actually run?"**
The web app is deployed, vanav.io is live now. Slack runs in Socket Mode from a
laptop, which is why there is no public URL to expose. The account layer, the
review queue, the LOIs, and the hire, derivation, knowledge and resolution
stores are all in Postgres in Stockholm with row level security. *(The hire
store was JSON until 3 September 2026 — if an old recording says otherwise,
that is why.)*

**"What if the company's Slack is wrong or out of date?"**
Then we say so with a date on it. Every citation carries who said it and when,
so a stale decision is visibly stale rather than silently repeated. One of our
LOI signers wants exactly this: the tool flagging outdated onboarding material.

**"Why that price?"**
Do not quote a number from memory — pricing is off the site (`f90fe7c`) and the
shape changed to a platform fee plus per hire (`DECISIONS.md` §12). Say what
the price is *based on*, and get theirs first.

It comes from an ROI model, not a feeling: a new hire costs roughly €460 a day
fully loaded, so cutting ramp from two weeks to two days saves about €3,700 per
hire. The pilot is deliberately cheap because the first real workspace is worth
more to us than the margin.

Move the conversation to the per-hire frame, where our number looks small —
never to per-seat haggling. And ask the question we still do not have an answer
to: *what does onboarding one person cost you today, in hours of other
people's time?*

**"What stops Slack or OpenAI building this?"**
Nothing technical, and do not claim otherwise — any good team could build the
retrieval. The hard part is refusing to answer, and being right about when. A
general assistant is rewarded for always having an answer. We are rewarded for
protecting a named colleague's afternoon, and that is a different product with a
different incentive. Tuning that threshold takes seeing many companies do it —
which is the one thing a company building this internally cannot do, because
they only ever see themselves. Full answer: `DECISIONS.md` §13.

**"What did you build during the weekend, and what before it?"**
Say the pre-existing part first. It is checkable in public git history, so
volunteering it costs nothing and hiding it costs everything.

> We came in with our own starter for the boring parts: auth, Stripe, a waitlist
> and an LOI form. No product, no agent, nothing about onboarding.
>
> Everything that is actually VANAV was written here. The role derivation, the
> citation checking, the routing that decides whether to spend a colleague's
> time, the coordination between two people's plans, the Slack agent, the review
> queue, the whole demo corpus. None of those files existed on Friday.
>
> Our first commit on this product is 2am on Saturday, six hours after we threw
> away the idea we came in with. A hundred and five commits, all of them this
> weekend, and the history is public if you want to check.

**"What is the demo company?"**
Invented, entirely, by us. We have never had access to a real company's Slack.
That is the pilot we are asking for.
