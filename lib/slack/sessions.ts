/**
 * Which Slack user is which hire.
 *
 * Small, but it has to survive a bot restart: the recovery from "the socket
 * dropped and someone ctrl-C'd the process" cannot be "re-derive everyone's
 * role", because a cold derivation is two minutes and the demo is eight.
 *
 * It lives in its own file, written only by the bot process — deliberately not
 * in `data/hires.json`, which the Next server owns. One writer per file is the
 * whole reason this surface does not corrupt state (see backend.ts).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export type SlackSession = {
  slackUserId: string;
  hireId: string;
  roleTitle: string;
  /** ISO 8601. */
  startedAt: string;
  /**
   * The task whose card we last posted. When the next turn's current task is a
   * different one, the hire finished something and the agent should hand them
   * the next piece of work without being asked — which is the entire behaviour
   * this product is selling.
   */
  lastTaskId?: string;
};

export interface SessionStore {
  get(slackUserId: string): Promise<SlackSession | undefined>;
  set(session: SlackSession): Promise<void>;
}

/** For the harness, and a perfectly good fallback if the sessions file is unwritable. */
export function createMemorySessionStore(seed: SlackSession[] = []): SessionStore {
  const map = new Map(seed.map((s) => [s.slackUserId, s]));
  return {
    async get(id) {
      return map.get(id);
    },
    async set(session) {
      map.set(session.slackUserId, session);
    },
  };
}

/**
 * Memory in front, JSON on disk behind.
 *
 * Reads never touch the disk after startup, and a failed write degrades to
 * memory-only with a warning rather than killing a live conversation — the same
 * bargain `lib/agent/hires.ts` makes, for the same reason.
 */
export function createFileSessionStore(
  filePath: string,
  log: (message: string) => void = console.warn,
): SessionStore {
  const map = new Map<string, SlackSession>();
  let loaded = false;
  let writable = true;
  let queue: Promise<unknown> = Promise.resolve();

  async function load(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
      const raw = await fs.readFile(filePath, "utf8");
      for (const s of JSON.parse(raw) as SlackSession[]) map.set(s.slackUserId, s);
    } catch {
      // No file yet is the normal first run, not an error.
    }
  }

  async function flush(): Promise<void> {
    if (!writable) return;
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify([...map.values()], null, 2), "utf8");
    } catch (err) {
      writable = false;
      log(`[slack] cannot write ${filePath} (${(err as Error).message}); sessions are memory-only now.`);
    }
  }

  return {
    async get(id) {
      await load();
      return map.get(id);
    },
    async set(session) {
      await load();
      map.set(session.slackUserId, session);
      // Serialised so two DMs landing together cannot interleave writes and
      // truncate the file.
      const next = queue.then(flush, flush);
      queue = next.then(
        () => undefined,
        () => undefined,
      );
      await next;
    },
  };
}
