# The job description vs. what the agent derived

The strongest single slide available to you. It uses Legora's **real, public**
job posting, which anyone can open and check.

---

## Read this first — the honesty rule

The corpus in `lib/seed/legora.ts` is **synthetic**. It is realistic and it was
built to be hard, but it is not Legora's actual Slack and we have never had
access to it.

**Say that plainly if anyone asks, and don't phrase anything so that a listener
would assume otherwise.** The claim that survives scrutiny is:

> "Point it at a company's Slack and it derives the role. Here it is running on
> a realistic corpus we built for a role that genuinely has no playbook."

The claim that gets you disqualified is implying it read Legora's real
messages. Judges open the GitHub, see the seed file, and the whole pitch dies
with it. The argument below works perfectly well without the overclaim.

---

## Side by side

**What Legora's public posting says the role is** — [careers.legora.com](https://careers.legora.com/jobs/5888062-legal-engineer):

> "The Legal Engineer will help clients maximize the use of Legora's AI-powered
> platform, acting as a liaison between clients and product development,
> providing demos, and ensuring effective adoption across legal teams."
>
> - "Acting as a thought partner to clients"
> - "Be the voice of the user inside Legora"
> - "Documenting best practices, contribute to the development of scalable
>   playbooks"
> - "Not necessarily a coder, but passionate navigating technical conversations"

**What the agent derived:**

> "…the only person who can say what the right answer to a contract question is
> — and is therefore the binding constraint on extraction quality, escalations
> and eval labelling. Concretely, the first work waiting is LE-2231, the Nordkap
> disclosure-letter schedule export due 8 Sept before the deal signs on the
> 11th, plus a share of the prompt review queue and the ~200-clause label
> backlog that Priya cannot clear."

Day 1, task 1: *"Write the concrete wrongness list for Nordkap CoC and
assignment outputs."*

## The line to say out loud

> Both of these describe the same job. One of them tells you what to do on
> Monday morning.
>
> The job description isn't bad — it's a job description. It's written to
> attract a candidate, not to ramp one. Nobody has ever started a job on Monday
> by re-reading the ad that got them hired. That gap is the product.

## The part that should make you sit up

The agent listed **"how much code this role writes"** among the things the
company has not settled — and Legora's own public posting hedges on precisely
that point: *"not necessarily a coder, but…"*.

It also flagged **"who owns the playbook library"** as unresolved. The posting
lists "contribute to the development of scalable playbooks" — contribute, not
own. Unresolved there too.

> The agent found the same two ambiguities the company itself couldn't resolve
> in its own job ad. It didn't paper over them — it flagged them for the
> manager, which is the useful behaviour.

That is the single best evidence that the derivation is doing real work rather
than producing plausible text. Lead with it in Q&A if anyone challenges whether
the output is genuine.

## Use in the pitch

Put the two quotes on one slide, JD left, derived right. Say the "Monday
morning" line. It takes fifteen seconds and it answers "is this actually
better than what exists" before anyone has to ask.
