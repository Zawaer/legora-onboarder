# People

Live relationships and what each one is waiting on. Salvaged from the
hackathon-era `judges.md` and `traction.md` before those were deleted, plus
everything since.

Last updated **2 September 2026**.

---

## Signed LOIs

Four signed, 29–30 August, all in `livemode` via the room. **None have been
replied to yet — that is the most urgent thing in this repo.**

### Netprofile — Juha Frey, Managing Director
`juha@netprofile.fi`

Wants a **paid pilot**, on the promise of easing onboarding with living
documentation *and* pointing out outdated information in official onboarding
materials.

**Blocked on:** an independent third-party review of how data is handled and
security ensured.

The only one who said "paid". Highest priority. The security blocker probably
resolves with a pen test plus a DPA rather than a certification — Wojtek's read
is that pen tests almost automatically pass on a decent cloud provider, and that
posture is mostly documentation. Ask which of three he means: his own IT partner
reviewing us, a pen test report from our side, or a formal certification.

Signed 30 August, 06:32 UTC. Safe in Supabase; the local `data/lois.json` was
stale and has been re-synced from the database.

### Tonava Group — JP Virtanen, Chairman of the Board
`jp@tonava.fi`

Wants to find out how this could help with **customer** onboarding.
**Blocked on:** *"It is ready."*

No security gate — the fastest path to a live pilot. Two catches: as Chairman he
is a sponsor, not the operator, so ask who inside Tonava would run it; and
customer onboarding is a different product from employee onboarding. See
`competitors.md` → Lumi for why chasing that market is a bad trade.

### Apukuski — Jussi Luhtasela, COO
`jussi@apukuski.com`

Wants a pilot with their new employees.
**Blocked on:** connecting to Slack, connecting to their **Apukuski AI Brain (in
GitHub)**, and GDPR compliance.

The GitHub brain is not a bespoke ask — it is a documentation connector, and
`ingestGitHubRepo(url)` is generic where `syncApukuskiBrain()` is not. Ask what
is in it: how many files, what structure, how often it changes.

### Fermion Oy — Satu Vartiainen, VP Quality Management
`satu.vartiainen@fermion.fi`

Wants to explore a pilot with a suitable onboarding cohort.
**Blocked on:** *"sufficient maturity … functionality, data security and fit."*

Pharma, so real regulatory process and the slowest cycle of the four. Best logo,
longest game. The job of the first email is to turn a vague blocker into a
written checklist: *"what specifically would you need to see?"*

---

## Prospects and validators

### Teemu Myllymäki — Measurlabs
Described the problem unprompted and better than our own pitch did:

> *"Monissa firmoissa on edelleen paljon hiljaista tietoa mikä on vanhempien
> työntekijöiden päässä eikä dokumentoituna minnekään … kaikki dokumentaatio on
> vanhentunutta. Organisaatiolla pitäis olla jatkuvasti oppiva central brain,
> joka pysyy ajantasalla ilman että kukaan erikseen päivittää sitä."*

This is the source of the positioning in `competitors.md`. Not yet a customer —
*"meil ei oo tollasta mut olis hyödyllinen"*. Worth a real conversation.

### Joseph Cassidy — Legora
People Enablement Partner / Senior Talent Partner. Ex-Lovable, ex-Pleo. His own
profile says "optimizing onboarding" — he is the buyer, not a random contact.

The original source of the problem: most roles they hire for have never existed
at Legora before, so there is no playbook, and nobody has time to look after new
hires. Documentation can't fix it and a spare person can't fix it either.

First-degree connection of a teammate. **One sender only** — the teammate he
already knows. Three people messaging the same company reads as a mail merge.

A chat was agreed for the week after the hackathon. Follow up.

---

## Ecosystem

### Wojtek Szkutnik — Founder & CEO, Prelint (SYE judge)
LinkedIn 1st degree. Actively corresponding as of 1 September 2026.

Software engineer and architect by background, MBA. Prelint prevents product
drift in AI-written code. **As COO at Talixo he scaled from 3 to 100+ employees
across the world** — he has personally been the manager with no time, onboarding
people into roles that did not exist the previous quarter. One of the most
likely people to believe the problem on sight.

Partners with hackathons in 20+ cities; publicly offers his time.

**Given so far:** €10k AWS credits, confirmed to cover Bedrock. The Vercel AI
Gateway tip (declined — see `model-costs.md` §7). ComplyJet for SOC 2, ~2
months. His read that security posture is mostly documentation and pen tests
are near-automatic to pass.

**Open with him:** whether part of the €10k is usable as cash for non-AWS costs,
and how to actually claim it.

He went through SOC 2 recently and is the cheapest good source on the question
blocking three of our LOIs. Note his own warning: never send a SOC 2 report
without an NDA — it documents your architecture in detail.

### Charles Maddock — Co-founder & CEO, Strawberry (SYE judge)
Source of the quote used publicly:

> *"If you just put in the blood, sweat and tears, this will actually be huge."*

---

## Rules

- **One sender per company.** Whoever has the relationship owns it.
- Log what each contact is blocked on, here, when it changes. A blocker nobody
  wrote down is a pilot nobody closes.
