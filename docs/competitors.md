# Competitors

Extends `DECISIONS.md` §8, which established the three-way split. This file is
where new ones get filed so they stop being debated at midnight.

Last reviewed **1 September 2026**.

---

## The test

**Mechanism similarity is not competition. Buyer overlap is.**

"Reads state, nudges a person toward a goal" describes a large fraction of B2B
software. Before anything goes in this file, answer one question:

> Would the person who signs our invoice consider buying this instead?

If no, it is not a competitor. It may still be worth reading — for positioning
language, for pricing reference, for what they publish to pass a security
review — but it does not change what we build.

## The rule

1. Competitors get reviewed **once a week, in this file.** Not per launch post.
2. We change what we build **only when a customer names them.** A LinkedIn
   launch is not a signal; "we're also evaluating X" from Juha is.
3. Anything found in between gets a stub at the bottom and waits.

Reacting to every launch costs an evening and some morale, and the launches
never stop.

## The map

| Category | Who | Buys it | Overlap |
| --- | --- | --- | --- |
| HR / provisioning | Rippling, BambooHR, Deel, Leena, **Beam AI** | HR & IT ops | Low — the other half of onboarding |
| Retrieval / search | **Glean**, Sana, Moveworks, Copilot | IT / enterprise | Real, but priced above our segment |
| Training docs | Trainual, Continu | L&D | Low |
| Adoption agents | **Lumi (Userlens)** | Growth / PLG | None — different subject |
| Platform | **Slack AI** | Already installed | The long-term one |
| DIY | "just point Claude at our docs" | Our buyer | The most common competitor we face |

**Every one of them takes the role as an input.** We derive it. That is still
the wedge.

---

## Glean

Enterprise search plus AI across every internal tool. Customers include Zillow,
Intuit, Samsung, Databricks, Booking.com.

> **Corrected 2 September 2026.** This entry previously called Glean adjacent
> rather than competing. **Glean ships a personalised onboarding agent** —
> firsthand, from Ohto Pentikäinen at Oura, who uses it. Do not say "they don't
> do onboarding" in a pitch.

**Why it is still not the immediate threat:** Oura is ~1000 people. That logo
wall tells you their minimum deal size — enterprise AE, solutions engineer,
procurement, security review costs more per deal than our entire ACV. They
structurally cannot sell to Netprofile or Apukuski. The segment argument
survives; the feature argument does not.

**When it becomes one:** if they move down-market after saturating enterprise.
A three-to-five year problem.

**Difference to state out loud:** horizontal search answers questions *from
documentation*. Documentation is stale. We stay current and flag what has gone
out of date.

## Sana (acquired by Workday)

Swedish, onboarding material and learning. Used at Oura alongside Glean.

## What a real user of both actually said

Ohto Pentikäinen (Oura), and Touko via Maire, 2 September 2026 — the most
valuable competitive input we have, and it came from two LinkedIn DMs.

**The Q&A half works.** Touko: *"silt voi just kysyy firman sisäisii kysymyksii
ja saa niihin aika hyvin vastauksii."* Ohto on both tools: *"toimii mulle
hyvin!"*

So answering questions from company context is **table stakes, not our
differentiation.** Stop selling on it.

**The onboarding half annoyed him.** Touko: *"toi onboarding ominaisuus
lähettelee jotai ilmotuksii mikä oli ärsyttävää… siel on jotai sellasii
onboarding kurssei mitä pitää tehä… kattoo jotai videoit."*

Assigned courses, videos, notifications. Compliance theatre — the same
bureaucratic-HR-tool pattern Nia identified in Beam, and exactly the failure
mode in `DECISIONS.md` §13: push too much and people mute you, which is
terminal because the channel is all we have.

**The gap, in one line:** they push tasks *at* people. We derive real work from
what the company actually does, and escalate to a human when we cannot help.
A named user of the market leader has confirmed the gap is real. This is the
"something we know that competitors don't" the SYE judge asked for.

## Also building this — early stage

Teemu Myllymäki (Measurlabs), 2 September 2026:

> Aika moni rakentaa jotain company brainin kaltaista Clauden sisään
> skilleiksi/memoryyn mut kaikki mitä oon kuullu on aika alkuvaiheessa. Eilen
> juttelin Green Planet Astronautsin Millan kanssa ja ne mm. tekee tollaista.
> Salee joku Realm on aika pitkällä mut en tunne niitä niin hyvin

Everyone is building it, everyone is early. Both the validation and the
warning: defensibility is not the capability (`DECISIONS.md` §13).

### Green Planet Astronauts (found 2 Sept, via Teemu)
What it is: building something company-brain-like. Contact: Milla.
Buyer overlap with us: unknown. Worth stealing: unknown.

### Realm (found 2 Sept, via Teemu)
What it is: possibly further along than others, per Teemu, who does not know
them well. Buyer overlap with us: unknown.

## Beam AI

Onboarding agent that does IT provisioning, paperwork chase, orientation
scheduling, manager nudges. Integrates Workday, BambooHR, ServiceNow, Okta.

**Different half of the problem.** They get the laptop ordered; the new hire
still doesn't know how anything works. "Answers new hire questions 24/7" is
their eighth bullet and our whole product.

**Read their page carefully:** the product screenshots on their onboarding page
show order-form extraction, three times. Templated landing page per vertical.
Do not treat their feature list as a spec.

**Their weakness is time to value.** Discovery workshops, 30–50 example test
dataset, four phases, ten days. Ours is a Slack bot in thirty seconds with no
procurement. Nia's read of HR tools as "bureaucratic" is exactly this.

**Steal:** their Trust Center. It is a worked example of what a competitor
publishes to satisfy the security review currently blocking three of our LOIs.

## Lumi (Userlens, YC P26)

Launched 1 September 2026. An adoption agent: reads **your customers'** usage
behavior inside **your SaaS product** and nudges them toward a goal. Replaces
drip campaigns and chasing at-risk users. Buyer is a growth or PLG team.

**Not a competitor.** Different subject (their customers vs. our employees),
different data (product telemetry vs. internal company knowledge), different
buyer, different budget. The mechanism rhymes; nothing else does.

**Where it becomes one:** if we chase **customer** onboarding. JP Virtanen at
Tonava asked about exactly that. In that market we would have no data advantage
— we do not have their product telemetry — against a YC-funded incumbent. This
is an argument for keeping Tonava scoped to employee onboarding.

**Steal — their positioning sentence:**

> "The problem is not knowing what happened. The problem is getting the next
> best action to happen, one person at a time, at scale."

Ours against the retrieval tools: *the problem is not finding the document, it
is knowing what to do next.*

## Slack AI

We live on their platform, so deeper native search-and-answer is real platform
risk. Have an answer before an investor asks.

The usual shape: a platform builds the generic 80%, specialists own the deep
vertical. We should be able to say specifically why that holds here — our
answer is that we derive a role and build a ramp of real work, which is not a
search feature.

## "Just point Claude at our docs"

The most common competitor we actually face, and it never appears on a landing
page. Toivo's own question, and Wojtek's feedback at SYE.

Answer: documentation is stale the moment it is written. A model pointed at
stale docs confidently repeats stale answers. The product is the brain staying
current without anyone maintaining it — and telling you which docs have rotted.

---

## Positioning

**Yrityksen central brain.** Onboarding is the wedge — the first and most
painful moment a company needs one — but the brain is the product.

Viia landed on this phrase on 1 September. Teemu Myllymäki at Measurlabs used
the same one unprompted, in writing, days earlier:

> *"Organisaatiolla pitäis olla jatkuvasti oppiva central brain, joka pysyy
> ajantasalla ilman että kukaan erikseen päivittää sitä."*

When a prospect and a founder independently reach for the same words, stop
searching. Not "AI onboarding tool", not "organizational intelligence".

---

## Filing a new one

Add a stub here. Do not act on it until the weekly review.

```
### Name (found DD Month, by whom)
What it is:
Who buys it:
Buyer overlap with us: yes / no / conditional on ___
Worth stealing:
```
