/**
 * Lexhav — the seed corpus.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS NO ROLE DEFINITION IN THIS FILE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Read all 63 artifacts below and you will not find a job description for
 * "Legal Engineer". No onboarding doc. No "what a Legal Engineer does at
 * Lexhav" page. No competency matrix, no career ladder, no RACI. Not one
 * sentence anywhere that starts "the Legal Engineer is responsible for".
 *
 * That absence is the product.
 *
 * Lexhav went from 40 people to 400 in a year and is going from ~700 to 1,500
 * by the end of 2026. At that speed the org chart is written after the work,
 * not before it. The Legal Engineer role in particular did not exist in the
 * legal industry three years ago — Lexhav largely invented it — so there is no
 * external course to take, no predecessor to shadow, and no internal document
 * to retrieve, because nobody has had a free afternoon to write one. The people
 * who know how to do the job are too busy doing it.
 *
 * A retrieval system fails completely here. There is nothing to retrieve. The
 * only honest way to tell a new hire what their job is, is to *derive* it from
 * the residue of the work: who is arguing with whom about scope, which
 * escalations land on whose desk, what a senior person actually spent Tuesday
 * doing, which ticket got assigned to a lawyer and which to an ML engineer.
 *
 * So the signal is deliberately scattered and never stated:
 *
 *   • Johan builds a bespoke two-step extract-then-classify workflow for a
 *     client whose ask the standard playbook does not cover
 *                                                 (slack-legal-eng-001 → 004)
 *   • Marta refuses to fix an Italian jurisdiction miss with a keyword list and
 *     insists on reading the 12 documents first   (slack-cust-esc-009 → 012,
 *                                                  doc-italian-writeup-054)
 *   • Johan and Priya pair on an SPA prompt: the lawyer owns the failure
 *     taxonomy, the ML engineer owns the harness  (meeting-pairing-039)
 *   • An unresolved argument about whether legal engineers should write code or
 *     write specs                                 (slack-legal-eng-014 → 019)
 *   • Nobody can say who owns the playbook library
 *                                                 (slack-prod-wf-020 → 023)
 *   • The one onboarding doc that does exist is for *engineers*, and it stops
 *     at the door of this team                    (doc-eng-onboarding-013)
 *
 * And the corpus is mostly *noise*, on purpose: a red CI pipeline, a desk move,
 * kanelbullar, a fire alarm test, laptops stuck in customs, an all-hands, a
 * dark corner nobody wants to give up. Real corpora are ~70% irrelevant. An
 * agent that recovers the role from a clean, curated set of five perfect
 * messages has proven nothing. An agent that recovers it from this has proven
 * it can be pointed at a real Slack export on day one.
 *
 * Two things are also deliberately left UNRESOLVED, because they are unresolved
 * at the company:
 *
 *   1. Do legal engineers own the customer relationship, or hand off to
 *      Engagement? Elin and Anders disagree in writing, twice, and nobody
 *      breaks the tie.       (meeting-retro-030, slack-cust-esc-032 → 033)
 *   2. Who owns the playbook library, and who may promote a client fork into
 *      the standard library. (slack-prod-wf-020 → 023, doc-playbook-naming-046)
 *
 * The correct agent behaviour is to surface both as open questions for the
 * hiring manager — not to invent a tidy answer. `DerivedRole.openQuestions`
 * exists in the type system for exactly this. If the agent resolves them, it is
 * hallucinating, and a hiring manager will catch it in ten seconds.
 *
 * Public facts about Lexhav (ARR, headcount, funding, offices, customer count)
 * are accurate as of August 2026 and appear only in `description` and, lightly,
 * in the all-hands notes. Every individual below except Rasmus Thorell is
 * invented, as is every customer name; the words in these artifacts are fiction
 * written to be structurally true, not quotes from real employees.
 */

import type { Artifact, Company, Person } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────── people
//
// `owns` is load-bearing: it is what turns "I'm stuck" into "ask Marta", so
// every entry is something that visibly shows up in the artifacts below.

const people: Person[] = [
  {
    name: "Rasmus Thorell",
    role: "Co-founder & CEO",
    team: "Leadership",
    owns: ["company strategy", "board and investor communication"],
    slackHandle: "@max",
  },
  {
    name: "Elin Sandberg",
    role: "Head of Legal Engineering",
    team: "Legal Engineering",
    owns: [
      "legal engineering team (Stockholm, London, NY, Paris, Seoul)",
      "prompt review queue",
      "M&A and diligence playbooks",
      "legal engineering hiring and onboarding",
    ],
    slackHandle: "@elin",
  },
  {
    name: "Anders Wikström",
    role: "Director of Engagement, EMEA",
    team: "Engagement",
    owns: [
      "customer relationships EMEA",
      "client-specific playbook forks",
      "renewals and expansion accounts",
      "escalation comms to the client",
    ],
    slackHandle: "@anders",
  },
  {
    name: "Johan Lindqvist",
    role: "Senior Legal Engineer",
    team: "Legal Engineering",
    owns: [
      "clause extraction pipeline",
      "share purchase agreement workflows",
      "Nordkap account (technical)",
      "prompt review approvals",
    ],
    slackHandle: "@johan",
  },
  {
    name: "Marta Nowak",
    role: "Legal Engineer",
    team: "Legal Engineering",
    owns: [
      "customer escalations EMEA",
      "jurisdiction edge cases",
      "assignment and change-of-control playbooks",
    ],
    slackHandle: "@marta",
  },
  {
    name: "Priya Raghunathan",
    role: "Staff ML Engineer",
    team: "Applied ML",
    owns: [
      "extraction model quality",
      "eval harness",
      "retrieval and chunking for long documents",
    ],
    slackHandle: "@priya",
  },
  {
    name: "Tobias Hedlund",
    role: "Engineering Manager, Platform",
    team: "Platform",
    owns: [
      "deploy pipeline and CI",
      "workspace infrastructure",
      "repo access and permissions",
    ],
    slackHandle: "@tobias",
  },
  {
    name: "Camille Dufort",
    role: "Legal Engineer, Paris",
    team: "Legal Engineering",
    owns: [
      "French and EU jurisdiction coverage",
      "Paris pilot accounts",
      "civil-law drafting variants",
    ],
    slackHandle: "@camille",
  },
  {
    name: "Sofia Berg",
    role: "Head of People Operations",
    team: "People",
    owns: [
      "onboarding logistics and the buddy sheet",
      "cohort scheduling",
      "Stockholm office and desk allocation",
    ],
    slackHandle: "@sofia",
  },
  {
    name: "Daniel Okafor",
    role: "Legal Engineer, New York",
    team: "Legal Engineering",
    owns: [
      "US customer escalations",
      "multi-office rollout accounts",
      "credit agreement workflows",
    ],
    slackHandle: "@daniel",
  },
  {
    name: "Nina Ekström",
    role: "Product Manager, Workflows",
    team: "Product",
    owns: [
      "workflow builder roadmap",
      "playbook library surface in-product",
      "workflow telemetry",
    ],
    slackHandle: "@nina",
  },
  {
    name: "Rahul Menon",
    role: "Solutions Engineer, Bengaluru",
    team: "Deployment",
    owns: [
      "APAC deployments",
      "tenant configuration",
      "customer data migration",
    ],
    slackHandle: "@rahul",
  },
  {
    name: "Ji-won Park",
    role: "Legal Engineer, Seoul",
    team: "Legal Engineering",
    owns: ["Korean-language document handling", "APAC customer escalations"],
    slackHandle: "@jiwon",
  },
  {
    name: "Frida Alm",
    role: "Technical Recruiter",
    team: "People",
    owns: ["legal engineering hiring pipeline", "cohort start dates"],
    slackHandle: "@frida",
  },
];

// ──────────────────────────────────────────────────────────────── artifacts
//
// Chronological, 2026-08-10 → 2026-08-31. The new hire — an ex-M&A associate,
// six years, no engineering background — starts 2026-09-01.

const artifacts: Artifact[] = [
  // ── Mon 10 Aug ────────────────────────────────────────────────────────────
  {
    id: "slack-legal-eng-001",
    kind: "slack",
    channel: "#legal-eng",
    author: "Johan Lindqvist",
    authorRole: "Senior Legal Engineer",
    timestamp: "2026-08-10T09:12:00+02:00",
    text: "morning. nordkap came back on the change of control thing over the weekend. they dont just want every CoC clause pulled out of the 40 SPAs in the vdr, they want each one flagged as consent-required vs notice-only vs silent. thats not what the standard playbook does, standard one hands back the clause and thats it",
  },
  {
    id: "slack-legal-eng-002",
    kind: "slack",
    channel: "#legal-eng",
    author: "Marta Nowak",
    authorRole: "Legal Engineer",
    timestamp: "2026-08-10T09:19:00+02:00",
    text: "(thread) the consent/notice split is doable but its a judgement call on maybe 1 in 6. swedish drafting is usually explicit about it, the german ones bury it in the assignment clause and you have to read both together to know",
  },
  {
    id: "slack-legal-eng-003",
    kind: "slack",
    channel: "#legal-eng",
    author: "Johan Lindqvist",
    authorRole: "Senior Legal Engineer",
    timestamp: "2026-08-10T09:24:00+02:00",
    text: "(thread) yeah thats exactly what im worried about. plan is two steps — extract, then classify — and i write the classification instructions myself so we're not letting the model decide what \"consent required\" means. can someone from ml tell me if step 2 should be its own call or one schema with a second field",
  },
  {
    id: "slack-legal-eng-004",
    kind: "slack",
    channel: "#legal-eng",
    author: "Priya Raghunathan",
    authorRole: "Staff ML Engineer",
    timestamp: "2026-08-10T09:41:00+02:00",
    text: "(thread) separate call. one schema costs you ~8pp of recall on the extraction because the model starts optimising for the classification field and gets conservative about what counts as a clause at all. we hit this exact thing on the indemnity work in june, i can dig up the run. happy to pair tues or weds — bring the 40 and pick me 15 you already know the answer to",
  },
  {
    id: "ticket-plat-1190-005",
    kind: "ticket",
    channel: "PLATFORM board",
    author: "Tobias Hedlund",
    authorRole: "Engineering Manager, Platform",
    timestamp: "2026-08-10T10:14:00+02:00",
    title: "PLAT-1190 — main red since 08:40, workspace build fails on tailwind 4.1.14",
    text: [
      "reporter: tobias · assignee: tobias · priority: P1 · label: ci, papercut",
      "",
      "Third red main this month, all three from transitive dep bumps we did not pin. Rolled back to 4.1.13, main green at 10:41. Nobody merge until CI is green twice.",
      "",
      "Follow-up (not doing today): pin the whole toolchain, and stop letting renovate open 40 PRs on a Monday.",
      "",
      "comments:",
      "  priya — this also killed the overnight eval run. re-queued, results ~2h late.",
      "  tobias — sorry. adding the eval runner to the smoke tests so it fails loudly instead of silently.",
    ].join("\n"),
  },
  {
    id: "slack-random-006",
    kind: "slack",
    channel: "#random",
    author: "Sofia Berg",
    authorRole: "Head of People Operations",
    timestamp: "2026-08-10T12:31:00+02:00",
    text: "kanelbullar in the floor 4 kitchen, from the actual bakery not the sad supermarket ones. 12 reactions in 4 minutes, new record 🙂",
  },
  {
    id: "slack-legal-eng-007",
    kind: "slack",
    channel: "#legal-eng",
    author: "Elin Sandberg",
    authorRole: "Head of Legal Engineering",
    timestamp: "2026-08-10T14:55:00+02:00",
    text: "reminder that the prompt review queue is at 23 and the oldest one is from july 29 🙃 i know everyone is heads down on nordkap. but an unreviewed prompt that ships is not an internal problem, it is a client sitting in a room being told the wrong thing about their own contract. please take one",
  },

  // ── Tue 11 Aug ────────────────────────────────────────────────────────────
  {
    id: "meeting-legal-eng-sync-008",
    kind: "meeting",
    channel: "Legal Engineering weekly sync",
    author: "Elin Sandberg",
    authorRole: "Head of Legal Engineering",
    timestamp: "2026-08-11T10:00:00+02:00",
    title: "Legal Engineering weekly — notes",
    text: [
      "present: elin, johan, marta, camille, daniel (partial, NY morning), jiwon (async notes)",
      "",
      "1. nordkap CoC — johan taking it, two-step approach, priya pairing. risk is the consent/notice call on the german docs. johan to write the classification instructions, NOT reuse the ones from the indemnity work.",
      "2. milan/ardent italian assignment miss — marta reading the documents before touching the playbook. deliberately not shipping a fast fix. anders wants a date for the client, marta gave thursday.",
      "3. review queue at 23. daniel and camille each taking 4 this week. this is not survivable at 60 more people joining in september.",
      "4. playbook library ownership — raised again by nina. we did not resolve it. moving to the offsite agenda where it will also not be resolved.",
      "5. september cohort — 3 joiners in legal eng on 17 aug, 2 more incl one ex-M&A on 1 sep. elin has written nothing for any of them. action: EVERYONE put 45 min in the buddy sheet.",
      "",
      "no decision recorded on item 4.",
    ].join("\n"),
  },
  {
    id: "slack-cust-esc-009",
    kind: "slack",
    channel: "#customer-escalations",
    author: "Marta Nowak",
    authorRole: "Legal Engineer",
    timestamp: "2026-08-11T11:47:00+02:00",
    text: "escalation from milan. ardent ran the assignment-clause playbook over an italian asset purchase set, 12 docs, and got zero hits. the clause is there in all 12. its phrased as cessione del contratto and it sits under a heading we dont look at, and in 4 of them its in an annex not the body. third italian thing this month",
  },
  {
    id: "slack-cust-esc-010",
    kind: "slack",
    channel: "#customer-escalations",
    author: "Camille Dufort",
    authorRole: "Legal Engineer, Paris",
    timestamp: "2026-08-11T11:58:00+02:00",
    text: "(thread) same shape as the french cession de contrat one in july, and the spanish one before that. we keep patching jurisdiction variants inside individual playbooks so the fix never travels. there is no one place where \"how this concept is actually drafted in civil law systems\" lives. i have said this in two retros now",
  },
  {
    id: "slack-cust-esc-011",
    kind: "slack",
    channel: "#customer-escalations",
    author: "Anders Wikström",
    authorRole: "Director of Engagement, EMEA",
    timestamp: "2026-08-11T12:04:00+02:00",
    text: "(thread) im on with ardent at 16:00 today. what do i tell them, do we have a fix window",
  },
  {
    id: "slack-cust-esc-012",
    kind: "slack",
    channel: "#customer-escalations",
    author: "Marta Nowak",
    authorRole: "Legal Engineer",
    timestamp: "2026-08-11T12:09:00+02:00",
    text: "(thread) thursday. and i want to actually read all 12 first. im not adding \"cessione\" to a keyword list and calling it fixed — if the heading structure is different then the chunking is wrong for the whole italian corpus and we will just miss the next one differently",
  },
  {
    id: "doc-eng-onboarding-013",
    kind: "doc",
    channel: "Notion / Platform",
    author: "Tobias Hedlund",
    authorRole: "Engineering Manager, Platform",
    timestamp: "2026-08-11T17:05:00+02:00",
    title: "Engineering onboarding — dev environment setup (day 1)",
    text: [
      "Maintained by Platform. Last updated whenever it breaks, which is more often than it should be.",
      "",
      "1. Laptop + SSO. If SSO bounces you it is probably your display name, see PLAT-1104.",
      "2. `gh auth login`, then clone `lexhav/workspace` and `lexhav/extraction`.",
      "3. `mise install` — do not use brew python, it will eat your first afternoon.",
      "4. Local stack: `just up`. Needs ~14GB free, the document index is not small.",
      "5. Seed a tenant: `just seed --tenant=dev --docs=sample-spa-set`.",
      "6. Run the tests. If they fail on a clean clone that is our bug, come find me, do not spend two hours on it.",
      "7. Request repo access in #eng-platform. Default is read on `extraction`, write on `playbooks`.",
      "8. Read the extraction service README before you touch anything under `chunking/`.",
      "9. Pair with your buddy on one real PR in week one. Any PR. It does not have to be good.",
      "",
      "Note: if you are joining Legal Engineering you do not need steps 3–8 and you almost certainly do not want the local stack running. Ask your buddy what you actually need on day one.",
      "",
      "(Elin — is there a version of this for your team yet? happy to host it here.)",
    ].join("\n"),
  },

  // ── Wed 12 Aug — should legal engineers write code, or write specs? ───────
  {
    id: "slack-legal-eng-014",
    kind: "slack",
    channel: "#legal-eng",
    author: "Johan Lindqvist",
    authorRole: "Senior Legal Engineer",
    timestamp: "2026-08-12T08:52:00+02:00",
    text: "genuine question and not a passive aggressive one. i spent basically all of yesterday in the eval notebook moving thresholds around and re-running. is that a good use of someone who spent 9 years doing M&A. i dont know the answer, im asking",
  },
  {
    id: "slack-legal-eng-015",
    kind: "slack",
    channel: "#legal-eng",
    author: "Priya Raghunathan",
    authorRole: "Staff ML Engineer",
    timestamp: "2026-08-12T09:06:00+02:00",
    text: "(thread) hot take: you moving the threshold is strictly better than me moving the threshold, because you know which of the errors actually matter. i genuinely cannot tell a materiality qualifier from a hole in the ground. i can make the number go up on whatever you tell me to count, thats the whole job",
  },
  {
    id: "slack-legal-eng-016",
    kind: "slack",
    channel: "#legal-eng",
    author: "Elin Sandberg",
    authorRole: "Head of Legal Engineering",
    timestamp: "2026-08-12T09:20:00+02:00",
    text: "(thread) whoever writes the spec has to be someone who has actually negotiated the clause, thats non negotiable for me. whether you also push the change yourself is a tooling question and i dont have strong feelings about it. i do have feelings about you spending a whole day on it and then not telling anyone what you found",
  },
  {
    id: "slack-legal-eng-017",
    kind: "slack",
    channel: "#legal-eng",
    author: "Daniel Okafor",
    authorRole: "Legal Engineer, New York",
    timestamp: "2026-08-12T09:44:00-04:00",
    text: "(thread) counterpoint from the timezone where the clients are awake. if i need a two line schema change for a friday call and eng is 3 days deep in a sprint, id rather learn the two lines. ive been merging to the playbook repo for four months and nothing has caught fire",
  },
  {
    id: "slack-legal-eng-018",
    kind: "slack",
    channel: "#legal-eng",
    author: "Tobias Hedlund",
    authorRole: "Engineering Manager, Platform",
    timestamp: "2026-08-12T16:02:00+02:00",
    text: "(thread) playbook repo yes, ive been fine with that since march. the extraction service no. thats the line. the day someone ships a chunking change on a friday afternoon for one client is the day 1500 firms get a different answer than they got on thursday",
  },
  {
    id: "slack-legal-eng-019",
    kind: "slack",
    channel: "#legal-eng",
    author: "Camille Dufort",
    authorRole: "Legal Engineer, Paris",
    timestamp: "2026-08-12T16:20:00+02:00",
    text: "(thread) ^^ this. also nobody here has said the quiet part, which is that half of us cannot read python and the other half learned it in the last 14 months. we are having this as a preference debate and it is partly a skills one",
  },

  // ── Thu 13 Aug — who owns the playbook library? ──────────────────────────
  {
    id: "slack-prod-wf-020",
    kind: "slack",
    channel: "#product-workflows",
    author: "Nina Ekström",
    authorRole: "Product Manager, Workflows",
    timestamp: "2026-08-13T09:31:00+02:00",
    text: "who owns the playbook library. im asking sincerely because i have three different answers in my notes from this week and im about to put a number in a roadmap doc that the exec team reads",
  },
  {
    id: "slack-prod-wf-021",
    kind: "slack",
    channel: "#product-workflows",
    author: "Elin Sandberg",
    authorRole: "Head of Legal Engineering",
    timestamp: "2026-08-13T09:40:00+02:00",
    text: "(thread) operationally: my team maintains the M&A ones and the diligence ones. finance and disputes are wherever they were when the person who wrote them went on parental leave. i would not describe any of that as ownership",
  },
  {
    id: "slack-prod-wf-022",
    kind: "slack",
    channel: "#product-workflows",
    author: "Anders Wikström",
    authorRole: "Director of Engagement, EMEA",
    timestamp: "2026-08-13T09:52:00+02:00",
    text: "(thread) engagement owns the client-specific forks. which as of last count is ~340 playbooks against 90 in the standard library. so by volume the answer is engagement, which is obviously wrong, but it is the true answer",
  },
  {
    id: "slack-prod-wf-023",
    kind: "slack",
    channel: "#product-workflows",
    author: "Nina Ekström",
    authorRole: "Product Manager, Workflows",
    timestamp: "2026-08-13T09:55:00+02:00",
    text: "(thread) cool. cool cool cool. filing as an open question for the offsite and putting a range in the doc",
  },
  {
    id: "doc-floor6-move-024",
    kind: "doc",
    channel: "Notion / Workplace",
    author: "Sofia Berg",
    authorRole: "Head of People Operations",
    timestamp: "2026-08-13T13:15:00+02:00",
    title: "Stockholm — floor 6 move plan (w/c 17 Aug)",
    text: [
      "We are 210 people in Stockholm and the building says the fire cert covers 240, so this is the last move that fixes anything. Floor 7 lease signs in October.",
      "",
      "Tuesday 18th, desks land 07:00–11:00.",
      "  • Legal Engineering → floor 6 north (windows). 18 desks, 24 people, hot desk on Fridays, sorry.",
      "  • Applied ML → floor 6 south, next to the loud printer. I am aware.",
      "  • Platform stays on floor 4. Tobias has informed me that the dark corner is load bearing for his code reviews.",
      "  • 22 unassigned desks held for the September cohort. Please do not take one. I will know.",
      "",
      "Also: fire alarm test Thursday 11:15. It is a test, please do not evacuate. Please DO evacuate for the real one.",
      "Laptops for the 1 September starters will be AT the desks this time, not in a pile by the plant. I have personally checked.",
    ].join("\n"),
  },

  // ── Fri 14 Aug — the hypergrowth squeeze ─────────────────────────────────
  {
    id: "slack-legal-eng-025",
    kind: "slack",
    channel: "#legal-eng",
    author: "Elin Sandberg",
    authorRole: "Head of Legal Engineering",
    timestamp: "2026-08-14T08:15:00+02:00",
    text: "i have three people starting monday and i have written exactly nothing for any of them. im not going to pretend otherwise on monday morning. if you have 45 minutes next week please put your name in the buddy sheet, i cannot be the only surface area for five new joiners in three weeks",
  },
  {
    id: "slack-legal-eng-026",
    kind: "slack",
    channel: "#legal-eng",
    author: "Johan Lindqvist",
    authorRole: "Senior Legal Engineer",
    timestamp: "2026-08-14T08:29:00+02:00",
    text: "(thread) i can take one weds after the nordkap call. honestly id just sit them in on a client call and then have them try to build the workflow from the transcript. thats how i learned, it took about a week, it was awful and it worked",
  },
  {
    id: "slack-legal-eng-027",
    kind: "slack",
    channel: "#legal-eng",
    author: "Marta Nowak",
    authorRole: "Legal Engineer",
    timestamp: "2026-08-14T08:33:00+02:00",
    text: "(thread) ^^ this is how every single one of us learned and it is also not a plan",
  },
  {
    id: "doc-prompt-review-028",
    kind: "doc",
    channel: "Notion / Legal Engineering",
    author: "Elin Sandberg",
    authorRole: "Head of Legal Engineering",
    timestamp: "2026-08-14T16:40:00+02:00",
    title: "Prompt review checklist v3",
    text: [
      "For anything that goes in front of a client. ~20 min per review. v3 changes marked (new).",
      "",
      "1. Does the instruction name the jurisdiction(s) it was written against? If it silently assumes English-law drafting, say so in the description. (new — after the Milan miss)",
      "2. Are the few-shot examples real clauses from documents we are allowed to use? No paraphrases, no invented clauses. If you cannot find a real one, that is itself a finding — write it down.",
      "3. For every field: what is the failure mode if the model is wrong here — does the user see a wrong answer, or no answer? Wrong answers need a confidence gate, missing answers need better retrieval.",
      "4. Has someone who has actually drafted or negotiated this clause type read the instruction end to end? Initials + date at the bottom.",
      "5. Run the eval set before and after. Paste both numbers in the PR. Recall AND precision, not whichever one moved the way you wanted.",
      "6. If precision drops and recall rises, that is usually correct for diligence work and usually wrong for drafting work. Think about which one you are in. (new)",
      "7. Does it degrade gracefully on a scanned or OCR'd document? Half of what real firms upload is a photocopy of a fax.",
      "",
      "Not covered here: who is allowed to approve. Currently Elin, Johan, Daniel. This is a bottleneck and we know.",
    ].join("\n"),
  },

  // ── Mon 17 Aug ───────────────────────────────────────────────────────────
  {
    id: "slack-deployments-apac-029",
    kind: "slack",
    channel: "#deployments-apac",
    author: "Rahul Menon",
    authorRole: "Solutions Engineer, Bengaluru",
    timestamp: "2026-08-17T14:22:00+05:30",
    text: "seoul tenant is up but SSO bounces anyone with a non-latin display name, raised w platform. also 3 of the 6 laptops for the sept cohort here are stuck in customs again. separately — can someone from legal eng get on the tokyo call weds? they keep asking questions i cannot answer and i am starting to make things up in a professional tone",
  },

  // ── Tue 18 Aug — the disagreement nobody settles ─────────────────────────
  {
    id: "meeting-retro-030",
    kind: "meeting",
    channel: "Deployment retro",
    author: "Anders Wikström",
    authorRole: "Director of Engagement, EMEA",
    timestamp: "2026-08-18T14:00:00+02:00",
    title: "Retro — Ardent Partners (Milan) assignment-clause miss",
    text: [
      "attendees: anders, marta, camille, nina, elin (last 15 min)",
      "",
      "what happened: 12 italian asset purchase agreements, standard assignment playbook returned 0 hits. the client found it themselves, which is the worst possible way for us to find out.",
      "root cause (marta): not a keyword problem. the section classifier is built on anglo drafting conventions and italian documents put operative transfer language in places our chunker never surfaces. 7 of 12 had it outside any recognised heading, 4 in annexes.",
      "fix: marta reworking the retrieval step for the italian corpus + a variants note. priya to re-run the section classifier eval on a mixed-jurisdiction set.",
      "",
      "camille (raised for the third time): jurisdiction variants have no home. every fix is local to one playbook, so it never travels. proposal: one shared variants layer. no owner assigned. nina to scope.",
      "",
      "OPEN — went round twice and did not land:",
      "  anders: when a client escalates something like this, Engagement should own the conversation end to end and legal eng should hand us a fix and a date. otherwise i have two people talking to the same partner with different levels of confidence.",
      "  elin: the person who read the 12 documents is the only person who can honestly say what is wrong and when it will be right. taking them off the call makes us slower AND less credible, and marta being on that call is the reason ardent are still talking to us.",
      "  anders: that does not scale to 1500 accounts.",
      "  elin: neither does a fix date invented by someone who has not read the documents.",
      "  -> no decision. carried to the offsite. both to write half a page.",
    ].join("\n"),
  },
  {
    id: "meeting-whitfield-031",
    kind: "meeting",
    channel: "Customer call notes",
    author: "Daniel Okafor",
    authorRole: "Legal Engineer, New York",
    timestamp: "2026-08-18T09:30:00-04:00",
    title: "Whitfield Grange LLP — global rollout call, week 5",
    text: [
      "attendees: 2 x Whitfield (banking partner + innovation lead), daniel, anders (first 10 min)",
      "",
      "- Covenant extraction over their credit agreement precedents: happy with 3 of the 4 fields. The 4th (financial covenant headroom) they call 'technically right and practically useless', because we return the ratio without the definition of EBITDA it is calculated on. Fair. That is a second field, not a fix.",
      "- They want their own precedent bank as the few-shot source rather than our defaults. Reasonable. That is a fork.",
      "- Rollout: 340 fee earners across 4 offices by November.",
      "",
      "The bit I keep thinking about — the banking partner asked, on the record, 'so who at Lexhav is the person who actually understands our credit agreement precedents'. The honest answer is: me, I have known them five weeks, and I learned them by reading 60 of their documents on a Sunday. He seemed fine with that answer, which I found more alarming than reassuring.",
      "",
      "actions: daniel — raise the EBITDA-definition field; daniel — fork with their precedent bank; anders — November rollout plan, and who is on the November calls (open, see retro).",
    ].join("\n"),
  },
  {
    id: "slack-cust-esc-032",
    kind: "slack",
    channel: "#customer-escalations",
    author: "Anders Wikström",
    authorRole: "Director of Engagement, EMEA",
    timestamp: "2026-08-18T15:44:00+02:00",
    text: "to be clear i am not trying to take anyone off client calls. im trying to stop the situation where a partner at a 900 lawyer firm hears three different versions of a timeline from three people at lexhav in one week. that happened in july and it nearly cost us the account",
  },
  {
    id: "slack-cust-esc-033",
    kind: "slack",
    channel: "#customer-escalations",
    author: "Elin Sandberg",
    authorRole: "Head of Legal Engineering",
    timestamp: "2026-08-18T16:02:00+02:00",
    text: "and i am not trying to run an account team. i just dont think you can separate \"who explains the problem\" from \"who understands the problem\" at this stage of a category that didnt exist. maybe at 3000 accounts. lets write the half pages and stop doing this in a channel 🙂",
  },

  // ── Wed 19 Aug ───────────────────────────────────────────────────────────
  {
    id: "ticket-le-2214-034",
    kind: "ticket",
    channel: "LEGAL-ENG board",
    author: "Johan Lindqvist",
    authorRole: "Senior Legal Engineer",
    timestamp: "2026-08-19T09:10:00+02:00",
    title: "LE-2214 — SPA extraction misses governing law when it sits in a schedule",
    text: [
      "reporter: johan · assignee: johan · reviewer: priya · priority: P2 · label: nordkap",
      "",
      "In 6 of the 40 Nordkap SPAs the governing law provision is not in the boilerplate section — it is in Schedule 4 (Interpretation), or cross-referenced out to the framework agreement. We return null. The client reads null as 'no governing law clause', which is both wrong and alarming.",
      "",
      "Proposed: a fallback pass over schedules that follows one level of cross-reference, run ONLY when the primary pass returns null. Do not run it always — it will pick up the wrong law from a subsidiary annex.",
      "",
      "comments:",
      "  priya — the follow-a-cross-reference part is the expensive bit, that is a second retrieval hop. can we scope v1 to 'schedules only' and measure how much of the 6 that gets us?",
      "  johan — 4 of the 6. good enough for nordkap, I will raise the cross-ref one separately.",
      "  priya — do that and I will take the cross-ref one properly. it is the same primitive jiwon needs for the bilingual column thing.",
      "  tobias — reminder this touches the extraction service, needs a platform reviewer on the PR.",
    ].join("\n"),
  },
  {
    id: "ticket-esc-882-035",
    kind: "ticket",
    channel: "ESC board",
    author: "Marta Nowak",
    authorRole: "Legal Engineer",
    timestamp: "2026-08-19T11:25:00+02:00",
    title: "ESC-882 — Ardent Partners: assignment playbook returns 0 hits on Italian APAs",
    text: [
      "reporter: anders · assignee: marta · severity: S2 (client-found) · account: Ardent Partners (Milan)",
      "",
      "Read all 12. Full writeup in the doc. Summary: not a lexicon gap. The section classifier and the chunker assume heading conventions that Italian drafting does not follow. 7/12 operative language outside any recognised heading, 4/12 in annexes.",
      "",
      "Shipping: (a) italian-corpus retrieval override, (b) a variants note in the playbook description so the next person knows why, (c) an eval set of 30 italian documents added to the harness so this regresses loudly next time.",
      "",
      "NOT shipping: a keyword list. If anyone adds 'cessione' to a keyword list I will find you.",
      "",
      "comments:",
      "  camille — adding 20 french ones to the same eval set while you are in there.",
      "  anders — client was told thursday. is thursday still thursday.",
      "  marta — thursday is still thursday.",
      "  anders — 🙏",
    ].join("\n"),
  },
  {
    id: "doc-eval-runbook-036",
    kind: "doc",
    channel: "Notion / Applied ML",
    author: "Priya Raghunathan",
    authorRole: "Staff ML Engineer",
    timestamp: "2026-08-19T14:20:00+02:00",
    title: "Eval harness — how to run it (and why the numbers move)",
    text: [
      "You do not need to be able to write Python to run this. You do need to be able to read a contract, which is the scarce part.",
      "",
      "`just eval --set=ma.spa.change-of-control --rev=HEAD` → recall, precision, per-document breakdown, and a diff against the last run.",
      "Sets currently live: ma.spa.* (120 docs), dd.assignment (86, +30 IT this week), fin.credit-agreement (61), bilingual-kr (11, too small to trust).",
      "",
      "Reading the output:",
      "  • A miss is not always a model failure. Half the time the label is wrong, and the only way to find out is for someone who knows the clause to look at it.",
      "  • Precision and recall move against each other. Which one you want depends on the task — for diligence, a false positive costs 30 seconds of a lawyer's time and a false negative can cost the deal. For drafting it is the other way round. The harness does not know which you are in. You do.",
      "  • Any set under ~50 documents: treat the number as a vibe.",
      "",
      "The actual bottleneck: I can generate 200 candidate labels in four minutes and they are worth exactly nothing until someone qualified reviews them. Right now that is Johan, Marta, Daniel and Camille, in the evenings. Every accuracy figure we have ever quoted to a customer traces back to that.",
      "",
      "Want an account, ping me. Want me to explain what a threshold is — also ping me, it is a ten minute conversation and it is not a stupid question.",
    ].join("\n"),
  },
  {
    id: "slack-eng-platform-037",
    kind: "slack",
    channel: "#eng-platform",
    author: "Priya Raghunathan",
    authorRole: "Staff ML Engineer",
    timestamp: "2026-08-19T15:03:00+02:00",
    text: "eval harness is now the bottleneck and its a people bottleneck not a compute one. i need ~200 clauses labelled correct/incorrect by someone who actually knows, by thursday, and there is nobody. i can generate 200 candidate labels in 4 minutes and they are worth nothing until a lawyer looks at them",
  },
  {
    id: "slack-eng-platform-038",
    kind: "slack",
    channel: "#eng-platform",
    author: "Johan Lindqvist",
    authorRole: "Senior Legal Engineer",
    timestamp: "2026-08-19T15:31:00+02:00",
    text: "(thread) ill do 60 tonight. but this is the actual constraint on everything we do and we keep treating it like an errand. every single accuracy number we have ever quoted to a client traces back to someone sitting down with a pdf at 22:00",
  },

  // ── Thu 20 Aug ───────────────────────────────────────────────────────────
  {
    id: "meeting-pairing-039",
    kind: "meeting",
    channel: "Pairing session",
    author: "Priya Raghunathan",
    authorRole: "Staff ML Engineer",
    timestamp: "2026-08-20T10:30:00+02:00",
    title: "Pairing notes — SPA change-of-control prompt (Johan + Priya, 3h)",
    text: [
      "goal: get CoC extraction on the nordkap set from 0.71 recall to something we can put in front of a client, without wrecking precision.",
      "",
      "what we actually did:",
      "- johan went through the 15 known documents and wrote out WHY each miss was a miss. turned out there were only three kinds: (1) clause split across two sub-clauses, (2) CoC defined by reference to a defined term in schedule 1, (3) the words 'change of control' never appear at all — it is written as a transfer of more than 50% of the shares.",
      "- (3) is not a model problem. the instruction described the label instead of the concept. rewrote it around the concept. that alone: 0.71 -> 0.88.",
      "- cut the few-shot examples from 5 to 3. the 4th was a weird earnout-linked one and the model was pattern matching hard on it. 0.88 -> 0.94.",
      "- classify step as its own call, per the earlier thread. consent / notice / silent. johan wrote the instructions, including the rule that German assignment + CoC provisions have to be read together before deciding.",
      "- precision went 0.96 -> 0.91, which johan says is the right trade for diligence work (see review checklist item 6). priya would have made the opposite call on her own.",
      "",
      "the useful part, honestly: priya had been trying to fix (3) with retrieval for two days. it was a drafting-knowledge problem and it took twenty minutes once someone who had written these clauses looked at the misses.",
      "",
      "left over: 6 documents where governing law is in a schedule -> LE-2214. the remaining 25 nordkap documents are still not delivered.",
    ].join("\n"),
  },

  // ── Fri 21 Aug ───────────────────────────────────────────────────────────
  {
    id: "meeting-allhands-040",
    kind: "meeting",
    channel: "All-hands",
    author: "Sofia Berg",
    authorRole: "Head of People Operations",
    timestamp: "2026-08-21T15:00:00+02:00",
    title: "All-hands 21 Aug — notes (posted for the offices who could not make it live)",
    text: [
      "- Max: 1,500 law firms and in-house teams. Denver lease signed, so 16 cities. Series D money is being spent on people and on the index, in that order.",
      "- Q3 numbers: not repeating them here, see the deck, please do not forward the deck.",
      "- Headcount 712 today. Plan is 1,500 by 31 Dec. September cohort is 58, October provisionally 90.",
      "- Max, close to verbatim: 'we are hiring faster than we are writing anything down. I would rather fix the writing than slow the hiring.'",
      "- Nina demoed workflow builder v2. Loud applause for the bit where you can see which playbook a result came from.",
      "- Q&A: someone asked how we train 800 new people when everyone who knows how to do the job is on customer work. The answer was honest — 'we do not have a good answer, we have a buddy sheet.'",
      "- Q&A: yes there will be a padel tournament. No it is not a benefit.",
      "- Ji-won asked (async) whether all-hands can rotate times. Yes, from September.",
    ].join("\n"),
  },
  {
    id: "slack-general-041",
    kind: "slack",
    channel: "#general",
    author: "Rasmus Thorell",
    authorRole: "Co-founder & CEO",
    timestamp: "2026-08-21T16:30:00+02:00",
    text: "quick one before the weekend. we passed 1,500 firms and in-house teams this week, and denver signed its lease, so thats 16 cities. thank you. one thing i want to say plainly though: we are hiring faster than we are writing anything down, and between those two i would rather fix the writing than slow the hiring. if you have figured out how to do something here — anything — put it somewhere a person who joins in october can find it. most of what we know is currently in about forty people's heads and that is a real risk, not a charming startup detail",
  },

  // ── Mon 24 Aug ───────────────────────────────────────────────────────────
  {
    id: "slack-cust-esc-042",
    kind: "slack",
    channel: "#customer-escalations",
    author: "Anders Wikström",
    authorRole: "Director of Engagement, EMEA",
    timestamp: "2026-08-24T09:20:00+02:00",
    text: "new one. nordkap now want the CoC output as a schedule they can drop straight into the disclosure letter, formatted their way, with their clause numbering. deal signs 11 sept. i said we would look at it. before anyone shouts at me — they are our largest nordic account and they are asking for something a trainee would otherwise do for 40 hours",
  },
  {
    id: "slack-cust-esc-043",
    kind: "slack",
    channel: "#customer-escalations",
    author: "Johan Lindqvist",
    authorRole: "Senior Legal Engineer",
    timestamp: "2026-08-24T09:34:00+02:00",
    text: "(thread) thats fine actually, thats a template on top of the existing output, not new extraction. half a day. the part that isnt fine is that itll be the 6th client-specific fork of the CoC playbook and none of the six know about each other",
  },
  {
    id: "slack-cust-esc-044",
    kind: "slack",
    channel: "#customer-escalations",
    author: "Nina Ekström",
    authorRole: "Product Manager, Workflows",
    timestamp: "2026-08-24T09:51:00+02:00",
    text: "(thread) 6 forks is a product gap not a services problem. can whoever builds this write down what nordkap actually asked for, in one paragraph, in the fork description, BEFORE you build it. i am trying to work out how many of the 340 forks are the same three features",
  },
  {
    id: "ticket-wf-411-045",
    kind: "ticket",
    channel: "PRODUCT board",
    author: "Nina Ekström",
    authorRole: "Product Manager, Workflows",
    timestamp: "2026-08-24T16:40:00+02:00",
    title: "WF-411 — make the three common fork reasons configurable instead of forkable",
    text: [
      "reporter: nina · assignee: UNASSIGNED · label: discovery",
      "",
      "Sampled 80 of the ~340 client forks. ~55% are one of exactly three things: an output format change, a jurisdiction patch, or one extra field. If that holds across the population, most forks should not exist, and every one of them is something somebody has to maintain forever.",
      "",
      "Proposal: a config surface for those three. Then a fork means something again.",
      "",
      "Blocker, and I want this written down: I cannot write the config labels. If I write them they will say the wrong words — 'clause type', 'condition' — and no lawyer will touch it, exactly like nobody used the filter panel in v1. I need someone from Legal Engineering to OWN the wording, not review it at the end.",
      "",
      "comments:",
      "  elin — agree. cannot staff it this month, everyone is on nordkap or escalations. ask me again after the offsite.",
      "  johan — the jurisdiction patch one overlaps with what camille has been asking for since july. do not build two things.",
      "  camille — 👍 it is the same thing.",
    ].join("\n"),
  },

  // ── Tue 25 Aug ───────────────────────────────────────────────────────────
  {
    id: "doc-playbook-naming-046",
    kind: "doc",
    channel: "Notion / Legal Engineering",
    author: "Nina Ekström",
    authorRole: "Product Manager, Workflows",
    timestamp: "2026-08-25T11:00:00+02:00",
    title: "Playbook naming + fork conventions (DRAFT — do not circulate to customers)",
    text: [
      "Status: draft. No owner. Written because I got three different answers about the library and needed something to point at.",
      "",
      "Proposed name shape:  <practice>.<instrument>.<task>[.<client>]",
      "  ma.spa.change-of-control",
      "  ma.spa.change-of-control.nordkap        (client fork)",
      "  dd.assignment.detect                    (the one that missed the Italian documents)",
      "  fin.credit-agreement.covenant-extract",
      "",
      "Every fork description MUST answer, in the author's own words:",
      "  1. what did the client actually ask for — one paragraph, in their language, not ours",
      "  2. what changed versus the parent playbook",
      "  3. which jurisdictions it was tested against (this is the Milan lesson)",
      "  4. who to ask when it breaks",
      "",
      "Currently ~90 standard playbooks, ~340 client forks. Rough sample of 80 forks: 55% are one of three things — an output format change, a jurisdiction patch, or one extra field. If that holds, most forks should not exist.",
      "",
      "Open: who approves a promotion from fork → standard library. Today it happens when Elin notices. That is not a process.",
    ].join("\n"),
  },
  {
    id: "doc-bilingual-kr-047",
    kind: "doc",
    channel: "Notion / Legal Engineering (Seoul)",
    author: "Ji-won Park",
    authorRole: "Legal Engineer, Seoul",
    timestamp: "2026-08-25T18:10:00+09:00",
    title: "Bilingual KR/EN agreements — we are reading the wrong column",
    text: [
      "Writing this up because I do not think it shows up as an accuracy number anywhere, and it should.",
      "",
      "Korean commercial agreements are frequently drafted in two columns, Korean and an English courtesy translation. In 9 of the 11 pilot documents the Korean column is the operative text and the agreement says so in the interpretation clause. We extract from the English column, because our layout parser prefers the left-to-right latin block.",
      "",
      "In 2 of the 11, the two columns say materially different things. In one, the English says 'may terminate on 30 days notice' and the Korean says 'may terminate on 30 days notice with the counterparty's written consent'. We returned the English.",
      "",
      "That is not a percentage-points problem. That is us telling a client something confidently and wrongly about the only version of the document that binds them.",
      "",
      "What I think it needs: read the interpretation clause FIRST to establish which language governs, then pin extraction to that column. That is a retrieval and layout change, not a prompt change — raised as LE-2205.",
      "",
      "Caveat: eleven documents. I would not generalise from eleven. I would also not wait for a hundred.",
    ].join("\n"),
  },
  {
    id: "ticket-le-2205-048",
    kind: "ticket",
    channel: "LEGAL-ENG board",
    author: "Ji-won Park",
    authorRole: "Legal Engineer, Seoul",
    timestamp: "2026-08-25T18:30:00+09:00",
    title: "LE-2205 — bilingual documents: resolve governing language before extraction",
    text: [
      "reporter: jiwon · assignee: priya · priority: P1 (correctness) · label: apac, retrieval",
      "",
      "See the writeup. Layout parser picks the latin column; the interpretation clause frequently makes the other one operative.",
      "",
      "comments:",
      "  priya — same primitive as the cross-reference hop in LE-2214, I would rather build it once. taking both.",
      "  elin — P1 agreed. jiwon, this should not have sat in a regional channel for a day, put things like this in #legal-eng.",
      "  jiwon — understood. it was 03:00 in Stockholm and I did not want to be dramatic 😅",
      "  elin — be dramatic.",
      "  marta — noting this is the same failure mode as ESC-882: we assumed a document convention that is only a convention where we happen to be from.",
    ].join("\n"),
  },
  {
    id: "slack-legal-eng-049",
    kind: "slack",
    channel: "#legal-eng",
    author: "Elin Sandberg",
    authorRole: "Head of Legal Engineering",
    timestamp: "2026-08-25T12:05:00+02:00",
    text: "everyone read jiwon's bilingual writeup, its 1 page and its the most important thing anyone found this week. also we have to fix the fact that he found this on a live pilot and not on our own eval set, that is the actual bug 😬",
  },

  // ── Wed 26 Aug ───────────────────────────────────────────────────────────
  {
    id: "ticket-esc-901-050",
    kind: "ticket",
    channel: "ESC board",
    author: "Rahul Menon",
    authorRole: "Solutions Engineer, Bengaluru",
    timestamp: "2026-08-26T09:05:00+05:30",
    title: "ESC-901 — Tokyo pilot: 14 open customer questions I cannot answer",
    text: [
      "reporter: rahul · assignee: UNASSIGNED · account: Sakabe & Partners (pilot, week 3)",
      "",
      "I can configure their tenant, migrate their documents and train their admins. What I cannot do is answer questions like 'why did the model treat this as a condition precedent rather than a covenant' or 'can we make it follow our house style on defined terms'. There are 14 of these in the doc and they have been open nine days.",
      "",
      "I have been giving answers that are technically about the software and not about their contracts, and I think they can tell.",
      "",
      "Ask: someone from Legal Engineering on the Wednesday call. 45 minutes. Recurring if possible.",
      "",
      "comments:",
      "  jiwon — I can do Wednesdays. It is two hours before my day starts but it is fine.",
      "  elin — do it, and log the questions. that list is worth more than the call.",
      "  anders — flagging that this is the third region asking for the same thing and we have four people who can do it.",
    ].join("\n"),
  },
  {
    id: "slack-general-051",
    kind: "slack",
    channel: "#general",
    author: "Sofia Berg",
    authorRole: "Head of People Operations",
    timestamp: "2026-08-26T10:10:00+02:00",
    text: "september cohort: 58 people across 9 offices, sept 1 and sept 15. for scale, the april cohort was 97 people in one week and we ran it off one spreadsheet and vibes. i am not doing the spreadsheet again. buddy sheet is linked, it is currently 40% full 👀",
  },
  {
    id: "slack-general-052",
    kind: "slack",
    channel: "#general",
    author: "Frida Alm",
    authorRole: "Technical Recruiter",
    timestamp: "2026-08-26T10:44:00+02:00",
    text: "(thread) candidates keep asking me what a day actually looks like in legal engineering and i keep sending them a screenshot of johan's message about learning from a call transcript, which is a great story and a bad answer. if anyone has a better one please send it to me. genuinely, anything",
  },
  {
    id: "slack-general-053",
    kind: "slack",
    channel: "#general",
    author: "Marta Nowak",
    authorRole: "Legal Engineer",
    timestamp: "2026-08-26T10:58:00+02:00",
    text: "(thread) ive been here 14 months and i would also struggle to write that answer down, which is either interesting or a problem",
  },
  {
    id: "doc-italian-writeup-054",
    kind: "doc",
    channel: "Notion / Escalations",
    author: "Marta Nowak",
    authorRole: "Legal Engineer",
    timestamp: "2026-08-26T17:30:00+02:00",
    title: "Italian assignment / change-of-control drafting — what we got wrong (ESC-882 writeup)",
    text: [
      "For whoever hits the next civil-law jurisdiction. This is a drafting note, not a bug report.",
      "",
      "1. Italian APAs frequently express assignment of contract as 'cessione del contratto' under art. 1406 c.c., and the operative consent requirement lives in the counterparty's separate consent, not under any heading we recognise. 7 of 12 documents.",
      "2. In 4 of 12 the whole mechanic sits in an annex, referenced once from the body. Our chunker treats annexes as low-priority context.",
      "3. Our section classifier was built on English-law style share purchase agreements. It is doing exactly what it was trained to do. The failure is upstream of the model.",
      "4. What I would tell a new person: do not start from our output. Start from the documents, decide what the right answer is yourself, and only then look at what we returned. If you start from our output you will only ever find the errors we already know about.",
      "",
      "The same pattern almost certainly applies to Spanish (cesión de contrato), Portuguese, probably Polish. Camille has the French version from July.",
      "",
      "Eval: 30 IT documents added to the harness, 20 FR to follow. Ask Priya for access if you need to run it.",
    ].join("\n"),
  },

  // ── Thu 27 Aug — the new joiner ──────────────────────────────────────────
  {
    id: "ticket-le-2231-055",
    kind: "ticket",
    channel: "LEGAL-ENG board",
    author: "Elin Sandberg",
    authorRole: "Head of Legal Engineering",
    timestamp: "2026-08-27T09:15:00+02:00",
    title: "LE-2231 — Nordkap disclosure-letter schedule export",
    text: [
      "reporter: anders · assignee: UNASSIGNED · due: 2026-09-08 (deal signs 11 Sept) · label: nordkap, client-fork",
      "",
      "Template layer on top of the ma.spa.change-of-control.nordkap output. Their clause numbering, their column order, exports to docx.",
      "",
      "Johan estimates half a day of build. Deliberately not assigning to Johan — he is on LE-2214 and the classify rework and I am not putting a third thing on him.",
      "",
      "comments:",
      "  elin — holding this for the joiner starting 1 Sept. It is a real client deliverable with a real date, it is bounded, and the hard part is knowing what a disclosure letter schedule is supposed to look like — which they will know cold and none of the rest of us knew until we got here.",
      "  anders — happy with that as long as someone senior is on the client call.",
      "  elin — we can argue about that separately 🙂",
      "  johan — I will be around, and I will do the docx bit if it fights back.",
    ].join("\n"),
  },
  {
    id: "slack-legal-eng-056",
    kind: "slack",
    channel: "#legal-eng",
    author: "Elin Sandberg",
    authorRole: "Head of Legal Engineering",
    timestamp: "2026-08-27T09:40:00+02:00",
    text: "fyi the person starting sept 1 is ex-M&A, 6 years, london, did basically nothing but SPAs and disclosure exercises. no coding at all, and i told them in the interview that was fine, which i believe. i want them on nordkap because they will know what a CoC consent actually looks like by day two. what i genuinely dont have is anything to hand them on day one",
  },
  {
    id: "slack-legal-eng-057",
    kind: "slack",
    channel: "#legal-eng",
    author: "Anders Wikström",
    authorRole: "Director of Engagement, EMEA",
    timestamp: "2026-08-27T09:52:00+02:00",
    text: "(thread) put them on client calls in week one. its the fastest way to understand what we actually sell, and theyve sat in worse rooms than ours",
  },
  {
    id: "slack-legal-eng-058",
    kind: "slack",
    channel: "#legal-eng",
    author: "Elin Sandberg",
    authorRole: "Head of Legal Engineering",
    timestamp: "2026-08-27T09:58:00+02:00",
    text: "(thread) hard no for week one. week one they read our outputs against documents they already understand and tell us every single place we are wrong. thats worth more to us than a call and its worth more to them. week two, calls",
  },
  {
    id: "slack-legal-eng-059",
    kind: "slack",
    channel: "#legal-eng",
    author: "Johan Lindqvist",
    authorRole: "Senior Legal Engineer",
    timestamp: "2026-08-27T10:11:00+02:00",
    text: "(thread) for what its worth the thing i wish someone had told me in week one is that nobody is going to hand you a task list. you find the thing thats broken by reading, and then you go and fix it, and the fixing is about 30% writing instructions, 30% arguing with priya, and 40% reading contracts at a level of care you havent used since your second seat",
  },

  // ── Fri 28 Aug ───────────────────────────────────────────────────────────
  {
    id: "meeting-legal-eng-sync-060",
    kind: "meeting",
    channel: "Legal Engineering weekly sync",
    author: "Elin Sandberg",
    authorRole: "Head of Legal Engineering",
    timestamp: "2026-08-28T10:00:00+02:00",
    title: "Legal Engineering weekly — notes",
    text: [
      "present: elin, johan, marta, camille, daniel, nina (guest), priya (guest)",
      "",
      "1. nordkap CoC now 0.94 recall / 0.91 precision after the pairing session. the remaining 25 documents are STILL not delivered, anders chasing. LE-2231 (disclosure schedule) held for the 1 Sept joiner.",
      "2. ESC-882 closed thursday as promised. marta's writeup is the best thing anyone has written here in a month — please read it, it is one page.",
      "3. jiwon's bilingual finding: priya taking it, same cross-reference primitive as LE-2214. jiwon to present it at a sync that is not 3am for him. sofia sorting a second sync slot for APAC.",
      "4. review queue down to 9. thank you.",
      "5. playbook library ownership: still open. anders/elin half-pages: neither written. carried.",
      "6. onboarding: the three joiners from 17 Aug are all still mostly shadowing. buddy sheet 60% full. we are going to do this badly again in september and I would like us to at least do it badly on purpose.",
      "",
      "action: everyone writes ONE paragraph in the team Notion about something they figured out this month. Deadline Friday. I will chase.",
    ].join("\n"),
  },
  {
    id: "slack-eng-platform-061",
    kind: "slack",
    channel: "#eng-platform",
    author: "Tobias Hedlund",
    authorRole: "Engineering Manager, Platform",
    timestamp: "2026-08-28T15:30:00+02:00",
    text: "access request queue: 11 pending, 7 of them legal engineers wanting playbook repo write. approving all 7. the two asking for extraction service write — come and talk to me, the answer is probably no but its a nice conversation to have",
  },

  // ── Mon 31 Aug, the day before ───────────────────────────────────────────
  {
    id: "slack-legal-eng-062",
    kind: "slack",
    channel: "#legal-eng",
    author: "Marta Nowak",
    authorRole: "Legal Engineer",
    timestamp: "2026-08-31T17:50:00+02:00",
    text: "someone starting tomorrow asked me on linkedin what they should read before day one and i genuinely did not know what to send them. i sent the ardent writeup and a link to two SPAs. is that mad",
  },
  {
    id: "slack-legal-eng-063",
    kind: "slack",
    channel: "#legal-eng",
    author: "Johan Lindqvist",
    authorRole: "Senior Legal Engineer",
    timestamp: "2026-08-31T18:02:00+02:00",
    text: "(thread) thats better than what i got, which was a laptop and the wifi password 😄",
  },
];

// ─────────────────────────────────────────────────────────────────── export

export const lexhav: Company = {
  slug: "lexhav",
  name: "Lexhav",
  description:
    "Lexhav is a Stockholm-headquartered legal AI company founded in 2023, building a collaborative workspace where lawyers run AI workflows — clause extraction, diligence review, drafting — over their own documents. It is one of the fastest-scaling software companies in Europe: ARR went from roughly $3M at the end of 2024 to $50M at the end of 2025 to around $150M by June 2026, and headcount from 40 to 400 in a year, now heading from ~700 to 1,500 by the end of 2026. In March 2026 it raised a $600M Series D led by Accel at a $5.6B valuation, with later reports of talks at roughly double that. It serves about 1,500 law firms and in-house legal teams from 16 cities across four continents — Stockholm, London, New York, Denver, Sydney, Bengaluru, Paris, Munich, Madrid, Milan, Mexico City and Seoul among them — with Baker McKenzie deployed globally. It onboarded around 97 people in a single cohort in one week. Along the way it created and popularised the 'Legal Engineer': ex-lawyers who turn legal expertise into AI workflows — a job title that did not exist in the industry three years ago, and for which, consequently, no playbook, no course and no predecessor exists.",
  people,
  artifacts,
};

export default lexhav;
