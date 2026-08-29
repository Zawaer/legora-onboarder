/**
 * Environment, validated once, with errors somebody can act on.
 *
 * This runs at 2am the night before a demo, or five minutes before it, on a
 * laptop that has never had these variables set. The failure mode to avoid is a
 * stack trace from inside Bolt's socket client that says `invalid_auth` and
 * nothing else — which is what you get when the two tokens are swapped, and
 * which costs twenty minutes to diagnose if you have not seen it before.
 *
 * So: every check names the variable, says where in the Slack UI to get the
 * value, and points at docs/slack.md. The swapped-token case is called out by
 * name, because it is the mistake everyone makes exactly once.
 */

export type SlackConfig = {
  botToken: string;
  appToken: string;
  managerChannel: string;
  /** Where the Next app is serving `/api/chat` and `/api/derive`. */
  apiBaseUrl: string;
  companySlug: string;
  roleTitle: string;
  sessionsPath: string;
};

export class SlackConfigError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join("\n\n"));
    this.name = "SlackConfigError";
    this.problems = problems;
  }
}

const DOCS = "See docs/slack.md for the full click-path.";

export type EnvLike = Record<string, string | undefined>;

export function loadSlackConfig(env: EnvLike): SlackConfig {
  const problems: string[] = [];

  const botToken = (env.SLACK_BOT_TOKEN ?? "").trim();
  const appToken = (env.SLACK_APP_TOKEN ?? "").trim();
  const managerChannel = (env.SLACK_MANAGER_CHANNEL ?? "").trim();
  const anthropicKey = (env.ANTHROPIC_API_KEY ?? "").trim();

  // ── the bot token
  if (!botToken) {
    problems.push(
      "SLACK_BOT_TOKEN is not set.\n" +
        "  Get it at api.slack.com/apps → your app → OAuth & Permissions → Bot User OAuth Token.\n" +
        `  It starts with "xoxb-". Put it in .env.local. ${DOCS}`,
    );
  } else if (botToken.startsWith("xapp-")) {
    // The single most common setup mistake, and the least self-explanatory
    // failure: Slack answers with `invalid_auth` and no hint about which token.
    problems.push(
      'SLACK_BOT_TOKEN holds an app-level token (it starts with "xapp-"). The two tokens are swapped.\n' +
        "  SLACK_BOT_TOKEN  = xoxb-…  (OAuth & Permissions → Bot User OAuth Token)\n" +
        "  SLACK_APP_TOKEN  = xapp-…  (Basic Information → App-Level Tokens, scope connections:write)",
    );
  } else if (!botToken.startsWith("xoxb-")) {
    problems.push(
      `SLACK_BOT_TOKEN does not look like a bot token (expected it to start with "xoxb-", got "${redact(botToken)}").\n` +
        "  A user token (xoxp-) will not work: this app posts as the bot, not as you.",
    );
  }

  // ── the app-level token (Socket Mode)
  if (!appToken) {
    problems.push(
      "SLACK_APP_TOKEN is not set.\n" +
        "  Get it at api.slack.com/apps → your app → Basic Information → App-Level Tokens → Generate,\n" +
        `  with the connections:write scope. It starts with "xapp-". Without it there is no Socket Mode\n` +
        `  connection and the bot has no way to receive events. ${DOCS}`,
    );
  } else if (appToken.startsWith("xoxb-")) {
    problems.push(
      'SLACK_APP_TOKEN holds a bot token (it starts with "xoxb-"). The two tokens are swapped.\n' +
        "  SLACK_APP_TOKEN needs the xapp-… value from Basic Information → App-Level Tokens.",
    );
  } else if (!appToken.startsWith("xapp-")) {
    problems.push(
      `SLACK_APP_TOKEN does not look like an app-level token (expected "xapp-", got "${redact(appToken)}").\n` +
        "  App-level tokens are generated under Basic Information, not under OAuth & Permissions.",
    );
  }

  // ── the manager channel
  if (!managerChannel) {
    problems.push(
      "SLACK_MANAGER_CHANNEL is not set.\n" +
        "  This is where escalations go. Use the channel ID (open the channel → its name → About → the C… at\n" +
        "  the bottom), or #channel-name for a public channel. Invite the bot to it: /invite @Vanav.",
    );
  } else if (!/^([CG][A-Z0-9]{6,}|#[a-z0-9_-]{1,80})$/.test(managerChannel)) {
    problems.push(
      `SLACK_MANAGER_CHANNEL ("${managerChannel}") is neither a channel ID (C…) nor a #channel-name.\n` +
        "  Channel names are lowercase with hyphens. IDs are more reliable — a renamed channel keeps its ID.",
    );
  }

  // ── the model key
  //
  // The bot never calls Anthropic itself; the Next server does. It is checked
  // here anyway because both processes read the same .env.local, and finding
  // out the key is missing 35 seconds into the first supervision turn — as an
  // error inside a "thinking" bubble, in front of an audience — is strictly
  // worse than finding out at startup.
  if (!anthropicKey) {
    problems.push(
      "ANTHROPIC_API_KEY is not set.\n" +
        "  The bot does not call Anthropic directly — the Next server does — but both read .env.local, so a\n" +
        "  missing key here means every supervision turn will fail. Add it before you start the bot.",
    );
  }

  if (problems.length > 0) throw new SlackConfigError(problems);

  return {
    botToken,
    appToken,
    managerChannel,
    apiBaseUrl: (env.VANAV_API_URL ?? "http://localhost:3000").trim().replace(/\/+$/, ""),
    companySlug: (env.VANAV_COMPANY ?? "lexhav").trim(),
    roleTitle: (env.VANAV_ROLE ?? "Legal Engineer").trim(),
    sessionsPath: (env.SLACK_SESSIONS_PATH ?? "data/slack-sessions.json").trim(),
  };
}

/** Never print a whole secret, even a wrong one — terminals get screen-shared. */
function redact(token: string): string {
  return token.length <= 8 ? "…" : `${token.slice(0, 5)}…${token.slice(-2)}`;
}

/** The startup banner. Says what it will do and where, without leaking tokens. */
export function describeConfig(config: SlackConfig): string {
  return [
    `  workspace tokens : bot ${redact(config.botToken)} · app ${redact(config.appToken)}`,
    `  escalations to   : ${config.managerChannel}`,
    `  agent API        : ${config.apiBaseUrl}  (must be running — npm run dev)`,
    `  company / role   : ${config.companySlug} · ${config.roleTitle}`,
    `  sessions file    : ${config.sessionsPath}`,
  ].join("\n");
}
