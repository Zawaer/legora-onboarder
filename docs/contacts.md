# People

Live relationships, verbatim. **Rule: paste the original message, do not
summarise it.** A paraphrase loses the exact words, and the exact words are what
we build against — Juha wrote "independent third-party review", not "security
stuff", and the difference is thousands of euros.

Salvaged from the hackathon-era `judges.md` and `traction.md` before those were
deleted, plus everything since. Last updated **2 September 2026**.

---

# Signed LOIs

Four, all `livemode`, all via the room. Verbatim from Supabase `lois`.

## Netprofile — Juha Frey, Managing Director
`juha@netprofile.fi` · signed 2026-08-30 06:32:13 UTC · `88f8e8ec-6067-4338-bc3f-176dc43e7e00`

> **Intends to:** run a paid pilot with the Vanav tool based on the promise of
> not only easing onboarding with living documentation but also pointing
> outdated information in official onboarding materials
>
> **Blocked on:** they provide an independent third-party review of how data is
> handled and security ensured.

Also signed the waitlist from the landing page, 06:33 UTC, same address.

**The only one who said paid.** Highest priority. Ask which of three he means —
his own IT partner reviewing us, a pen test from our side, or a formal
certification (`security.md` §4). Offering all three lets him pick the cheapest
that satisfies him rather than reaching for the most formal-sounding.

**Outbound — Toivo, 2 September 2026:**

> Hei Juha,
>
> Kiitos aiekirjeestä ja siitä, että kerroit suoraan mitä tarvitsette.
>
> Mainitsit, että tarvitsette riippumattoman, kolmannen osapuolen arvion siitä
> miten dataa käsitellään ja miten tietoturva on varmistettu. Mikä seuraavista
> olisi teille sopivin?
>
> - Oma IT-kumppaninne arvioi tuotteemme turvallisuutta ja tietojenkäsittelyä
> - Teetämme riippumattoman penetraatiotestin ja toimitamme raportin teille
> - Tarvitsette virallisen sertifioinnin (esim. ISO 27001)
>
> Tai sopisiko paremmin pienimuotoinen ja rajattu pilotti, jossa
> luottamukselliset tiedot jätetään pois? Näin päästäisiin nopeasti alkuun ja
> samalla kartoitettaisiin teidän tarkat tarpeet.
>
> Jos on helpompi jutella, niin sopisiko 30 minuutin puhelu tällä viikolla?
> Tulemme mielellämme myös Netprofilen toimistolle, jos se teille sopii.
>
> Terveisin,
> Toivo Kallio
> vanav.io
> +358 40 185 8122

**Waiting on:** which of the three he picks. That answer sets the compliance
budget and timeline — `security.md` §2 item 8.

## Tonava Group — Virtanen JP, Chairman of the Board
`jp@tonava.fi` · signed 2026-08-29 18:14:05 UTC · `ccf174e8-6eb4-4590-9331-538126438808`

> **Intends to:** find out how this could help us also with customer onboarding
>
> **Blocked on:** It is ready.

No security gate — the fastest path to a live pilot. Two catches: as Chairman he
is a sponsor, not the operator, so ask who inside Tonava would run it. And
customer onboarding is a different product from employee onboarding — see
`competitors.md` → Lumi for why chasing that market is a bad trade.

**Outbound: Viia, 29 Aug, subject "Pilotin kokeilu". No reply as of 2 Sept.**
Viia owns this relationship — one sender per company. Transcribed from a
screenshot, so may contain small errors:

> Hei JP,
>
> Kiitos paljon vastauksesta ja kiinnostuksesta meidän tuotetta kohtaan.
> Olisitteko kiinnostuneet hyppäämään mukaan pilottiversioon, jolloin voitaisiin
> jatkaa tuotteen kehittämistä teidän tarpeiden pohjalta?
>
> Pilotti on lähes valmis slack-pohjaisena eli kokeilu toimisi ainakin, jos
> teillä olisi slack yrityksessä valmiiksi käytössä.
>
> Mukavaa viikonloppua!
>
> Parhain terveisin,
>
> Viia || vanav.io
> +358 40 175 0443

Two notes for the follow-up, not criticism of the above: it asks him to join a
pilot without addressing the condition he actually wrote down, and *"pilotti on
lähes valmis"* confirms the hesitation of a man whose stated blocker is that it
be ready. Also note Viia already asked the Slack question and got no answer.

## Apukuski — Jussi Luhtasela, Chief Operating Officer
`jussi@apukuski.com` · signed 2026-08-29 18:02:23 UTC · `0875b5d1-1423-47ab-bc5d-0f58ab083a57`

> **Intends to:** Run an pilot with our new employees
>
> **Blocked on:** It connects to Slack, to our Apukuski AI Brain (in GitHub) and
> GDPR compliant

The GitHub brain is not a bespoke ask — it is a documentation connector, and
`ingestGitHubRepo(url)` is generic where `syncApukuskiBrain()` is not
(`DECISIONS.md` §14). Ask what is in it: how many files, what structure, how
often it changes.

**Outbound — Toivo, 2 September 2026:**

> Hei Jussi,
>
> Kiitos aiekirjeestä ja siitä, että kerroit suoraan mitä tarvitsette.
>
> Vastauksena:
>
> - Vanav elää Slackissa Slack bottina, eli integraatio on helppoa.
> - Data säilytetään Ruotsissa, ja kielimallin ajo tulee siirtymään EU:n sisälle
>   eikä mitään dataanne käytetä koskaan ulkoisten kielimallien kouluttamiseen.
> - Apukuski AI Brainiin integraatio onnistuu. Millainen sen rakenne siis on?
>   Kuinka usein se muuttuu ja kuka sitä päivittää?
>
> Jos on helpompi jutella, niin sopisiko 30 minuutin puhelu tällä viikolla?
>
> Terveisin,
> Toivo Kallio
> vanav.io
> +358 40 185 8122

**Note — no document was promised.** An earlier draft committed to sending a
full data-handling write-up this week; that sentence was cut before sending. The
email asserts our data practices without offering anything to show, and his
blocker says "GDPR compliant". Expect him to ask for something in writing.

**Waiting on:** the Brain's structure, change frequency, and owner.

## Fermion Oy — Satu Vartiainen, VP, Quality Management
`satu.vartiainen@fermion.fi` · signed 2026-08-29 18:02:33 UTC · `82099862-26f6-45fc-a8ca-c1ab5fbf473f`

> **Intends to:** explore the potential for a pilot of Vanav with a suitable
> onboarding cohort
>
> **Blocked on:** the solution has reached sufficient maturity for us to
> evaluate its functionality, data security and fit with our onboarding needs

Pharma, so real regulatory process and the slowest cycle of the four. Best logo,
longest game. The job of the first email is to turn a vague blocker into a
written checklist: *"what specifically would you need to see?"*

**Outbound — Toivo, 2 September 2026:**

> Hei Satu,
>
> Kiitos aiekirjeestä.
>
> Mitä teidän tarvitsisi konkreettisesti nähdä ennen kuin voisitte arvioida tätä
> kunnolla? Karkea lista riittää hyvin.
>
> Oletan että tietoturvadokumentaatio on listalla, ja työstämme sitä
> parhaillaan: data tallennetaan Ruotsissa ja kielimallin ajo tulee tapahtumaan
> EU-alueella. Mitään dataanne ei käytetä ulkoisten kielimallien koulutukseen.
>
> Auttaisi myös tietää minkä työkalujen rinnalla tämän pitäisi toimia. Onko
> Fermion Teamsissa, Slackissa vai muualla?
>
> Jos on helpompi jutella, niin sopisiko 30 minuutin puhelu tällä tai ensi
> viikolla? Voimme myös palata asiaan myöhemmin, kun täytämme teidän
> kriteerinne kunnolla.
>
> Terveisin,
> Toivo Kallio
> vanav.io
> +358 40 185 8122

**Deliberately did not name a certification.** She wrote "sufficient maturity",
which is vaguer and probably cheaper than ISO 27001. Naming it ourselves would
have put the most expensive option in her mouth. Let her set the bar.

**Waiting on:** her written list, and whether Fermion is on Teams or Slack.

---

# Prospects and validators

## Teemu Myllymäki — Measurlabs

Described the problem unprompted, and better than our own pitch did. This is the
source of the positioning in `competitors.md` and of the stale-documentation
thesis. Verbatim:

> Tuntuu et mitä nopeemmin työntekijä pääsee kiinni oikeisiin
> asiakasprojekteihin ja ns. "Härkää sarvista" ni sitä nopeemmin ne pääsee
> tuloksiin.
>
> Sit monissa firmoissa (meilläkin) on edelleen paljon hiljaista tietoa mikä on
> vanhempien työntekijöiden päässä eikä dokumentoituna minnekään. Sen tiedon
> siirtyminen uusille on hidasta. Ratkaisu ei voi olla se että vaan
> dokumentoidaan noi asiat, koska asiat muuttuu jatkuvasti ni kaikki
> dokumentaatio on siks vanhentunutta.
>
> Organisaatiolla pitäis olla jatkuvasti oppiva central brain, joka pysyy
> ajantasalla ilman että kukaan erikseen päivittää sitä.
>
> Jokaiselle uudelle työntekijälle sit luodaan räätälöity onboarding plan
> tehtävästä, taustasta ja kokemuksesta riippuen.
>
> Meil siis ei oo tollasta mut olis hyödyllinen ja uskon että tulevaisuudessa
> noita on olemassa

Not yet a customer — *"meil ei oo tollasta mut olis hyödyllinen"*. Worth a real
conversation. Measurlabs is also exactly the profile in `DECISIONS.md` §11: not
hyper-growth, and has the problem anyway.

## Joseph Cassidy — Legora

People Enablement Partner / Senior Talent Partner. Ex-Lovable, ex-Pleo. His own
profile says "optimizing onboarding" — he is the buyer, not a random contact.

The original source of the problem, as recorded during the hackathon: most roles
they hire for have never existed at Legora before, so there is no playbook, and
nobody has time to look after new hires. Documentation can't fix it and a spare
person can't fix it either.

First-degree connection of a teammate. **One sender only** — the teammate he
already knows. Three people messaging the same company reads as a mail merge.

A chat was agreed for the week after the hackathon. Follow up.

---

# Ecosystem

## Wojtek Szkutnik — Founder & CEO, Prelint (SYE judge)

LinkedIn 1st degree. Software engineer and architect by background, MBA. Prelint
prevents product drift in AI-written code. **As COO at Talixo he scaled from 3
to 100+ employees across the world** — he has personally been the manager with
no time, onboarding people into roles that did not exist the previous quarter.
One of the most likely people to believe the problem on sight. Partners with
hackathons in 20+ cities and publicly offers his time.

**Toivo → Wojtek, LinkedIn, 1 Sept 22:56:**

> hey! thanks for the advice during the SYE hackathon! as you pointed out, we're
> gonna figure out how to make sure our product isn't just Claude connected to
> some documents.
>
> we would definitely be interested in the AWS credits though, they'd be super
> useful for running our backend. also, did you say that a portion of that money
> can be used for non-AWS stuff? and do they cover Bedrock model usage or infra
> only?
>
> also i saw you posted about going through SOC 2 recently. at our stage, what
> actually satisfies someone asking for an "independent third-party security
> review"? a pen test plus a DPA, or do they hold out for real certification?

**Wojtek → Toivo, 1 Sept 23:12:**

> hey hey! it does cover bedrock
>
> you can even use bedrock credits with a third party gateway like vercel ai
> gateway
>
> for SOC we use https://www.complyjet.com/ , they are pretty reputable and not
> cost a lot, you can do it in 2 months or so if you try to
>
> but security posture and soc is in general a lot of waving hands and
> documentation
>
> pen tests are easy because you kind of get a basic automated audit and if you
> use a decent cloud provider this almost automatically passes unless you do
> something really stupid

Consequences: `model-costs.md` §7 (credits, and why we declined the gateway) and
`security.md` §1 and §4.

**Still open with him:** whether part of the €10k is usable as cash for non-AWS
costs, and how to claim it. Asked, not answered.

Note his own warning, from a LinkedIn post: never send a SOC 2 report without an
NDA — it documents architecture, infrastructure and data flows in detail, and
competitors request them for exactly that reason.

## Charles Maddock — Co-founder & CEO, Strawberry (SYE judge)

> If you just put in the blood, sweat and tears, this will actually be huge

Two further judge remarks, recorded without attribution: *"this has actually
huge potential"* and *"don't stop working on this one"*.

## Unattributed judge feedback — SYE, 30 Aug

The source of the market correction in `DECISIONS.md` §11. Recorded as given:

> there's only a few super rapidly growing companies who have to hire multiple
> people super quickly (like 50 people per week for Legora). Lovable, Legora and
> maybe a few others. it doesn't serve us if we restrict ourselves to only sell
> to these niche hyper growth companies. it would make more sense to figure out
> how we can make our product usable for small companies as well. so our product
> could be like a general onboarding tool.
>
> what prevents legora or lovable just building a tool like this for themselves
> internally?
>
> on the other hand, businesses usually want to focus on their actual business,
> so they don't always bother making tools for themselves internally cuz that's
> not their core business
>
> we must be able to convince the businesses on why our product is superior, why
> they would use it and how they benefit from them
>
> we must find something to use in our advantage, for example if we knew
> something our competitors don't know, that'd be valuable.
>
> we must talk to customers and get measurable data, for example, we should ask
> potential customers how much would they be willing to pay for a tool like
> this. measurable data is important.
>
> also because we dont have experience in hyper growth startups, talking to our
> customers is soo important.

We took the TAM point and rejected the conclusion — see `DECISIONS.md` §11 on
why "a general onboarding tool" is the trap rather than the fix.

---

# Rules

- **Paste the original.** Full message, verbatim, with date and sender. Never a
  summary. If it came from a screenshot, say so.
- **One sender per company.** Whoever has the relationship owns it. Viia owns
  Tonava.
- **Log every outbound here, the day it goes out.** On 2 September the technical
  founder nearly sent JP a duplicate of an email Viia had sent four days
  earlier, because nobody had written it down.
- **Log what each contact is blocked on, and update it when it changes.** A
  blocker nobody wrote down is a pilot nobody closes.
- **Ask on every call**, and write the numbers here:
  1. What does onboarding one person cost you today, in hours of other people's
     time?
  2. Flat monthly fee, or per person onboarded?
