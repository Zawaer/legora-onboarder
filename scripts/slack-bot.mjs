/**
 * Vanav in Slack. One command:
 *
 *     node scripts/slack-bot.mjs          (or: npm run slack)
 *
 * Socket Mode, on purpose. No public URL, no tunnel, no OAuth redirect, no
 * ngrok that dies when the venue wifi reassigns your IP — the bot dials out to
 * Slack over a websocket and that is the entire networking story. It is the
 * only Slack transport that works reliably from a laptop on a conference
 * network, which is exactly the condition this has to survive.
 *
 * This file is the transport and nothing else. Every decision — when to speak,
 * what to say, and above all whether a human gets interrupted — lives in
 * `lib/slack/app.ts` as pure functions, so it can be tested without a
 * workspace (`npm run slack:test`). What is here is Slack plumbing: sockets,
 * placeholders, retries, and turning `Outbound` descriptions into API calls.
 *
 * It is a separate process from `next dev` by design and shares nothing with
 * it but HTTP. Nothing under `app/` imports Bolt; the Next build neither knows
 * nor cares that this exists.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { App, LogLevel } from "@slack/bolt";

// Installs the `@/…` alias + TypeScript resolver. Must run before anything
// under lib/ is imported, which is why every such import below is dynamic.
import { repoRoot } from "../lib/slack/hook.mjs";

const SLASH_COMMAND = "/onboard";

// ─────────────────────────────────────────────────────────── env files

/**
 * Load `.env` then `.env.local`, without clobbering anything already exported
 * in the shell.
 *
 * `next dev` does this for the web app; a bare node process does not, and the
 * resulting "SLACK_BOT_TOKEN is not set" while the value is plainly sitting in
 * .env.local is a genuinely confusing five minutes.
 */
function loadEnvFiles() {
  const preset = new Set(Object.keys(process.env));
  const before = { ...process.env };
  for (const file of [".env", ".env.local"]) {
    try {
      process.loadEnvFile(path.join(repoRoot, file));
    } catch {
      // Absent is fine — a shell export or a real environment is equally valid.
    }
  }
  // Explicit shell values win over files. Surprising precedence is a debugging
  // tax nobody has time for mid-demo.
  for (const key of preset) process.env[key] = before[key];
}

loadEnvFiles();

// ───────────────────────────────────────────────── config + wiring

const { loadSlackConfig, SlackConfigError, describeConfig } = await import("../lib/slack/config.ts");

let config;
try {
  config = loadSlackConfig(process.env);
} catch (err) {
  if (err instanceof SlackConfigError) {
    console.error(`\n  Vanav's Slack bot is not configured yet.\n`);
    for (const problem of err.problems) console.error(`  • ${problem.replace(/\n/g, "\n    ")}\n`);
    console.error(`  All of these go in .env.local (see .env.example). Full setup: docs/slack.md\n`);
    process.exit(1);
  }
  throw err;
}

const { createHttpBackend, VanavApiError } = await import("../lib/slack/backend.ts");
const { createFileSessionStore } = await import("../lib/slack/sessions.ts");
const { handleStart, handleUserMessage, handleMention } = await import("../lib/slack/app.ts");
const { thinkingBlocks, errorBlocks, channelRef } = await import("../lib/slack/format.ts");

// The real implementations, imported rather than reimplemented: `currentTask`
// is the agent's own definition of "the task they are on", and `getCompany`
// the same roster the web surface reads. A second copy of either here would be
// wrong the first time the other one changed.
const { currentTask } = await import("@/lib/agent/supervise");
const { getCompany } = await import("@/lib/seed");

const company = getCompany(config.companySlug);
if (!company) {
  console.error(
    `\n  VANAV_COMPANY is "${config.companySlug}", which is not seeded.\n` +
      `  Seeded companies live in lib/seed/. Leave the variable unset to use the default.\n`,
  );
  process.exit(1);
}

const deps = {
  backend: createHttpBackend({ baseUrl: config.apiBaseUrl }),
  sessions: createFileSessionStore(path.resolve(repoRoot, config.sessionsPath)),
  managerChannel: config.managerChannel,
  defaults: { companySlug: config.companySlug, roleTitle: config.roleTitle },
  company,
  currentTask,
  log: (message) => console.warn(message),
};

const app = new App({
  token: config.botToken,
  appToken: config.appToken,
  socketMode: true,
  logLevel: process.env.SLACK_LOG_LEVEL === "debug" ? LogLevel.DEBUG : LogLevel.INFO,
  // Bolt otherwise verifies the bot token from inside the constructor, where
  // the rejection lands outside every try/catch and surfaces as a raw
  // `WebAPIPlatformError: invalid_auth` stack trace with no hint about which of
  // the two tokens is wrong. Deferring lets `app.init()` fail where we can
  // translate it. (Verified locally with deliberately bad tokens.)
  deferInitialization: true,
});

// ─────────────────────────────────────────────────────────── delivery

/**
 * The hire's DM channel id.
 *
 * A slash command can be typed anywhere, so the id in the payload is often a
 * public channel. `conversations.open` is idempotent and returns the existing
 * DM, so it is safe to call on every command.
 */
async function dmChannelFor(client, userId) {
  const opened = await client.conversations.open({ users: userId });
  return opened.channel?.id;
}

/**
 * Display name, best effort.
 *
 * `users.info` needs the `users:read` scope, which is deliberately *not* in the
 * required set in docs/slack.md — it buys a nicer name and nothing else, and a
 * missing scope must never be the reason a demo does not start. Without it the
 * hire is "New hire", which is fine.
 */
const nameCache = new Map();
async function displayName(client, userId, fallbackName) {
  if (fallbackName) return fallbackName;
  if (nameCache.has(userId)) return nameCache.get(userId);
  let name;
  try {
    const info = await client.users.info({ user: userId });
    name = info.user?.profile?.real_name || info.user?.real_name || info.user?.name;
  } catch {
    name = undefined;
  }
  nameCache.set(userId, name);
  return name;
}

/** Turn one `Outbound` into an API call. `replace` consumes the thinking placeholder. */
async function send(client, action, dmChannel, replace) {
  if (action.kind === "channel") {
    try {
      await client.chat.postMessage({ channel: action.channel, text: action.text, blocks: action.blocks });
      console.log(`[slack] escalation posted to ${action.channel}`);
    } catch (err) {
      // Troubleshooting item #1 in docs/slack.md, made impossible to miss. The
      // Slack error for this is `not_in_channel`, which says nothing about what
      // to do next.
      const code = err?.data?.error ?? err?.message;
      if (code === "not_in_channel" || code === "channel_not_found") {
        console.error(
          `\n  ────────────────────────────────────────────────────────────\n` +
            `  ESCALATION NOT DELIVERED — the bot is not in ${action.channel}.\n` +
            `  Fix: open that channel in Slack and run  /invite @Vanav\n` +
            `  (channel_not_found also means "private channel the bot cannot see".)\n` +
            `  ────────────────────────────────────────────────────────────\n`,
        );
      } else if (code === "missing_scope") {
        console.error(
          `\n  ESCALATION NOT DELIVERED — the app is missing the chat:write scope.\n` +
            `  Add it under OAuth & Permissions, then REINSTALL the app to the workspace.\n`,
        );
      } else {
        console.error(`[slack] could not post escalation to ${action.channel}:`, code ?? err);
      }
    }
    return replace;
  }

  if (action.kind === "thread") {
    await client.chat.postMessage({
      channel: action.channel,
      thread_ts: action.threadTs,
      text: action.text,
      blocks: action.blocks,
    });
    return replace;
  }

  // A DM. The first one edits the thinking placeholder in place, so the
  // conversation reads as one turn rather than a bubble of filler followed by
  // an answer.
  if (replace) {
    await client.chat.update({ channel: replace.channel, ts: replace.ts, text: action.text, blocks: action.blocks });
    return undefined;
  }
  await client.chat.postMessage({ channel: dmChannel, text: action.text, blocks: action.blocks });
  return undefined;
}

/**
 * Run a handler behind a live "thinking" message.
 *
 * Posted before the work starts and edited every few seconds while it runs.
 * Twenty to forty seconds of nothing is the single easiest way to make a
 * working agent look broken.
 */
async function withThinking(client, dmChannel, mode, work) {
  const placeholder = await client.chat.postMessage({
    channel: dmChannel,
    text: "Thinking…",
    blocks: thinkingBlocks(0, mode),
  });
  const startedAt = Date.now();

  // The answer and the tick both edit the *same* message, so they race. A tick
  // fired at t=29.9s is still in flight when the turn finishes at t=30.0s, and
  // whichever `chat.update` Slack applies last wins — which means the finished
  // answer can be overwritten by a frozen "Still going… · 30s" bubble that
  // never updates again. Slack has no compare-and-swap on `ts`; the only fix is
  // to make the two writers mutually exclusive here. `pending` serialises the
  // ticks, and `finished` stops new ones being queued, so awaiting `pending`
  // before the first real edit guarantees no thinking-update is outstanding.
  let finished = false;
  let pending = Promise.resolve();
  const ticker = setInterval(() => {
    if (finished) return;
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    pending = pending.then(() => {
      if (finished) return undefined;
      return client.chat
        .update({
          channel: dmChannel,
          ts: placeholder.ts,
          text: "Thinking…",
          blocks: thinkingBlocks(seconds, mode),
        })
        .catch(() => {
          /* a dropped tick is cosmetic; never let it kill the turn */
        });
    });
  }, 5000);

  /** Stop ticking and wait for any edit already on the wire to land. */
  async function settle() {
    finished = true;
    clearInterval(ticker);
    await pending.catch(() => {});
  }

  let replace = { channel: dmChannel, ts: placeholder.ts };
  try {
    const actions = await work();
    await settle();
    for (const action of actions) {
      replace = await send(client, action, dmChannel, replace);
    }
    // A handler that produced no DM would otherwise leave the placeholder
    // spinning forever, which is the exact "looks broken" failure it exists to
    // prevent.
    if (replace) {
      await client.chat.delete({ channel: replace.channel, ts: replace.ts }).catch(() => {});
    }
  } catch (err) {
    await settle();
    const message =
      err instanceof VanavApiError ? err.message : (err?.message ?? "Unexpected error.");
    console.error("[slack]", err);
    // Only edit the placeholder if it is still a placeholder. Once `send` has
    // turned it into the agent's actual answer, `replace` is undefined and
    // editing that `ts` would delete a delivered answer to show an error about
    // a *later* message — losing the one thing the hire was waiting for.
    const notice = { text: "Something went wrong.", blocks: errorBlocks(message) };
    await (replace
      ? client.chat.update({ channel: replace.channel, ts: replace.ts, ...notice })
      : client.chat.postMessage({ channel: dmChannel, ...notice })
    ).catch(() => {});
  }
}

// ────────────────────────────────────────────────────────── listeners

app.command(SLASH_COMMAND, async ({ command, ack, client, respond }) => {
  // Slack kills the command after 3 seconds without an ack, and a cold
  // derivation takes minutes. Ack first, work after.
  await ack();

  let dmChannel;
  try {
    dmChannel = await dmChannelFor(client, command.user_id);
  } catch (err) {
    const code = err?.data?.error ?? err?.message;
    console.error(`[slack] conversations.open failed (${code}) — check the im:write scope, then reinstall.`);
    await respond({
      text:
        "I couldn't open a DM with you. The app is missing the `im:write` scope — add it under " +
        "OAuth & Permissions and *reinstall* the app (adding a scope without reinstalling does nothing).",
    }).catch(() => {});
    return;
  }
  if (!dmChannel) {
    await respond({ text: "Slack did not return a DM channel. See docs/slack.md." }).catch(() => {});
    return;
  }

  if (command.channel_name !== "directmessage") {
    await respond({ text: "Started — everything's in our DM." }).catch(() => {});
  }

  const roleTitle = command.text?.trim() || undefined;

  await withThinking(client, dmChannel, "derive", () =>
    handleStart(deps, {
      slackUserId: command.user_id,
      // Free from the payload, so no `users:read` scope is needed on this path.
      profileName: prettifyUserName(command.user_name),
      roleTitle,
    }),
  );
});

app.message(async ({ message, client }) => {
  // Only real, human, first-party DMs. Edits, joins, thread broadcasts and the
  // bot's own posts all arrive here too and must not start a supervision turn.
  if (message.channel_type !== "im") return;
  if (message.subtype !== undefined) return;
  if (message.bot_id || !message.user || !message.text) return;

  const profileName = await displayName(client, message.user);

  await withThinking(client, message.channel, "turn", () =>
    handleUserMessage(deps, {
      slackUserId: message.user,
      text: message.text,
      profileName,
    }),
  );
});

app.event("app_mention", async ({ event, client }) => {
  if (!event.user) return;

  // Acknowledge in the thread immediately. Deriving a role takes minutes; a
  // mention that sits unanswered for two of them looks like the bot is down.
  const { outbound, startNeeded } = await handleMention(deps, {
    slackUserId: event.user,
    channel: event.channel,
    threadTs: event.thread_ts ?? event.ts,
  });
  for (const action of outbound) await send(client, action, undefined, undefined);

  if (!startNeeded) return;

  let dmChannel;
  try {
    dmChannel = await dmChannelFor(client, event.user);
  } catch (err) {
    console.error("[slack] could not open a DM (is the im:write scope installed?):", err?.data?.error ?? err);
    return;
  }
  if (!dmChannel) return;

  const profileName = await displayName(client, event.user);
  await withThinking(client, dmChannel, "derive", () =>
    handleStart(deps, { slackUserId: event.user, profileName }),
  );
});

app.error(async (error) => {
  // Bolt's default handler rethrows, which takes the socket down with it. A
  // demo that survives one bad event is worth more than a clean stack trace.
  console.error("[slack] unhandled:", error);
});

/** `toivo.hansen` → `Toivo Hansen`. Slack usernames are lowercase and dotted. */
function prettifyUserName(userName) {
  if (!userName) return undefined;
  return userName
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ─────────────────────────────────────────────────────────────── start

const scriptPath = path.relative(repoRoot, fileURLToPath(import.meta.url));

try {
  await app.init(); // validates the bot token
  await app.start(); // opens the Socket Mode connection with the app token
} catch (err) {
  const code = String(err?.data?.error ?? err?.code ?? err?.message ?? "unknown");
  console.error(`\n  Could not connect to Slack (${code}).\n`);
  if (code.includes("invalid_auth") || code.includes("not_authed") || code.includes("account_inactive")) {
    console.error(
      `  Slack rejected the *bot* token (SLACK_BOT_TOKEN). Almost always one of:\n` +
        `    • the two tokens are swapped — xoxb- is SLACK_BOT_TOKEN, xapp- is SLACK_APP_TOKEN\n` +
        `    • the app was reinstalled and the bot token rotated — copy the new xoxb- value\n` +
        `    • the app was never installed to the workspace (OAuth & Permissions → Install)\n`,
    );
  } else if (code.includes("invalid") || code.includes("socket") || code.includes("connections")) {
    console.error(
      `  Slack rejected the *app-level* token (SLACK_APP_TOKEN). Almost always one of:\n` +
        `    • it was generated without the connections:write scope — regenerate it with that scope\n` +
        `    • Socket Mode is switched off (Settings → Socket Mode → Enable)\n`,
    );
  }
  console.error(`  Setup: docs/slack.md\n`);
  process.exit(1);
}

console.log(
  [
    ``,
    `  Vanav is live in Slack.  (${scriptPath}, Socket Mode — no public URL)`,
    ``,
    describeConfig(config),
    ``,
    `  Try it:  ${SLASH_COMMAND}  in any channel or DM,  or just say "start" in the bot's DM.`,
    `  Escalations land in ${channelRef(config.managerChannel)} — and nowhere else, on turns the agent`,
    `  resolves itself. Silence there is the product working, not the bot being down.`,
    ``,
  ].join("\n"),
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log("\n  Vanav disconnected from Slack.");
    app.stop().finally(() => process.exit(0));
  });
}
