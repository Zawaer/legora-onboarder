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

## 2. Do the cheap things first, in this order

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

## 3. Do we need SOC 2? Probably not. Possibly ISO 27001, later.

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

## 4. Hosting: multi-tenant SaaS, EU-hosted. Not on customer servers.

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

## 5. What to say

> Vanav runs EU-hosted. Model inference runs on Amazon Bedrock in an EU region
> under AWS's terms, with zero data retention — your content is not stored after
> processing and is never used to train models. Anthropic and AWS are listed
> sub-processors in our DPA.

This answers Jussi's GDPR condition, most of Satu's data-security question, and
a large part of whatever Juha's reviewer asks. Costs a configuration choice and
some paperwork, not a rearchitecture. Region rationale: `model-costs.md` §2.

## 6. Still open

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
