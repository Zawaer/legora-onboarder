# Model and infrastructure costs

What Claude costs us to run. Not to be confused with `pricing.md`, which is what
we charge customers.

All figures verified **1 September 2026** against
[Anthropic's pricing docs](https://platform.claude.com/docs/en/about-claude/pricing)
and [AWS Bedrock pricing](https://aws.amazon.com/bedrock/pricing/). Re-check
before quoting them at anyone — these move.

---

## 1. Bedrock costs the same as the direct API, except in the EU

Claude Opus 5, USD per million tokens:

| | Direct API | Bedrock (global) | Bedrock (EU region) |
| --- | --- | --- | --- |
| Input | $5.00 | $5.00 | $5.50 |
| Output | $25.00 | $25.00 | $27.50 |
| Cache write (5 min) | $6.25 | $6.25 | $6.88 |
| Cache read | $0.50 | $0.50 | $0.55 |

Anthropic's docs state the rule directly: *"Regional and multi-region endpoints
include a 10% premium over global endpoints."* Global endpoints route
dynamically for availability; regional endpoints guarantee the geography.

Claude Sonnet 5 is $2 / $10 — 2.5x cheaper than Opus 5. The increase to $3 / $15
that was scheduled for 1 September 2026 was cancelled; $2 / $10 is now standard.

## 2. Decision: EU regional endpoint on Bedrock, and we pay the 10%

Three of our four LOIs are blocked on data handling — Apukuski on GDPR, Fermion
on data security, Netprofile on an independent review. A regional endpoint lets
us say *"inference runs in Frankfurt, guaranteed, and is never retained or
trained on"* rather than arguing about routing.

Ten percent is the cheapest thing we will ever buy. Pay it.

**There is no EU option on the first-party API.** Its `inference_geo` parameter
accepts only `us` or `global`, and `us` carries the same 1.1x multiplier.
Bedrock (or Vertex) regional endpoints are the only EU-residency path. This is
the deciding argument for Bedrock, ahead of the credits.

Verify which Claude models are live in the chosen EU region before committing —
availability varies by region and changes.

## 3. Prompt caching dominates every other cost decision

Cache reads are $0.50/MTok against $5.00 base — **10x cheaper**. Our workload is
close to the ideal case: every question hits the same company brain as context.

Cache the brain, pay full price only for the question and the answer. Get this
wrong and nothing else we do about cost matters.

Watch `usage.cache_read_input_tokens` in responses. If it is zero across
repeated requests, something in the prefix is changing between calls and we are
paying 10x for nothing.

## 4. Model split

- **Sonnet 5** for routine onboarding Q&A. Most questions do not need Opus.
- **Opus 5** for the harder synthesis — deriving a role from company context,
  and detecting that a document has gone stale.

## 5. What a pilot actually costs us

Ten new hires, six weeks, ~20 questions each, caching on a ~30k-token brain, on
Opus 5 in an EU region: **roughly €10–30 for the entire pilot.**

At twenty customers of fifty employees each, still low thousands per year.

Two consequences: the 2 500 SEK pilot price in `pricing.md` has effectively no
cost of goods against it, and inference is not a reason to delay anything.

## 6. What we lose on Bedrock

Not available: Files API, Anthropic's Batch API (and its 50% discount), server-
side web search and web fetch, code execution, MCP connector, Managed Agents.

None of these are on our path in the next six months. The Batch discount would
only matter for bulk re-indexing; Bedrock has its own batch inference if that
ever becomes a real number.

## 7. Credits

Wojtek Szkutnik (prelint, SYE judge) offered €10k in AWS credits and confirmed
over LinkedIn on 1 September 2026 that **they cover Bedrock**. He also noted
Bedrock credits can be used through a third-party gateway such as Vercel AI
Gateway.

**We are not using a gateway.** It puts another sub-processor in the data path,
and we would have to name it in our DPA and explain it to the same reviewers who
are currently blocking three pilots. Call Bedrock directly from the backend.

**Open:** whether part of the €10k is usable as cash for non-AWS costs
(incorporation, pen test). Asked, not yet answered.

## 8. Still to confirm

- Zero-retention terms, and whether they apply on Bedrock or must be arranged
  separately.
- Anthropic's and AWS's DPAs and sub-processor lists — we need both to write our
  own, since we are a processor passing data to sub-processors.
- Bedrock per-account throughput quotas in the chosen EU region. New accounts
  start low. Fine for a pilot; request an increase before anything resembling
  load.
