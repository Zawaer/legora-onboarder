# Prompt: redesign the manager view

Paste into v0 / Lovable / Claude. Written to be pasted whole.

---

Redesign a single screen: the manager dashboard for VANAV, a product that
onboards people into roles that have never existed at their company before.

## Who reads this and why

A People or Engineering lead with four people ramping at once. They open this
between meetings, for about twenty seconds, and they need one thing: **is anyone
stuck, and does it need me?** They are not browsing. They are triaging.

This screen is also what the product is sold on, so it must look like an
operations tool a company would pay for, not a demo.

## What it must show, in priority order

1. **Blockers that need a human.** The only part that is urgent. Each one has:
   the person who is stuck, one sentence on what is blocking them, a named
   colleague who can unblock it, and an honest time cost ("about 5 min of their
   time"). If nothing is blocked, that emptiness should read as good news, not
   as a broken page.

2. **Where two ramps touch.** A sentence the agent wrote into one person's plan
   naming another person, settling which work is whose. Example, real output:
   "Rebecca Hartley is holding the 'every place we are wrong on three Nordkap
   SPAs' list and the LE-2231 disclosure-schedule scope on the same account,
   check with her which three SPAs she has taken." Two people, one shared
   sentence. The relationship is the content, so a plain list of text is the
   wrong shape for it.

3. **Two counters.** Questions the agent resolved without interrupting anyone
   (currently 32), and the share of unanswerable questions that turned out to be
   general knowledge rather than company knowledge. These argue that the tool is
   saving the team's attention. They are evidence, not decoration, and they
   should not look like a generic stat card row.

4. **Who is ramping.** Name, derived role title, day 1 or 2 of their plan, and
   progress through their tasks. Four to six people. This is reference, not
   headline: it should be scannable and quiet.

## Design constraints

- Warm classic grey palette, already fixed, use exactly these:
  paper `#f8f7f4`, surface `#ffffff`, surface-2 `#eeede8`, ink `#2b2a27`,
  muted `#5c5b55`, faint `#6b6960`, hairline `#dedcd5`, stronger line `#c6c4bb`.
- There is no accent colour. Emphasis comes from weight, scale and space.
  Reserve a single restrained red only for a blocker that needs a human.
- Support light and dark.
- Tailwind, semantic HTML, keyboard focus visible.

## What is wrong with it now

Everything sits at the same visual weight in a single column, so a blocker that
needs a person today looks exactly like a roster row that needs nothing. A
reader cannot tell in twenty seconds whether to act. Fix the hierarchy first;
the styling is secondary.

## Do not

- Do not use the current AI-design defaults: cream and terracotta, a lone acid
  accent on near-black, purple-blue gradients, emoji as section markers,
  everything centred, an accent bar on every rounded card.
- Do not add charts. There is no time series here, and a sparkline of invented
  data would be a lie.
- Do not invent metrics. Only the four things above exist.
- Do not use em dashes anywhere in the copy.

Deliver one responsive screen with real content from the examples above, not
placeholder text.
