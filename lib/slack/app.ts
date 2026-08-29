/**
 * The Slack surface's brain — and deliberately the only part of it that makes
 * decisions.
 *
 * Every handler here is a plain async function of (injected dependencies,
 * incoming event) that returns a list of *described* messages. It never holds a
 * Slack client, never calls `chat.postMessage`, never reads `process.env`. The
 * transport lives in `scripts/slack-bot.mjs`.
 *
 * That split is not architecture for its own sake. There are no Slack tokens on
 * this machine and there will not be until someone creates the app, so the only
 * way to actually *verify* the behaviour that matters — "post to the manager
 * channel if and only if a human is genuinely needed" — is to make it a pure
 * function over data and assert on the returned list. `lib/slack/harness.mjs`
 * does exactly that, with no network and no workspace.
 *
 * THE INVARIANT THIS FILE EXISTS TO PROTECT
 *
 * A `channel` message is emitted only when the agent returns a blocker with
 * `needsHuman: true` that survived the API's dedupe. Not when the agent is
 * uncertain. Not when it raised a blocker it resolved itself. Not "for
 * visibility". The product's entire promise is that a human gets interrupted
 * only when a human is required, and a bot that posts a card on every turn has
 * broken that promise in the most visible place possible — the channel the
 * buyer is watching.
 */

import type { Blocker, Company, HireState, RampTask } from "@/lib/types";
import type { OnboarderBackend } from "./backend";
import type { SessionStore } from "./sessions";
import {
  type Block,
  blockerBlocks,
  blockerFallback,
  channelRef,
  context,
  fallback,
  findAssessmentLanguage,
  findPerson,
  header,
  prose,
  section,
  splitOpening,
  taskBlocks,
  taskFallback,
} from "./format";

// ─────────────────────────────────────────────────────────────────── types

/** A message we want sent, described as data so it can be asserted on. */
export type Outbound =
  | { kind: "dm"; text: string; blocks: Block[] }
  | { kind: "channel"; channel: string; text: string; blocks: Block[] }
  | { kind: "thread"; channel: string; threadTs: string; text: string; blocks: Block[] };

export type SlackDeps = {
  backend: OnboarderBackend;
  sessions: SessionStore;
  /** Where escalations go. Channel ID (`C…`) or `#name`. */
  managerChannel: string;
  defaults: { companySlug: string; roleTitle: string };
  /** Roster, so an escalation can name a handle and a job title rather than a bare string. */
  company?: Company;
  /**
   * Injected rather than imported so this module stays free of runtime
   * dependencies on the agent tree — and, more importantly, so the bot uses
   * `lib/agent/supervise.ts`'s definition of "the task they are on" instead of
   * growing a second one here that drifts the first time the plan shape changes.
   */
  currentTask: (hire: HireState) => RampTask | undefined;
  log?: (message: string) => void;
};

export type StartInput = {
  slackUserId: string;
  /** Slack display name, used as the hire's name. */
  profileName?: string;
  /** From `/onboard <role title>`. Falls back to the session, then the configured default. */
  roleTitle?: string;
};

export type MessageInput = {
  slackUserId: string;
  text: string;
  profileName?: string;
};

export type MentionInput = {
  slackUserId: string;
  channel: string;
  threadTs: string;
  profileName?: string;
};

// ────────────────────────────────────────────────────────────────── helpers

/**
 * Words that mean "go".
 *
 * Someone who has just been added to a Slack app does not know the slash
 * command exists; they type "hi". Treating that as the start signal is the
 * difference between the demo opening itself and the demo waiting for a command
 * nobody knew to run. Bounded in length so a real question that happens to
 * begin with "hey" is not swallowed as a restart.
 */
const START_WORDS = /^(start|begin|onboard|go|hi|hey|hello|yo|ready)\b[\s!.?]*$/i;

export function isStartTrigger(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length <= 24 && START_WORDS.test(trimmed);
}

function nowIso(): string {
  return new Date().toISOString();
}

/** The agent's own first words, as persisted by `/api/derive`. */
function openingText(hire: HireState): string {
  return hire.messages.find((m) => m.role === "agent")?.text ?? "";
}

// ────────────────────────────────────────────────────────────────── handlers

/**
 * The agent moves first.
 *
 * Derives the role, builds the ramp, and hands over the opening message plus a
 * real first task — its context, its done-when, and who to ask if it turns out
 * a person is genuinely required. Nobody had to ask it anything. That is the
 * thesis: a new hire on day one cannot formulate the question they need to ask,
 * so "ask me anything" fails them and a supervisor that opens does not.
 */
export async function handleStart(deps: SlackDeps, input: StartInput): Promise<Outbound[]> {
  const existing = await deps.sessions.get(input.slackUserId);
  const roleTitle = input.roleTitle?.trim() || existing?.roleTitle || deps.defaults.roleTitle;

  const { hire } = await deps.backend.start({
    name: input.profileName?.trim() || "New hire",
    roleTitle,
    companySlug: deps.defaults.companySlug,
    // Reuse the row if this Slack user already has one, so restarting during a
    // demo does not fill the manager dashboard with abandoned hires.
    hireId: existing?.hireId,
  });

  const task = deps.currentTask(hire);
  const opening = openingText(hire);
  const { intro } = splitOpening(opening, task?.title);

  const out: Outbound[] = [];

  if (intro.trim()) {
    out.push({ kind: "dm", text: fallback(intro), blocks: prose(intro) });
  }

  if (task) {
    out.push({
      kind: "dm",
      text: taskFallback(task, "Your first task"),
      blocks: taskBlocks(task, { heading: "Your first task" }),
    });
  } else {
    out.push({
      kind: "dm",
      text: fallback("No ramp tasks were produced — tell me what you are looking at."),
      blocks: [
        section(
          "I derived the role but the plan came back without tasks. Tell me what you're looking at and I'll work from there.",
        ),
      ],
    });
  }

  await deps.sessions.set({
    slackUserId: input.slackUserId,
    hireId: hire.id,
    roleTitle,
    startedAt: existing?.startedAt ?? nowIso(),
    lastTaskId: task?.id,
  });

  return out;
}

/**
 * One turn of the DM conversation.
 *
 * The interesting branch is the one that produces nothing: when the agent
 * answered from the company's own corpus, the manager channel stays silent.
 * That silence is the feature.
 */
export async function handleUserMessage(deps: SlackDeps, input: MessageInput): Promise<Outbound[]> {
  const text = input.text.trim();
  if (!text) return [];

  const session = await deps.sessions.get(input.slackUserId);

  if (!session) {
    if (isStartTrigger(text)) {
      return handleStart(deps, { slackUserId: input.slackUserId, profileName: input.profileName });
    }
    // No hire yet: do not burn a model call answering as though we had context
    // about a role we have not derived. Say what to type.
    return [
      {
        kind: "dm",
        text: fallback("Say `start` and I'll derive your role and hand you your first task."),
        blocks: [
          section(
            "I haven't derived your role yet — say *start* (or run `/onboard`) and I'll read your team's Slack, " +
              "docs and tickets, work out what the job actually is, and give you a first piece of real work.",
          ),
          context("`/onboard Legal Engineer` if you want to name the role yourself."),
        ],
      },
    ];
  }

  const { hire, reply, blocker } = await deps.backend.turn({ hireId: session.hireId, text });

  // The escalation test, in one place. `blocker` is already null when the API
  // deduped it against an obstacle that is still open — that is why one access
  // request produces one card in the channel instead of a fresh one every time
  // the hire mentions it.
  const escalation = blocker && blocker.needsHuman ? blocker : null;

  if (blocker) warnOnAssessmentLanguage(deps, blocker);

  const replyBlocks: Block[] = prose(reply);

  if (escalation) {
    // Told to the hire too. Being escalated behind your back on day one is a
    // small betrayal, and it is exactly the thing that makes people stop using
    // the tool honestly.
    replyBlocks.push(
      context(
        `:triangular_flag_on_post: I couldn't settle this from your team's own material, so I've flagged it in ` +
          `${channelRef(deps.managerChannel)}${escalation.suggestedPerson ? ` for ${escalation.suggestedPerson}` : ""}` +
          `${typeof escalation.minutesToUnblock === "number" ? ` — about ${escalation.minutesToUnblock} min of their time` : ""}.`,
      ),
    );
  }

  const out: Outbound[] = [{ kind: "dm", text: fallback(reply), blocks: replyBlocks }];

  // Did they just finish something? Hand them the next piece of work rather
  // than waiting to be asked for it.
  const task = deps.currentTask(hire);
  if (task && task.id !== session.lastTaskId) {
    out.push({
      kind: "dm",
      text: taskFallback(task, "Next up"),
      blocks: taskBlocks(task, { heading: "Next up" }),
    });
  } else if (!task && session.lastTaskId) {
    out.push({
      kind: "dm",
      text: fallback("That's the whole two-day ramp done."),
      blocks: [
        header("Ramp complete"),
        section(
          "That's every task in the two-day plan. Keep asking me things — I still have your team's Slack, docs and tickets.",
        ),
      ],
    });
  }

  if (escalation) {
    out.push({
      kind: "channel",
      channel: deps.managerChannel,
      text: blockerFallback(escalation, hire.name),
      blocks: blockerBlocks(escalation, {
        hireName: hire.name,
        roleTitle: hire.roleTitle,
        taskTitle: task?.title,
        person: findPerson(deps.company, escalation.suggestedPerson),
      }),
    });
  }

  await deps.sessions.set({ ...session, lastTaskId: task?.id });

  return out;
}

/**
 * `@Onboarder` in a channel.
 *
 * The conversation belongs in a DM — it is one person's ramp, and half of it is
 * them admitting what they do not know. So a mention acknowledges in-thread and
 * moves the actual work into the DM rather than holding it in public.
 *
 * Returns the thread reply *and* whether a ramp still needs deriving, rather
 * than doing the derivation itself: a cold derive is minutes long, and the
 * public acknowledgement has to land immediately or the mention looks ignored.
 * The caller posts this, then runs `handleStart` behind a progress indicator.
 */
export async function handleMention(
  deps: SlackDeps,
  input: MentionInput,
): Promise<{ outbound: Outbound[]; startNeeded: boolean }> {
  const session = await deps.sessions.get(input.slackUserId);

  return {
    startNeeded: !session,
    outbound: [
      {
        kind: "thread",
        channel: input.channel,
        threadTs: input.threadTs,
        text: fallback(
          session ? "We're already going — check your DM." : "Sent you a DM with your role and your first task.",
        ),
        blocks: [
          context(
            session
              ? "We're already going — everything's in our DM."
              : "Sent you a DM — deriving your role now; your first task lands there in a moment.",
          ),
        ],
      },
    ],
  };
}

// ──────────────────────────────────────────────────────────── the guard rail

/**
 * The third layer of the no-surveillance rule.
 *
 * The system prompt forbids assessing the person and the schema has no field
 * for it, but the summary is still model output. If one ever comes back rating
 * the hire, we want it in the bot's log while it is happening — not discovered
 * by the new hire scrolling the manager channel.
 *
 * It warns and does not rewrite. Silently editing an escalation would replace a
 * visible problem with an invisible one.
 */
function warnOnAssessmentLanguage(deps: SlackDeps, blocker: Blocker): void {
  const hit = findAssessmentLanguage(blocker.summary);
  if (hit && deps.log) {
    deps.log(
      `[slack] blocker summary contains assessment language ("${hit}") — blockers describe the obstacle, ` +
        `never the person. Summary: ${blocker.summary}`,
    );
  }
}
