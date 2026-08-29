/**
 * The local harness: everything about this Slack surface that can be checked
 * without a Slack workspace, checked.
 *
 *     node lib/slack/harness.mjs        (or: npm run slack:test)
 *
 * There are no Slack tokens on this machine and there will not be until someone
 * creates the app, so "it works" cannot be demonstrated end to end. What *can*
 * be demonstrated is that the handlers are correct functions of their inputs —
 * which is exactly why `lib/slack/app.ts` returns described messages instead of
 * calling Slack. The single most important assertion in here is negative:
 *
 *     the manager channel gets nothing unless a human is genuinely needed
 *
 * It is checked four ways — agent answered, blocker the agent resolved itself,
 * blocker deduped upstream, and blocker that really needs a person — because
 * that invariant is the product, and a regression in it is not a bug you notice
 * in a demo. It is a bug the customer notices in week two, when their channel is
 * full of noise and they turn the thing off.
 *
 * Fixtures use the real `openingMessage` and the real Lexhav roster, so the
 * markdown-to-mrkdwn seam and the opening/task split are tested against what
 * actually produces them rather than against a convenient string.
 */

import "./hook.mjs";

const { handleStart, handleUserMessage, handleMention, isStartTrigger } = await import("./app.ts");
const { createMemorySessionStore } = await import("./sessions.ts");
const { createHttpBackend, VanavApiError } = await import("./backend.ts");
const { loadSlackConfig, SlackConfigError } = await import("./config.ts");
const format = await import("./format.ts");
const { currentTask, openingMessage } = await import("@/lib/agent/supervise");
const { getCompany } = await import("@/lib/seed");

// ───────────────────────────────────────────────────────────── assertions

let passed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  [32m✓[0m ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  [31m✗[0m ${name}\n      ${err.message}`);
  }
}

function eq(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function ok(condition, what) {
  if (!condition) throw new Error(what);
}

// ─────────────────────────────────────────────────────────────── fixtures

const COMPANY = getCompany("lexhav");

const TASKS = [
  {
    id: "t1",
    title: "Rebuild the change-of-control clause set for the Nordkap fork",
    why: "Nordkap's fork drifted from the shared playbook three sprints ago and nobody has reconciled it.",
    context:
      "The shared set lives in the prompt review queue. Anders owns the client relationship; the fork itself is technical.",
    doneWhen: "The fork's clause set runs green against the shared diligence fixtures.",
    askIfStuck: "Johan Lindqvist",
    estimateMins: 45,
  },
  {
    id: "t2",
    title: "Write the assignment-clause edge case up in the shared playbook",
    why: "The same question has come up in three client threads and the answer is still only in someone's head.",
    context: "Marta has the jurisdiction edge cases; the playbook itself is reviewed by Elin.",
    doneWhen: "A reviewed entry exists in the shared playbook and the three threads are answered.",
    askIfStuck: "Marta Nowak",
    estimateMins: 60,
  },
];

const PLAN = {
  role: "Legal Engineer",
  days: [
    { day: 1, theme: "First real output", tasks: [TASKS[0]] },
    { day: 2, theme: "Make it reusable", tasks: [TASKS[1]] },
  ],
};

function makeHire(overrides = {}) {
  const hire = {
    id: "hire-1",
    name: "Sofia Lindberg",
    roleTitle: "Legal Engineer",
    companySlug: "lexhav",
    startedAt: "2026-08-29T08:00:00.000Z",
    plan: PLAN,
    taskStatus: { t1: "not_started", t2: "not_started" },
    messages: [],
    blockers: [],
    ...overrides,
  };
  // The genuine article: whatever `openingMessage` writes today is what the
  // Slack formatter has to cope with today.
  hire.messages = [openingMessage(hire, PLAN), ...(overrides.messages ?? [])];
  return hire;
}

function blocker(overrides = {}) {
  return {
    id: "b1",
    hireId: "hire-1",
    taskId: "t1",
    summary: "The corpus does not say which tenant the staging seed points at, and nobody has write access to change it.",
    raisedAt: "2026-08-29T09:00:00.000Z",
    needsHuman: true,
    suggestedPerson: "Johan Lindqvist",
    minutesToUnblock: 5,
    resolved: false,
    ...overrides,
  };
}

/** A backend that answers from fixtures and records what it was asked. */
function fakeBackend({ hire = makeHire(), reply = "Yes — Johan answered this in #eng on 12 June.", blockerOut = null } = {}) {
  const calls = { start: [], turn: [] };
  return {
    calls,
    async start(input) {
      calls.start.push(input);
      return { hire, cached: true };
    },
    async turn(input) {
      calls.turn.push(input);
      return { hire, reply, blocker: blockerOut };
    },
  };
}

const MANAGER_CHANNEL = "C0MANAGER1";

function makeDeps(backend, sessions = createMemorySessionStore()) {
  const logs = [];
  return {
    deps: {
      backend,
      sessions,
      managerChannel: MANAGER_CHANNEL,
      defaults: { companySlug: "lexhav", roleTitle: "Legal Engineer" },
      company: COMPANY,
      currentTask, // the agent's own definition, imported not reimplemented
      log: (m) => logs.push(m),
    },
    logs,
  };
}

/** Every string a message will actually render, flattened. */
function textOf(action) {
  const parts = [action.text];
  for (const block of action.blocks) {
    if (block.text?.text) parts.push(block.text.text);
    for (const f of block.fields ?? []) parts.push(f.text);
    for (const e of block.elements ?? []) parts.push(e.text ?? "");
  }
  return parts.join("\n");
}

const channelPosts = (actions) => actions.filter((a) => a.kind === "channel");
const dms = (actions) => actions.filter((a) => a.kind === "dm");

// ══════════════════════════════════════════════════════ 1. the agent opens

console.log("\nthe agent speaks first");

const startBackend = fakeBackend();
const startSessions = createMemorySessionStore();
const startActions = await handleStart(makeDeps(startBackend, startSessions).deps, {
  slackUserId: "U1",
  profileName: "Sofia Lindberg",
});

await check("start posts the opening and the first task, unprompted", () => {
  eq(startActions.length, 2, "message count");
  eq(startActions[0].kind, "dm", "first message destination");
  eq(startActions[1].kind, "dm", "second message destination");
});

await check("start posts nothing to the manager channel", () => {
  eq(channelPosts(startActions).length, 0, "channel posts");
});

await check("the first task card carries context, done-when and who to ask", () => {
  const card = textOf(startActions[1]);
  ok(card.includes("Your first task"), "missing heading");
  ok(card.includes(TASKS[0].doneWhen), "missing done-when");
  ok(card.includes("What you need to know"), "missing context label");
  ok(card.includes("Johan Lindqvist"), "missing who to ask");
  ok(card.includes("~45 min"), "missing estimate");
});

await check("the opening prose does not repeat the task card", () => {
  const intro = textOf(startActions[0]);
  ok(!intro.includes(TASKS[0].doneWhen), "the done-when leaked into the prose — splitOpening missed its marker");
});

await check("start remembers the hire against the Slack user", async () => {
  eq(startBackend.calls.start.length, 1, "backend start calls");
  eq(startBackend.calls.start[0].roleTitle, "Legal Engineer", "role title");
  eq(startBackend.calls.start[0].name, "Sofia Lindberg", "hire name");
});

const storedSession = await startSessions.get("U1");
await check("the session records the task whose card was posted", () => {
  eq(storedSession.hireId, "hire-1", "hireId");
  eq(storedSession.lastTaskId, "t1", "lastTaskId");
});

await check("a second /onboard reuses the hire row instead of creating another", async () => {
  const b = fakeBackend();
  await handleStart(makeDeps(b, startSessions).deps, { slackUserId: "U1", profileName: "Sofia Lindberg" });
  eq(b.calls.start[0].hireId, "hire-1", "reused hireId");
});

await check("/onboard <role> overrides the configured default role", async () => {
  const b = fakeBackend();
  await handleStart(makeDeps(b).deps, { slackUserId: "U9", roleTitle: "Forward Deployed Engineer" });
  eq(b.calls.start[0].roleTitle, "Forward Deployed Engineer", "role title");
});

// ════════════════════════════════════ 2. escalation: the invariant, 4 ways

console.log("\nescalation happens only when a human is genuinely needed");

await check("agent answered from the corpus → the manager channel stays silent", async () => {
  const { deps } = makeDeps(fakeBackend({ blockerOut: null }), createMemorySessionStore([storedSession]));
  const actions = await handleUserMessage(deps, { slackUserId: "U1", text: "where do clause fixtures live?" });
  eq(channelPosts(actions).length, 0, "channel posts");
  eq(dms(actions).length, 1, "DM replies");
});

await check("blocker the agent resolved itself (needsHuman false) → still silent", async () => {
  const { deps } = makeDeps(
    fakeBackend({ blockerOut: blocker({ needsHuman: false, suggestedPerson: undefined, minutesToUnblock: undefined }) }),
    createMemorySessionStore([storedSession]),
  );
  const actions = await handleUserMessage(deps, { slackUserId: "U1", text: "the fixtures fail locally" });
  eq(channelPosts(actions).length, 0, "channel posts");
});

await check("blocker deduped by /api/chat (blocker: null) → no repeat post", async () => {
  // This is the case that would otherwise re-post one open obstacle on every
  // single turn. The route already deduped it, and this surface inherits that
  // rather than deciding again.
  const { deps } = makeDeps(fakeBackend({ blockerOut: null }), createMemorySessionStore([storedSession]));
  const actions = await handleUserMessage(deps, { slackUserId: "U1", text: "still blocked on that access thing" });
  eq(channelPosts(actions).length, 0, "channel posts");
});

const escalated = await (async () => {
  const { deps } = makeDeps(fakeBackend({ blockerOut: blocker() }), createMemorySessionStore([storedSession]));
  return handleUserMessage(deps, { slackUserId: "U1", text: "I can't get into the staging tenant" });
})();

await check("a genuine blocker → exactly one post, to the configured channel", () => {
  eq(channelPosts(escalated).length, 1, "channel posts");
  eq(channelPosts(escalated)[0].channel, MANAGER_CHANNEL, "destination channel");
});

await check("the escalation names the person, their handle and the honest minutes", () => {
  const card = textOf(channelPosts(escalated)[0]);
  ok(card.includes("Johan Lindqvist"), "missing suggested person");
  ok(card.includes("@johan"), "missing Slack handle from the roster");
  ok(card.includes("Senior Legal Engineer"), "missing their role");
  ok(card.includes("~5 min"), "missing minutes-to-unblock");
  ok(card.includes("staging seed"), "missing the obstacle itself");
});

await check("the hire is told they were escalated, not escalated behind their back", () => {
  const dm = textOf(dms(escalated)[0]);
  ok(dm.includes("<#C0MANAGER1>"), "the DM should name the channel it posted to");
  ok(dm.includes("Johan Lindqvist"), "the DM should name who was asked");
});

await check("the escalation notification line survives a phone lock screen", () => {
  const post = channelPosts(escalated)[0];
  ok(post.text.length > 0 && post.text.length <= 200, "fallback text missing or too long");
  ok(post.text.includes("Sofia Lindberg"), "fallback should say who");
});

// ════════════════════════════════════════ 3. no scores, ever

console.log("\nthe blocker card never assesses the person");

await check("no shipped template contains assessment language", () => {
  const everything = [
    ...startActions,
    ...escalated,
    ...format.taskBlocks(TASKS[1], { heading: "Next up" }).map((b) => ({ text: "", blocks: [b] })),
  ]
    .map(textOf)
    .join("\n");
  const hit = format.findAssessmentLanguage(everything);
  ok(hit === null, `found "${hit}" in rendered output — blockers describe the obstacle, never the person`);
});

await check("the guard actually fires on the language it bans", () => {
  ok(format.findAssessmentLanguage("the hire is struggling with setup") !== null, "should flag 'struggling'");
  ok(format.findAssessmentLanguage("60% complete") !== null, "should flag a completion percentage");
  ok(format.findAssessmentLanguage("ramp velocity is low") !== null, "should flag velocity");
  ok(format.findAssessmentLanguage("staging credentials have not been issued") === null, "false positive");
});

await check("a model-authored summary that assesses the person is logged, not silently shipped", async () => {
  const { deps, logs } = makeDeps(
    fakeBackend({ blockerOut: blocker({ summary: "The hire is struggling with the staging setup." }) }),
    createMemorySessionStore([storedSession]),
  );
  await handleUserMessage(deps, { slackUserId: "U1", text: "help" });
  ok(
    logs.some((l) => l.includes("assessment language")),
    "expected a warning in the bot log",
  );
});

// ══════════════════════════════════════ 4. the agent keeps moving them along

console.log("\nthe agent hands over the next task without being asked");

await check("finishing a task posts the next one", async () => {
  const advanced = makeHire({ taskStatus: { t1: "done", t2: "not_started" } });
  const { deps } = makeDeps(
    fakeBackend({ hire: advanced, reply: "That's it — green across the fixtures." }),
    createMemorySessionStore([storedSession]),
  );
  const actions = await handleUserMessage(deps, { slackUserId: "U1", text: "fixtures are green" });
  eq(dms(actions).length, 2, "DM count");
  ok(textOf(actions[1]).includes("Next up"), "missing the next-task heading");
  ok(textOf(actions[1]).includes(TASKS[1].title), "wrong task handed over");
});

await check("a turn that does not finish a task does not re-post the same card", async () => {
  const { deps } = makeDeps(fakeBackend(), createMemorySessionStore([storedSession]));
  const actions = await handleUserMessage(deps, { slackUserId: "U1", text: "quick question" });
  eq(dms(actions).length, 1, "DM count");
});

await check("finishing the whole ramp says so instead of going quiet", async () => {
  const done = makeHire({ taskStatus: { t1: "done", t2: "done" } });
  const { deps } = makeDeps(fakeBackend({ hire: done }), createMemorySessionStore([{ ...storedSession, lastTaskId: "t2" }]));
  const actions = await handleUserMessage(deps, { slackUserId: "U1", text: "done" });
  ok(actions.some((a) => textOf(a).includes("Ramp complete")), "missing the ramp-complete message");
});

// ═══════════════════════════════════════════════ 5. cold-open conversation

console.log("\nstarting from a DM");

await check("'start', 'hi' and '/onboard' all mean go", () => {
  for (const word of ["start", "Hi", "hey!", "begin", "ready", "onboard"]) {
    ok(isStartTrigger(word), `"${word}" should start the ramp`);
  }
  for (const notStart of ["hey, where do the fixtures live?", "start the fixtures rerunning please"]) {
    ok(!isStartTrigger(notStart), `"${notStart}" is a question, not a start signal`);
  }
});

await check("a question before any ramp exists gets a nudge, not a wasted model call", async () => {
  const backend = fakeBackend();
  const { deps } = makeDeps(backend, createMemorySessionStore());
  const actions = await handleUserMessage(deps, { slackUserId: "UNEW", text: "what is a playbook fork?" });
  eq(backend.calls.turn.length, 0, "backend turn calls");
  eq(backend.calls.start.length, 0, "backend start calls");
  eq(actions.length, 1, "message count");
  ok(textOf(actions[0]).includes("start"), "the nudge should say what to type");
});

await check("'hi' with no ramp derives one", async () => {
  const backend = fakeBackend();
  const { deps } = makeDeps(backend, createMemorySessionStore());
  const actions = await handleUserMessage(deps, { slackUserId: "UNEW2", text: "hi" });
  eq(backend.calls.start.length, 1, "backend start calls");
  eq(channelPosts(actions).length, 0, "channel posts");
});

await check("an @mention acknowledges in-thread and moves the work to the DM", async () => {
  const { deps } = makeDeps(fakeBackend(), createMemorySessionStore());
  const { outbound, startNeeded } = await handleMention(deps, {
    slackUserId: "UNEW3",
    channel: "C0PUBLIC",
    threadTs: "1724900000.000100",
  });
  eq(outbound.length, 1, "message count");
  eq(outbound[0].kind, "thread", "destination");
  eq(outbound[0].threadTs, "1724900000.000100", "thread ts");
  eq(startNeeded, true, "should need a derivation");
});

// ══════════════════════════════════════════════════ 6. Slack is not markdown

console.log("\nmrkdwn, not markdown");

await check("no rendered block contains ** anywhere", () => {
  const all = [...startActions, ...escalated].map(textOf).join("\n");
  ok(!all.includes("**"), "found literal ** — Slack renders that as asterisks");
});

await check("bold, bullets, headings and links convert", () => {
  eq(format.toMrkdwn("**bold**"), "*bold*", "bold");
  eq(format.toMrkdwn("__strong__"), "_strong_", "double underscore");
  eq(format.toMrkdwn("- one\n* two"), "• one\n• two", "bullets");
  eq(format.toMrkdwn("### Heading"), "*Heading*", "heading");
  eq(format.toMrkdwn("[docs](https://lexhav.com)"), "<https://lexhav.com|docs>", "link");
});

await check("Slack's markup characters are escaped", () => {
  eq(format.toMrkdwn("a & b < c > d"), "a &amp; b &lt; c &gt; d", "escaping");
});

await check("code fences are left alone, terminated or not", () => {
  eq(format.toMrkdwn("```\n- not a bullet\n```"), "```\n- not a bullet\n```", "code fence");
  eq(format.toMrkdwn("```\n### not a heading"), "```\n### not a heading", "unterminated fence");
});

await check("a long answer is split rather than rejected by Slack", () => {
  const long = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} ${"x".repeat(200)}`).join("\n\n");
  const blocks = format.prose(long);
  ok(blocks.length > 1, "expected a split");
  for (const b of blocks) ok(b.text.text.length <= 3000, `section over Slack's 3000-char limit (${b.text.text.length})`);
});

await check("every emitted block is structurally valid Block Kit", () => {
  const all = [...startActions, ...escalated];
  for (const action of all) {
    ok(action.blocks.length > 0 && action.blocks.length <= 50, "block count out of range");
    ok(typeof action.text === "string" && action.text.length > 0, "missing fallback text");
    for (const b of action.blocks) {
      ok(typeof b.type === "string", "block without a type");
      if (b.type === "section" && b.text) ok(b.text.text.length <= 3000, "section text too long");
      // `fields` are governed by their own, *lower* limits than `text` — 10
      // items, 2000 characters each. Getting this wrong is invisible until
      // Slack answers `invalid_blocks` on the escalation card.
      if (b.type === "section" && b.fields) {
        ok(b.fields.length <= 10, "too many section fields");
        for (const f of b.fields) ok(f.text.length <= 2000, "section field over Slack's 2000-char limit");
      }
      if (b.type === "header") {
        ok(b.text.type === "plain_text", "header must be plain_text");
        ok(b.text.text.length <= 150, "header text too long");
      }
      if (b.type === "context") ok(b.elements.length <= 10, "too many context elements");
    }
  }
});

// ═══════════════════════════════════════════════════════════ 7. the backend

console.log("\nthe HTTP backend speaks to the same routes the web panel does");

await check("start hits /api/derive, turn hits /api/chat", async () => {
  const seen = [];
  const backend = createHttpBackend({
    baseUrl: "http://localhost:3000/",
    fetchImpl: async (url, init) => {
      seen.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ hire: makeHire(), cached: true, reply: "ok", blocker: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  await backend.start({ name: "Sofia", roleTitle: "Legal Engineer", companySlug: "lexhav" });
  await backend.turn({ hireId: "hire-1", text: "hello" });
  eq(seen[0].url, "http://localhost:3000/api/derive", "derive url");
  eq(seen[0].body.companySlug, "lexhav", "derive body");
  ok(!("hireId" in seen[0].body), "hireId should be omitted when there is no existing hire");
  eq(seen[1].url, "http://localhost:3000/api/chat", "chat url");
  eq(seen[1].body.hireId, "hire-1", "chat body");
});

await check("the API's own error message is what surfaces", async () => {
  const backend = createHttpBackend({
    baseUrl: "http://localhost:3000",
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not set." }), { status: 500 }),
  });
  try {
    await backend.turn({ hireId: "x", text: "y" });
    throw new Error("should have thrown");
  } catch (err) {
    ok(err instanceof VanavApiError, "wrong error type");
    ok(err.message.includes("ANTHROPIC_API_KEY"), "lost the API's message");
  }
});

await check("a dead web app says 'npm run dev', not 'fetch failed'", async () => {
  const backend = createHttpBackend({
    baseUrl: "http://localhost:3000",
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  });
  try {
    await backend.turn({ hireId: "x", text: "y" });
    throw new Error("should have thrown");
  } catch (err) {
    ok(err.message.includes("npm run dev"), `unhelpful message: ${err.message}`);
  }
});

// ════════════════════════════════════════════════════════════ 8. the config

console.log("\nconfig failures say what to do about them");

await check("nothing set → one clear problem per variable", () => {
  try {
    loadSlackConfig({});
    throw new Error("should have thrown");
  } catch (err) {
    ok(err instanceof SlackConfigError, "wrong error type");
    eq(err.problems.length, 4, "problem count");
    ok(err.message.includes("docs/slack.md"), "should point at the setup doc");
  }
});

await check("swapped tokens are diagnosed by name", () => {
  try {
    loadSlackConfig({
      SLACK_BOT_TOKEN: "xapp-1-A01-999-abc",
      SLACK_APP_TOKEN: "xoxb-999-888-def",
      SLACK_MANAGER_CHANNEL: "C0MANAGER1",
      ANTHROPIC_API_KEY: "sk-ant-test",
    });
    throw new Error("should have thrown");
  } catch (err) {
    ok(err.problems.every((p) => p.includes("swapped")), "both tokens should be reported as swapped");
    ok(!err.message.includes("xapp-1-A01-999-abc"), "a token must never be echoed in full");
  }
});

await check("a valid environment produces sane defaults", () => {
  const config = loadSlackConfig({
    SLACK_BOT_TOKEN: "xoxb-1-2-3",
    SLACK_APP_TOKEN: "xapp-1-2-3",
    SLACK_MANAGER_CHANNEL: "#onboarding-blockers",
    ANTHROPIC_API_KEY: "sk-ant-test",
  });
  eq(config.apiBaseUrl, "http://localhost:3000", "default API url");
  eq(config.companySlug, "lexhav", "default company");
  eq(config.roleTitle, "Legal Engineer", "default role");
});

await check("a channel that is neither an ID nor a #name is rejected", () => {
  try {
    loadSlackConfig({
      SLACK_BOT_TOKEN: "xoxb-1-2-3",
      SLACK_APP_TOKEN: "xapp-1-2-3",
      SLACK_MANAGER_CHANNEL: "Onboarding Blockers",
      ANTHROPIC_API_KEY: "sk-ant-test",
    });
    throw new Error("should have thrown");
  } catch (err) {
    ok(err instanceof SlackConfigError, "wrong error type");
  }
});

// ─────────────────────────────────────────────────────────────── verdict

console.log(
  `\n  ${passed} passed, ${failures.length} failed` +
    `\n\n  Verified without Slack. What is NOT verified here: the socket handshake, the OAuth scopes,` +
    `\n  and whether chat.postMessage accepts these blocks — all of which need real tokens.\n`,
);

if (failures.length > 0) process.exit(1);
