# Data Processing Agreement — draft

GDPR Article 28. `security.md` §2 item 5. Drafted 2 September 2026.

> ⚠️ **Two things before this is sent to anyone.**
>
> **1. A lawyer has to read it.** This is a competent structure written against
> Art. 28, not legal advice, and it is going to a pharma quality function.
> Avance is a Finnish law firm we already have a conversation open with
> (`contacts.md`) — a review is cheap for them and is the fastest route to a
> version we can sign. Ask them.
>
> **2. There is no company to sign it.** Today the counterparty would be Toivo
> Kallio personally, which means personal liability for a data breach at a
> customer. **Do not sign a DPA before the Oy exists.** This now blocks two
> things — the other is the €100k Sprint Grant (`funding.md` §2).
>
> Annex III is also wrong until Bedrock EU is switched on; see the note there.

---

**Controller:** the Customer.
**Processor:** Vanav (`[Oy name], [business ID]`).

This Agreement applies whenever the Processor processes personal data on behalf
of the Controller in connection with the Vanav service, and forms part of the
agreement between the parties.

## 1. Subject matter and duration

The Processor processes personal data solely to provide the Vanav service:
deriving a role from the Controller's own material, generating onboarding
guidance, and answering questions from that material.

Processing lasts for the term of the service agreement, and ends on its
termination, subject to clause 9.

## 2. Instructions

The Processor processes personal data only on the Controller's documented
instructions, including on transfers to a third country, unless required
otherwise by Union or Member State law — in which case the Processor informs
the Controller before processing, unless that law prohibits it.

The Controller's instructions are given by its use of the service and by the
configuration it chooses, including which Slack channels the Processor is
invited into and what material it uploads.

The Processor informs the Controller if, in its opinion, an instruction
infringes the GDPR.

## 3. Confidentiality

The Processor ensures that persons authorised to process the personal data are
bound by confidentiality and are informed of the confidential nature of the
data. Access is limited to those who need it to provide the service; see Annex
II.

## 4. Security

The Processor implements appropriate technical and organisational measures
under Art. 32. The measures in force are described in Annex II, which states
plainly both what is implemented and what is not.

## 5. Sub-processors

The Controller gives general authorisation for the sub-processors listed in
Annex III. The Processor informs the Controller of any intended addition or
replacement at least **30 days** in advance, and the Controller may object on
reasonable data-protection grounds; if the objection cannot be resolved, the
Controller may terminate the service agreement without penalty.

The Processor imposes on each sub-processor data-protection obligations no less
protective than those in this Agreement, and remains fully liable for their
performance.

## 6. Data subject rights

Taking the nature of the processing into account, the Processor assists the
Controller by appropriate technical and organisational measures, insofar as
possible, in fulfilling the Controller's obligation to respond to requests to
exercise data subject rights. Requests received directly by the Processor are
forwarded to the Controller without undue delay and are not actioned
independently.

## 7. Assistance

The Processor assists the Controller in ensuring compliance with Arts. 32–36,
taking into account the nature of processing and the information available to
it. The Processor notifies the Controller **without undue delay and in any
event within 48 hours** of becoming aware of a personal data breach, with the
information available at that time and further information as it emerges.

## 8. Audit

The Processor makes available to the Controller all information necessary to
demonstrate compliance with Art. 28, and allows for and contributes to audits,
including inspections, conducted by the Controller or an auditor it mandates.

Where the Processor holds a current independent security assessment or
certification covering the service, providing it satisfies this clause unless
the Controller has specific grounds for further inspection.

## 9. Deletion and return

On termination, and at the Controller's choice, the Processor deletes or
returns all personal data and deletes existing copies, unless Union or Member
State law requires storage.

Deletion on request during the term is available at any time. In one operation
the Processor removes the material the Controller provided, any files it
uploaded, and its account record. Completed **within 30 days** and in practice
within a few working days.

Honest limit: a running server instance may retain material in memory until it
recycles. The Processor redeploys following an erasure where immediacy is
required.

## 10. International transfers

Where personal data is transferred outside the EEA, the transfer is made under
an adequacy decision or the European Commission's Standard Contractual Clauses,
which are incorporated by reference. Current transfers are stated in Annex III.

---

# Annex I — Details of processing

**Categories of data subjects.** The Controller's employees, in particular new
hires being onboarded, and other personnel appearing in the material the
Controller provides.

**Types of personal data.** Names, work email addresses, job titles, team and
role information, and the content of workplace communications and documents the
Controller supplies or invites the Processor to read. **Special categories of
data are not required by the service and should not be provided.**

**Nature and purpose.** Storage, retrieval, analysis and generation of text in
order to derive a role, build an onboarding plan and answer questions from the
Controller's own material.

**Duration.** The term of the service agreement, plus the deletion period in
clause 9.

# Annex II — Technical and organisational measures

- **Storage location.** Postgres database and file storage hosted in Stockholm,
  Sweden.
- **Encryption.** In transit (TLS) and at rest, as provided by the hosting
  platform.
- **Access control.** Row level security is enabled on every table, scoping rows
  to the company a user belongs to.
- **Privileged access.** One administrative credential exists that bypasses row
  level security, held by a single named individual — the technical founder. It
  is used only to investigate a reported fault, execute a deletion request, or
  run database migrations. No other person holds it. It is rotated when a holder
  leaves and immediately on any suspicion of exposure.
- **Minimisation of collection.** Nothing is collected automatically. The Slack
  application reads only channels it is explicitly invited into; it is never in
  a private channel unless added, and never has access to direct messages
  between the Controller's personnel. Removal from a channel ends access
  immediately.
- **Not implemented, stated deliberately.** There is no automated audit log of
  privileged queries. At the Processor's current size, privileged access is
  limited by there being one person able to perform it. Logging will be
  introduced before that ceases to be true.
- **No training on Controller data.** Neither the Processor nor its model
  sub-processors train models on content processed through the service.

# Annex III — Sub-processors

| Sub-processor | Purpose | Location |
| --- | --- | --- |
| Supabase | Database and file storage | Stockholm, EU |
| Vercel | Application hosting; cookieless page analytics | US company, EU-served |
| Anthropic | Model inference | **United States** |
| Slack | Delivery surface | Controller's own workspace and agreement |
| Stripe | Payment processing (billing data only) | — |
| Resend | Transactional email | — |

> ⚠️ **The Anthropic row is the open issue.** Model inference currently takes
> place in the United States, which is a third-country transfer requiring
> Standard Contractual Clauses under clause 10. Those are not yet executed.
>
> Switching inference to Amazon Bedrock in an EU region removes the transfer
> entirely and this annex becomes: *AWS — model inference — EU region.* The code
> path is built and gated on `AWS_BEDROCK_REGION`; it is not switched on
> (`security.md` §2 item 0b).
>
> **Until it is, either execute the SCCs or do not sign a DPA.** Signing one
> that promises lawful transfers we have not papered is worse than having no
> DPA at all.
