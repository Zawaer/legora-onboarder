# Lovable prompt — landing page only

Landing page, not the demo. The demo is what we show people today; this is the
page that has to work on a stranger who found us with no context.

Reflects the reframe in `STU-41`: the product is the loop, not the role brief.

---

Build a landing page for **Onboarder**, a B2B SaaS product. One page, static
content, no backend, no auth. Marketing site only — do not build the product UI.

## What it sells

Onboarder is an AI agent for companies that hire faster than they can document.
It removes the social cost of asking, and when nobody has written the answer
down, it goes and gets it from the person who knows.

The customer is a hiring manager or Head of People at a company of 200–1500
people that is doubling. Not HR admin software — the buyer's problem is that
their own attention is the scarce resource.

## The argument, in order

**Hero.** Headline: **"Onboarding for a job that has never existed."**
Subhead: it reads your team's actual Slack, docs and tickets, works out what the
role really is, and stays with the new hire through their first week.
Primary CTA "See it work", secondary "How it works".

**The three facts**, as a bordered three-up:
- **700 → 1,500** — people at one customer this year. A hundred hires in July alone.
- **0** — playbooks for a role nobody has held before.
- **Day 1** — when they're expected to be useful.

**Why nothing existing works.** Four short blocks, each closing a door:
- *Write documentation* — the role is being invented while they hire for it.
  There is nothing to document yet.
- *Enterprise search* — retrieval needs the answer to already exist, and the new
  person doesn't know what to search for. They don't know what they don't know.
- *Assign a mentor* — the absence of a spare senior person **is** the constraint.
- *Wait and see* — a manager catches mistakes by reviewing work. That holds at
  five to eight reports and collapses well before this.

Then, set apart and larger: **"So the only thing left that scales is an agent."**

**How it works** — four steps, and make step 4 feel like the payoff:
1. **Derives the role** from what the team is already doing, with every claim
   cited to the message it came from.
2. **Gives them real work on day one**, with the context to actually do it.
3. **Answers from your company's own material**, so nobody burns a senior's
   afternoon — and says plainly when nobody has written it down.
4. **Goes and finds out.** When the answer doesn't exist, it asks the person who
   would know, in under a minute of their time, and the answer is there for
   everyone who joins after. **It gets better with every hire.**

**A section on what it refuses to do.** Three items, stated flatly:
- It never scores, rates or ranks a person. The manager sees blockers, not
  productivity. A tool that reads as surveillance gets killed by the culture it
  is sold into.
- Every quote is checked word-for-word against the source. Anything it cannot
  verify is dropped, not shown.
- When the company hasn't decided something, it says so instead of guessing.

**A quote block**, styled as a real overheard line, attributed to "Head of
Engineering, 700-person company":
> "I have three people starting Monday and I have written exactly nothing for
> any of them."

**Pricing.** Two cards: **2 500 kr** one-off pilot for your next cohort, and
**4 900 kr / month** for the team. A line underneath noting the long-term model
is per hire onboarded.

**Closing CTA** and a minimal footer.

## Visual direction — the important part

Aim for the restraint of Linear, Stripe or Vercel. A serious tool someone pays
for, not a demo of what a gradient can do.

- **Avoid every AI-startup cliché**: no purple-to-blue gradients, no glowing
  orbs, no glassmorphism, no floating 3D shapes, no sparkle emoji, no
  "Supercharge your workflow" copy.
- Near-monochrome: off-white paper, near-black ink, two or three greys, and
  exactly **one** accent colour used sparingly.
- Typography carries the page. A real type scale, generous line height (~1.6),
  measure around 65 characters, tight confident headings.
- Hairline 1px borders and whitespace instead of heavy shadows and cards.
- Full light and dark mode via `prefers-color-scheme`, both deliberately
  designed rather than one inverted.
- Responsive with no horizontal page scroll at any width.
- Accessible: real contrast, visible focus states, semantic heading order.

## Rules

- Static content only. No lorem ipsum — use the copy above.
- No component library that imposes its own look. Tailwind and hand-built
  components.
- Every section must look finished. If a section would be thin, cut it rather
  than padding it.
