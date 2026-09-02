# Security and compliance

**Three of our four LOIs are blocked on this.** It is the highest-value work in
the repo after replying to them. Written 2 September 2026.

---

## 1. It is smaller than it looks

Wojtek Szkutnik, who went through SOC 2 recently, on 1 September:

> *"security posture and soc is in general a lot of waving hands and
> documentation … pen tests are easy because you kind of get a basic automated
> audit and if you use a decent cloud provider this almost automatically passes
> unless you do something really stupid"*

This is a paperwork exercise, not an engineering project. Estimated **2–3 weeks
and low thousands of euros** to clear three blocked pilots.

## 2. The checklist

**No deadline was promised.** The draft to Jussi committed to sending a full
data-handling write-up this week; that sentence was cut before sending. So items
1–3 are not owed to anyone by a date — but the email asserts our data practices
without offering anything to show, and his blocker says "GDPR compliant". Expect
him to ask. Roughly one focused day, and item 0 has to come first — see §2.1.

### Already done

- [x] Row level security on Supabase — 5 tables, 8 policies
- [x] Customer data stored in Postgres in Stockholm
- [x] Privacy page exists — but see item 3, it is the wrong document

### This week — unblocks three pilots

- [x] **0a. Code path built** — `lib/anthropic.ts`. Set `AWS_BEDROCK_REGION`
      and every model call goes to Bedrock in that region; unset and nothing
      changes. Model ids get the `anthropic.` prefix automatically.
- [ ] **0b. Actually switch it on** — **not done, and this is the part that
      makes the claim true.** Needs an AWS account, model access enabled for
      Anthropic models *in that region* (a per-region opt-in in the Bedrock
      console), and credentials in Vercel. Then verify two things before
      claiming anything: that it answers, and that
      `getLastUsage().cacheReadTokens` is still non-zero — a silently broken
      cache costs 10x and the only symptom is a slower demo. See §2.1.
- [ ] **1. Data processing description** — ~4 h. The core artifact everything
      else points at:
      - what we ingest (Slack messages from selected channels, connected docs,
        employee names and emails)
      - where it is stored (Supabase Postgres, Stockholm)
      - where it is processed (see item 0)
      - who on our side can access it, how, and under what circumstances
      - retention period, and what triggers deletion
      - what we do not do: no training, no secondary use, no sharing
- [ ] **2. Sub-processor list** — ~1 h. Vercel, Supabase, Anthropic, AWS, Slack,
      Stripe, Resend. Each one: what it does, where it runs.
- [ ] **3. Rewrite the privacy page** — ~2 h. `app/privacy/page.tsx` today says
      *"Short, because we collect very little"* and is written for website
      visitors. That is the opposite posture to "we are about to ingest your
      entire Slack." Different data, different risk, different document.

### Next — when a specific deal needs it

- [x] **4. Deletion, actually implemented** — `lib/erasure.ts` and
      `npm run erase -- <slug>` (dry run by default; `--yes` executes). Removes
      the kv corpus, the Supabase Storage objects, and the `companies` row that
      members/drafts/materials cascade from. A documented operator-run process
      satisfies Art. 17; a self-serve button would add an authenticated
      destructive endpoint we do not need yet.
- [ ] **5. DPA** — ~4 h from a template, not from scratch. GDPR Art. 28: subject
      matter, duration, nature and purpose, data categories, sub-processor
      terms. We are the processor, the customer is the controller. Promised to
      Fermion and needed by Netprofile; Apukuski was not promised it.
- [ ] **6. Zero data retention** — confirm terms with Anthropic and AWS and
      configure. Mostly a question to ask, not work to do.
- [ ] **7. Security overview page** — ~2 h. Encryption at rest and in transit,
      access control, RLS, an incident contact. This is our Trust Center; Beam's
      is the template (`competitors.md`).
- [ ] **8. Pen test** — ~€3–10k, 1–2 weeks. Only once Juha says which of the
      three options in §6 his process actually requires.

**Totals:** what Jussi was promised, ~1 day. With item 0, ~2 days. Everything
above, ~3–4 days. These are the highest-leverage days available — they convert
three conditional LOIs into pilots. The Oy, the Sprint Grant and the AWS credits
can all wait a week. This cannot, because it is now in writing.

## 2.1 Why Bedrock EU comes first

**We call the Anthropic API today, from a US company.** Under GDPR that is a
third-country transfer, and it needs a legal basis — standard contractual
clauses, a transfer impact assessment, the rest of it. We have not executed any
of that.

Writing an honest data-flow document forces us to state it. So item 1 either
says *"processed in the EU"* or *"transferred to the United States under
contractual clauses we have not yet put in place."* One of those closes pilots.

Moving inference to Bedrock in an EU region removes the transfer entirely — data
stays in the EEA and there is nothing to justify. That is why it is a blocker
for the write-up rather than an optimisation. Region rationale and the 10%
premium: `model-costs.md` §2.

## 3. Do the cheap things first, in this order

**Tier 0 — documentation. Days, €0.** Necessary regardless of what any reviewer
asks for, because it is what every review examines:

- Privacy policy, DPA, sub-processor list
- Data flow: what we ingest, where it goes, how long we keep it
- Encryption at rest, per-tenant isolation
- Deletion on request, actually implemented
- EU data residency, stated precisely (see §4)

**Tier 1 — pen test. ~€3–10k, 1–2 weeks.** This is the cheapest thing that
genuinely satisfies the words "independent third-party review". Documentation we
wrote about ourselves does not, by definition.

**Tier 2 — certification. Do not start yet.** See §3.

## 4. Do we need SOC 2? Probably not. Possibly ISO 27001, later.

**SOC 2 is a US framework** (AICPA) demanded by US enterprise procurement. Our
customers are Finnish and Swedish, where **ISO 27001** is the natively demanded
standard. Wojtek recommended SOC 2 because he is in San Francisco selling to US
companies — right for him, not automatically right for us.

**None of our four asked for SOC 2.** Juha asked for "an independent third-party
review", which a pen test satisfies.

**Before spending two months on either, ask the customer which one their process
actually wants.**

- **Vendor:** ComplyJet (Wojtek's recommendation, does SOC 2, HIPAA and ISO
  27001). Get a quote now so we know the number; start when a deal is gated on
  it, not before.
- **"2 months" is likely SOC 2 Type I** — a point-in-time snapshot. Type II
  needs an observation period of several months and is what serious buyers
  eventually want.
- **Never send a report without an NDA.** Wojtek's warning: a SOC 2 report
  documents architecture, infrastructure and data flows in detail — competitors
  request them for exactly that reason.

**Legora will eventually want a certification, probably ISO 27001.** Do not let
that set the roadmap. They are the most demanding of our prospects and the least
likely to be first. Build the security page for Netprofile and Fermion.

## 5. Hosting: multi-tenant SaaS, EU-hosted. Not on customer servers.

Raised repeatedly, including by Toivo's father. Settled:

**Self-hosting does not buy what it appears to.** The model inference still
leaves their perimeter unless we run local open-weight models — much worse
answers, GPUs most customers do not have, and a support burden one engineer
cannot carry.

**And it changes the business.** Revenue would scale with engineers, not
customers: versioning, per-customer environments, debugging over email, no daily
shipping, and no usage signal — fatal for a product whose thesis is that the
brain learns. It is the Beam AI motion (ten-day discovery workshops) we are
positioned against.

**The argument to use in sales:** every one of these companies already runs
Slack, Google Workspace or M365, and in Apukuski's case a company brain already
in GitHub. Their confidential material is already with cloud vendors under
DPAs. The marginal trust is smaller than it feels. Glean sells multi-tenant SaaS
to Samsung and Intuit — enterprises accept this; they want the paperwork.

**Keep the door open:** containerise, keep the customer data plane separable.
Offer **bring-your-own-cloud** later as a priced premium tier — deployed into
the customer's own AWS account, inference through their own Bedrock. That is
the genuinely strong version of the on-prem idea, for when someone pays for it.

## 6. What to say

> ⚠️ **Not true yet.** This is what we can say *once §2 item 0 is done.* Today
> inference goes to the Anthropic API in the US. Do not say any of the second
> sentence until Bedrock EU is live — a claim a reviewer can disprove costs more
> than the pilot is worth.

> Vanav runs EU-hosted. Model inference runs on Amazon Bedrock in an EU region
> under AWS's terms, with zero data retention — your content is not stored after
> processing and is never used to train models. Anthropic and AWS are listed
> sub-processors in our DPA.

This answers Jussi's GDPR condition, most of Satu's data-security question, and
a large part of whatever Juha's reviewer asks. Costs a configuration choice and
some paperwork, not a rearchitecture. Region rationale: `model-costs.md` §2.

## 7. Still open

- Zero-retention terms, and whether they apply on Bedrock or need arranging
  separately.
- Anthropic's and AWS's DPAs and sub-processor lists. We need both to write our
  own — we are a processor passing data to sub-processors.
- **Ask Juha which of three he means:** his own IT partner reviewing us, a pen
  test report from our side, or a formal certification. Offering all three lets
  him pick the cheapest that satisfies him instead of reaching for the most
  formal-sounding option.
- Ask Satu what specifically she needs to see. A written checklist from her is
  worth more than a yes right now.
