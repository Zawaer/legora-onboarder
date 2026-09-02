# Data processing

**This is the document customers ask for.** `security.md` §2 items 1 and 2.
Written 2 September 2026, against what the system actually does today.

> ⚠️ **Lines marked `PENDING` are not true yet.** Do not send this to a customer
> with those still in it — either finish the work or cut the line. Everything
> else describes the system as it is.

---

## 1. What we receive

**Two channels, both deliberate. We do not crawl anything.**

### The corpus you give us

A company's context reaches us by upload or paste — a Slack export, a CSV, a
document, text pasted into the ingest screen (`lib/ingest/parse.ts`). Nothing is
collected automatically. You choose what to hand over and can hand over less.

Typically: message history from the channels you select, internal documents,
tickets. It contains whatever you put in it, including names of employees and
whatever they wrote.

### The Slack app

The Vanav Slack app requests five scopes and no more
(`docs/slack-manifest.yaml`):

| Scope | What it permits |
| --- | --- |
| `chat:write` | post messages |
| `im:write` | open a direct message with a new hire |
| `im:history` | read the new hire's replies **in their DM with the bot** |
| `commands` | receive `/onboard` |
| `app_mentions:read` | see messages that explicitly `@Vanav` |

Today the app has no `channels:history`, so it reads nothing beyond the new
hire's own DM and explicit mentions.

> ⚠️ **Do not build the pitch on that.** A corpus that arrives by upload is a
> snapshot, and a snapshot goes stale the moment it lands — which is the exact
> problem we sell against. Detecting that documentation has drifted requires
> reading the channels as they change, so `channels:history` for selected
> channels is on the roadmap. Telling a reviewer "we cannot read your channels"
> and then asking for that scope in six weeks reads as a bait-and-switch, and it
> would cost more than the reassurance is worth.

**The durable claim, which is true now and stays true after scopes widen:**

> Vanav reads only the channels you explicitly invite it into. A Slack bot sees
> history for channels it is a member of — not your whole workspace. It is never
> in a private channel unless someone adds it, it never sees direct messages
> between employees, and removing it from a channel ends its access immediately.

That is customer-controlled access rather than a promise about a manifest we
intend to change, and it is the version to put in front of a reviewer.

## 2. Where it goes, and where it is processed

| | Where | Notes |
| --- | --- | --- |
| Application | Vercel | Serverless, EU-served |
| Database | Supabase Postgres, **Stockholm** | Companies, members, drafts, uploaded material references, key-value store, letters of intent |
| Uploaded files | Supabase Storage, **Stockholm** | |
| Model inference | **Anthropic API (United States)** | `PENDING` — moving to Amazon Bedrock in an EU region. Code path is built; the switch is not on. `security.md` §2.1 |

**The inference row is the honest weak point today** and the reason §2.1 puts
that migration ahead of this document. Until it is switched on, this row says
the United States. Do not write otherwise.

## 3. Sub-processors

| Sub-processor | Purpose | Where |
| --- | --- | --- |
| Vercel | Application hosting, and privacy-preserving page analytics | US company |
| Supabase | Postgres database and file storage | Data in Stockholm |
| Anthropic | Model inference | US — `PENDING` replacement by AWS below |
| Amazon Web Services | Model inference via Bedrock | `PENDING` — EU region |
| Slack | The surface the agent runs on | Your own workspace, your existing agreement |
| Stripe | Payments | Billing data only, never customer content |
| Resend | Transactional email from the product | Addresses and message content only |

Analytics is Vercel's, which is cookieless and sets no tracking identifiers.
**We deliberately do not use Google Analytics** — several EU supervisory
authorities have found its transfers unlawful, and it would contradict this
document.

## 4. Who can access it

Row level security is enabled on every table, with policies scoping rows to the
company a member belongs to (`supabase/schema.sql` — 5 tables, 8 policies). A
signed-in user reaches their own company's rows and no one else's.

A service-role key that bypasses those policies exists for server-side work the
product does on nobody's behalf — a webhook writing a record, the Slack bot
queueing a draft. It is server-only and guarded against being imported into
client code (`lib/supabase.ts`).

`PENDING` — a written internal access policy: who on our side may use that key,
under what circumstances, and how that is logged. Today the honest answer is
"the founders, for support and debugging". Say so if asked; do not imply more.

## 5. Retention and deletion

Content is kept for as long as the company is a customer.

`PENDING` — **deletion is not implemented.** There is no route today that
removes a company's ingested corpus on request, and GDPR requires one. This is
`security.md` §2 item 4, and it must be built before this document is sent,
because the sentence promising it would otherwise be false.

Letters of intent and waitlist signups are retained as business records.

## 6. What we do not do

- We do not use your content to train models. Anthropic and AWS do not train on
  API content, and we do not train anything of our own.
- We do not sell, share or disclose your content to anyone outside the
  sub-processors listed above.
- We do not read your Slack channels — see §1.
- We do not use your content for any purpose other than running Vanav for you.

## 7. Known gaps, stated deliberately

A reviewer who finds a gap you concealed stops trusting the whole document. A
reviewer who reads the gap in your own words usually asks a follow-up question
instead. So:

- Model inference is currently in the United States; the EU migration is built
  but not enabled.
- Deletion on request is not yet implemented.
- We hold no security certification. We can commission an independent
  penetration test on request (`security.md` §4).
- We are a young company. Our data-handling posture is deliberately narrow —
  fewer scopes, less data, less retention — because that is what we can actually
  stand behind.

## 8. Contact

Security and data protection questions: Toivo Kallio, `toivo@stuhi.org`.

`PENDING` — replace with a Vanav address once the Oy exists (`funding.md` §1).
