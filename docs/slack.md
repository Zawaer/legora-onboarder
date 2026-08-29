# Onboarder in Slack

The product's claim is that it lives where onboarding actually happens: the new
hire's DM, and the channel a senior person is already ignoring. This is that
surface — a Socket Mode bot that opens the conversation, supervises it, and
posts to a manager channel **only when a human is genuinely required**.

Ten minutes, start to finish, and none of it needs a public URL.

---

## Read this before you install anything

**This runs in *our* Slack workspace, not a customer's.**

Installing an app into a real company's Slack needs a workspace admin to approve
it, and at most companies that is a ticket, a security review and a week. That
is not happening this weekend, and pretending otherwise in a demo is the kind of
claim that gets checked.

The honest line, and the one to say out loud:

> "This is running live in our workspace. It installs into yours in ten minutes."

Which is true — everything below is the ten minutes.

**Why Socket Mode.** The alternative is Events API over HTTPS, which needs a
public URL, which on a laptop means ngrok, which means a tunnel that dies when
the venue wifi reassigns your IP, plus re-pasting the new URL into Slack's
config and re-verifying the endpoint. Socket Mode dials *out* to Slack over a
websocket. No inbound port, no tunnel, no OAuth redirect, no URL verification
handshake. It is the only transport that reliably survives a conference network.

---

## Setup — the exact click-path

### 0. Prerequisites

- Node **23.6 or newer** (`node --version`). The bot runs the repo's TypeScript
  directly using Node's built-in type stripping — no build step, no extra
  dependency. Older Node cannot parse the files and will say so on startup.
- A Slack workspace you can install apps into. If you cannot create apps, you
  are not an admin of it — use a free personal workspace instead
  (`slack.com/create`), which takes two minutes and is fine for the demo.

### 1. Create the app

1. Go to **<https://api.slack.com/apps>** → **Create New App** → **From scratch**.
2. Name it **Onboarder**. Pick your workspace. → **Create App**.

### 2. Turn on Socket Mode and get the app-level token

3. Left sidebar → **Settings → Socket Mode** → toggle **Enable Socket Mode** on.
4. Slack will immediately ask you to create an app-level token. Name it
   `socket`, and make sure the scope **`connections:write`** is added. →
   **Generate**.
5. **Copy the `xapp-…` token now.** This is `SLACK_APP_TOKEN`. Slack shows it
   once; if you lose it, generate another under **Basic Information →
   App-Level Tokens**.

> An app-level token is *not* a bot token. It authorises the websocket, not the
> API calls. You need both, and they are generated on different pages.

### 3. Add the bot scopes

6. Left sidebar → **Features → OAuth & Permissions** → scroll to **Scopes** →
   **Bot Token Scopes** → **Add an OAuth Scope**, and add exactly these five:

   | Scope | What breaks without it |
   | --- | --- |
   | `chat:write` | The bot cannot post at all — no DM, no escalation |
   | `im:history` | The bot never sees the hire's replies; the DM goes one-way |
   | `im:write` | `/onboard` cannot open a DM to speak first |
   | `commands` | The `/onboard` slash command does not exist |
   | `app_mentions:read` | `@Onboarder` in a channel is silently ignored |

   Optional, and only cosmetic: **`users:read`** lets the bot use the hire's
   real name instead of "New hire". It is deliberately not required — a missing
   scope must never be the reason a demo does not start.

### 4. Subscribe to the two events

7. Left sidebar → **Features → Event Subscriptions** → toggle **Enable Events**
   on. With Socket Mode enabled there is **no Request URL field** — that is the
   point of Socket Mode, and its absence means you did step 3 correctly.
8. Expand **Subscribe to bot events** and add:
   - **`message.im`** — the hire's DMs
   - **`app_mention`** — `@Onboarder` in a channel
9. **Save Changes** (bottom right).

### 5. Turn on the Messages tab — do not skip this one

Scopes and event subscriptions decide what the bot may *read*. They do not
decide whether Slack lets a human **type into the DM at all**. That is a
separate switch, it is on a different page, and with it off the hire opens the
bot's DM and finds the message box replaced by *"Sending messages to this app
has been turned off."* No `message.im` event is ever emitted, so the bot looks
dead while every scope and subscription is correct — the worst possible shape
for a bug ten minutes before a demo.

Slack's own App Home guide lists it as a required step alongside the scope and
the event: *"Under **Show Tab**, switch on the **Messages Tab** toggle"*
(<https://docs.slack.dev/surfaces/app-home>).

10. Left sidebar → **Features → App Home** → scroll to **Show Tabs**.
11. Switch the **Messages Tab** toggle **on**, and — underneath it — tick
    **"Allow users to send Slash commands and messages from the messages tab"**.

    The toggle alone is not enough: it shows the tab, the checkbox is what makes
    the input box writable. Both. If Slack was already open, quit and reopen it —
    the desktop client caches this.

### 6. Create the slash command

12. Left sidebar → **Features → Slash Commands** → **Create New Command**:
    - Command: `/onboard`
    - Short description: `Start your ramp`
    - Usage hint: `[role title]`
    - Leave Request URL **empty** — Socket Mode delivers it.
13. **Save**.

### 7. Install to the workspace

14. Left sidebar → **Settings → Install App** → **Install to Workspace** →
    **Allow**.
15. **Copy the `xoxb-…` Bot User OAuth Token.** This is `SLACK_BOT_TOKEN`.

> Every time you change scopes you must come back here and **reinstall**.
> Scopes added but not reinstalled do nothing, and the error Slack gives you is
> `missing_scope` with no indication that reinstalling is the fix.

### 8. Make a manager channel and invite the bot

16. In Slack, create a channel — `#onboarding-blockers` is a good name for a
    demo, because the audience can read the purpose off the tab.
17. In that channel, type: **`/invite @Onboarder`**

    Do not skip this. A bot that is not a member of a channel cannot post to it,
    and the error (`not_in_channel`) arrives at the exact moment your escalation
    was supposed to appear on screen.
18. Get the channel ID: click the channel name → **About** → the `C…` value at
    the bottom → copy. Use the ID, not `#name`: a rename keeps the ID, and
    Slack's own guidance for `chat.postMessage` is to "always use channel-like
    IDs instead" of names.

### 9. Configure and run

19. In `.env.local` (create it from `.env.example` if it does not exist):

    ```bash
    ANTHROPIC_API_KEY=sk-ant-…
    SLACK_BOT_TOKEN=xoxb-…
    SLACK_APP_TOKEN=xapp-…
    SLACK_MANAGER_CHANNEL=C09XXXXXXXX
    ```

20. Two terminals. The bot is a **separate process** from the web app and needs
    it running — see "How it fits together" below.

    ```bash
    # terminal 1 — the agent + the manager dashboard
    npm run dev

    # terminal 2 — the Slack surface
    npm run slack
    ```

    You should see:

    ```
      Onboarder is live in Slack.  (scripts/slack-bot.mjs, Socket Mode — no public URL)

      workspace tokens : bot xoxb-…4f · app xapp-…9c
      escalations to   : C09XXXXXXXX
      agent API        : http://localhost:3000  (must be running — npm run dev)
      …
    ```

21. In Slack, DM the bot (find **Onboarder** under **Apps**) and type `start`,
    or run `/onboard` from anywhere. If the DM has no message box, step 5 is
    not done.

---

## The demo, in the order it should happen

1. **`/onboard`** — or just `start` in the DM. The agent derives the role from
   the company corpus and **speaks first**: the opening message, then a real
   first task with its context, its done-when, and who owns that area. Nobody
   asked it anything. That is the thesis.

   First run of the day takes a couple of minutes (two Opus calls over the whole
   corpus). Every run after that is a cached derivation and takes seconds — so
   **run it once before the demo starts**.

2. **Ask it something the corpus can answer.** "Where do the clause fixtures
   live?" It answers, quoting the thread it came from. The manager channel stays
   completely silent. Point at that silence — it is the feature.

3. **Ask it something only a person can settle.** Anything needing a credential,
   an access grant or a decision nobody has made. Now the escalation appears in
   `#onboarding-blockers`, naming one person and an honest number of minutes.

4. **Open `/manager` in the browser.** The same blocker is there. One state, two
   surfaces — the Slack bot and the web app are talking to the same agent.

---

## How it fits together

```
Slack  ──socket──  scripts/slack-bot.mjs  ──HTTP──  next dev  ──▶  Claude
                   (transport only)                 /api/chat
                                                    /api/derive
                                                          │
                                                    data/hires.json
                                                          │
                                                    /manager (web)
```

**The bot does not call the model itself.** It posts turns to `POST /api/chat` —
the same route the web panel uses — so the Slack surface inherits the blocker
dedupe, the task-status update and the persistence ordering rather than growing
a second copy of them that drifts.

That is also why there is exactly one writer for `data/hires.json`. The write
lock in `lib/agent/hires.ts` is in-process only; two processes doing
read-modify-write on one JSON file lose updates, and the way that shows up is
the hire's last few messages vanishing from the manager dashboard mid-demo.

The cost is that `npm run dev` has to be running. That is the one precondition,
and the bot says so by name if it is not.

**Nothing under `app/` imports `@slack/bolt`.** The Next build neither knows nor
cares that this exists, and the repo typechecks and builds cleanly with no
Slack tokens set at all.

---

## Troubleshooting

### "The escalation never showed up in the channel"

The bot is not in the channel. This is the single most common failure and Slack
reports it as `not_in_channel`, which does not say what to do.

The bot terminal prints a banner when this happens:

```
  ESCALATION NOT DELIVERED — the bot is not in C09XXXXXXXX.
  Fix: open that channel in Slack and run  /invite @Onboarder
```

**Fix:** open the channel in Slack, type `/invite @Onboarder`. If the channel is
private, the bot must be invited *and* you will see `channel_not_found` rather
than `not_in_channel` until it is — a private channel is invisible to apps that
are not members. For a demo, use a public channel.

Also check `SLACK_MANAGER_CHANNEL` is the channel you are watching. A `C…` ID
that points at some other channel fails completely silently, because the post
genuinely succeeded.

### "`missing_scope`, or the bot ignores my DMs"

Three different causes with the same shape. Check them in this order, because
the third one is the only one that is invisible from the terminal:

- **The Messages tab is off** (step 5). Look at the DM in Slack. If there is no
  message box — just *"Sending messages to this app has been turned off"* — no
  event is being suppressed, none is being *generated*. Nothing you do to scopes
  or subscriptions will change that. **Features → App Home → Show Tabs →
  Messages Tab** on, plus the **"Allow users to send Slash commands and messages
  from the messages tab"** checkbox under it. Then quit and reopen Slack.
- **Scope added but never reinstalled.** Adding a scope under *OAuth &
  Permissions* does nothing until you go to **Settings → Install App →
  Reinstall to Workspace**. The existing `xoxb-` token carries the *old* scope
  set. Reinstall, then copy the token again — it may have rotated.
- **Event not subscribed.** Scopes and event subscriptions are separate.
  `im:history` lets the bot *read* DMs; the **`message.im`** event subscription
  is what makes Slack *deliver* them. You need both. Same for
  `app_mentions:read` and the **`app_mention`** event.

Quick check: `SLACK_LOG_LEVEL=debug npm run slack` prints every event Slack
delivers. If typing in the DM prints nothing at all, it is the Messages tab or
the event subscription — not the scope.

### "`invalid_auth` on startup"

The two tokens are swapped. This is the mistake everyone makes exactly once, and
Slack's error names neither token.

```
SLACK_BOT_TOKEN = xoxb-…   OAuth & Permissions → Bot User OAuth Token
SLACK_APP_TOKEN = xapp-…   Basic Information → App-Level Tokens (connections:write)
```

The bot checks the prefixes at startup and tells you if they are the wrong way
round before it ever contacts Slack. If it got as far as `invalid_auth`, the
prefixes were right and the *value* is stale — reinstall the app and copy the
new `xoxb-` token.

If Slack rejects the **app-level** token instead, it was almost certainly
generated without `connections:write`, or Socket Mode got switched back off.
Regenerate it under **Basic Information → App-Level Tokens** with that scope.

### Other things that have bitten us

| Symptom | Cause |
| --- | --- |
| The bot's DM has no message box at all | The Messages tab is off, or its "allow users to send…" checkbox is unticked — step 5 |
| `Cannot reach the Onboarder API at http://localhost:3000` | `npm run dev` is not running, or is on another port — set `ONBOARDER_API_URL` |
| Every turn errors with an Anthropic message | `ANTHROPIC_API_KEY` missing or rejected; it is the *Next* process that needs it |
| `/onboard` says "dispatch_failed" | The slash command was created but the app was not reinstalled afterwards |
| Bot replies to itself in a loop | Not possible here — Bolt's `ignoreSelf` is on and the handler drops anything with a `bot_id` |
| Startup error about Node version | Node older than 23.6; `nvm install 24 && nvm use 24` |
| The first `/onboard` takes two minutes | Cold derivation — two Opus calls over the whole corpus. Run it once before the demo; after that it is cached |

---

## What is verified, and what is not

Run the harness:

```bash
npm run slack:test
```

It exercises every handler as a pure function against fixtures — no Slack, no
tokens, no network. It asserts, four different ways, the one thing that must not
break: **the manager channel gets nothing unless a human is genuinely needed.**

What it cannot verify, because that needs real tokens: the Socket Mode
handshake, whether the installed scope set is complete, and whether Slack's API
accepts these exact blocks. The first `/onboard` against a real workspace is the
first time any of that runs.

---

## Files

| File | What it is |
| --- | --- |
| `scripts/slack-bot.mjs` | The process. Transport only: sockets, placeholders, delivery |
| `lib/slack/app.ts` | Every decision, as pure functions returning described messages |
| `lib/slack/format.ts` | Block Kit + markdown→mrkdwn. Also the no-surveillance guard |
| `lib/slack/backend.ts` | HTTP client for `/api/chat` and `/api/derive`, and why it is HTTP |
| `lib/slack/config.ts` | Env validation with errors you can act on |
| `lib/slack/sessions.ts` | Slack user → hire, surviving a bot restart |
| `lib/slack/hook.mjs`, `resolver.mjs` | Lets plain `node` import this repo's TypeScript |
| `lib/slack/harness.mjs` | The test harness above |
