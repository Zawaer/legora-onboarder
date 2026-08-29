# The judges — who asks what

All from public professional sources. Use it to anticipate questions, not to
flatter anyone; these people can tell the difference.

---

## Charles Maddock — Co-founder & CEO, Strawberry

**The most dangerous and most winnable judge in the room.**

Started coding at ten. Obsessed with AI agents since 2018, full-time on agentic
systems since GPT-3.5. Strawberry is a browser built for *"tomorrow's internet,
where billions of agents communicate autonomously"* — $6M seed led by General
Catalyst and EQT, with the founders of Lovable, Hugging Face and Supabase in.

**He is the agent expert.** He will not be impressed that you used an LLM. He
will want to know whether this is genuinely agentic or a chat wrapper with a
loop — which is exactly what the AI Agents track says it weights.

**Prepare for:**
- *"Why is an agent the right tool here, rather than retrieval plus a prompt?"*
  → The forced conclusion. Documentation impossible, retrieval needs a query
  you can't formulate, no spare humans. The agent isn't a choice, it's what's
  left.
- *"What does it do that a loop over `messages.create` doesn't?"* → It derives a
  role nobody wrote down, decides what is worth a human's attention, and
  declines to escalate what it can answer. The escalation *judgment* is the
  product.
- *"How do you stop it making things up?"* → `lib/agent/ground.ts`. Show him the
  adversarial test cases. This is the answer he'll respect most.

Don't oversell. He'll spot an overclaim instantly, and the build is genuinely
good enough to describe plainly.

## Wojtek Szkutnik — Founder & CEO, Prelint

**He will open the GitHub, and he has personally lived your problem.**

Software engineer and architect by background, MBA. Prelint's own product is
*"prevent product drift in AI-written code"* — reviews of AI-generated code. He
reads code for a living, right now.

And the detail that matters: **as COO at Talixo he scaled from 3 employees to
100+ across the world.** He has personally been the manager with no time,
onboarding people into roles that did not exist the previous quarter. He may be
the single most likely person in the room to believe the problem on sight.

**Prepare for:**
- Code-level scrutiny. The repo is commented to explain *why*, which is written
  for exactly this reader. Point him at `lib/agent/ground.ts` and the
  `data/*.json`-is-ephemeral note in `docs/deploy.md` — admitting a known
  limitation in writing earns more with this judge than hiding it.
- *"What happens when the corpus is 50,000 messages, not 63?"* → Honest answer:
  we cap and warn today; the real answer is retrieval over the corpus before
  derivation, and we know that's the next thing.
- His own product is about *drift*. `STU-31` (catching work going wrong before a
  human notices) is conceptually adjacent — worth mentioning as what's next.

Prelint credits are also 25 000 kr of the first prize. Using Prelint on this
repo before Sunday would be a genuinely good use of thirty minutes.

## Karin Ruiz — CEO, Sting

**A coach, not an investor. She is judging you, not just the demo.**

A decade at Sting, most of it as Head Coach before becoming CEO in 2025. Has
supported hundreds of startups. Sting selects for *"bold ideas, high ambition,
and potential for global impact"* — companies *"tackling real problems with both
urgency and ambition."*

**Lead with the street story for her.** Going outside and asking strangers what's
broken, then throwing away your own idea when you heard a better problem, is
precisely the behaviour startup coaches spend years trying to instil and rarely
see. It will read to her as founder quality, not as an anecdote.

**Prepare for:** *"What would you do on Monday if you don't win anything?"* Have a
real answer. Coaches are testing whether you'd keep going.

## Gigi Ryberg — Stora Enso

The hackathon site lists her as Head of Growth; public sources show **VP of
Front-End Innovation**. Don't state a title confidently — say "at Stora Enso".

Stora Enso is a ~20,000-person, 100+ year old materials company. She is the one
judge who does **not** live in hypergrowth-startup world.

**She will ask the question your ICP framing is weakest on:**
> *"Does this only work for AI startups hiring fifty people a week?"*

Have the answer ready: **internal mobility hits the identical wall.** A large
traditional company creating a function that did not previously exist — an AI
team, a sustainability function, a new digital unit — has exactly the same
problem: someone moving into a role nobody inside the company has held, with no
predecessor and no playbook. Same product, slower sales cycle.

That answer also happens to be your expansion story, so it's worth saying well.

## Oscar Äng — Senior Strategy Manager, Swish

Strategy at Swish, previously **Nova Talent** and Accenture. So: consulting
rigour, national-scale payments, and — usefully — talent-side experience.

**Prepare for:** unit economics and scale. *"What does one customer cost you to
serve?"* Know that a derivation costs roughly $1–2 in inference and that the
corpus is re-sent per call, so gross margin improves with caching and retrieval.
Don't bluff a number — say what you measured.

## Marwan Ayache — Deputy Executive Director, SSES

Head of Operations at SSES, overseeing incubation programmes across Stockholm's
universities.

He runs cohort programmes — **he onboards groups of people into undefined roles
for a living.** He is a plausible user, not just a judge.

He's also the natural audience for the **Edtech B2C** track: if asked why you
ticked it, the honest answer is that ramping someone into a role nobody has held
is a learning problem, and the same derivation works for a student entering a
job that didn't exist when they started studying.

---

## The one rule

Six judges, one pitch. Do not try to address all six — say the argument
cleanly and let the Q&A go where it goes. This page is so nothing surprises
you, not a script to perform.
