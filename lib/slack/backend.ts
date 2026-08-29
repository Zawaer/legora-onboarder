/**
 * How the Slack bot reaches the agent.
 *
 * WHY THIS IS HTTP AND NOT A DIRECT IMPORT — the one architectural decision in
 * this surface worth arguing about:
 *
 * The bot could `import { respond }` and call the agent in its own process.
 * It deliberately does not. Hire state lives in `data/hires.json`, and
 * `lib/agent/hires.ts` serialises writes through a promise chain that is
 * *in-process only*. During the demo the Next server is also running and also
 * writing that file — the manager dashboard is the other half of the pitch. Two
 * processes doing read-modify-write on one JSON file is a lost update, and the
 * way it shows up is the hire's last three messages vanishing from the manager's
 * screen mid-demo. There is no lock that fixes that without inventing one.
 *
 * So there is exactly one writer: the Next server. The bot posts turns to
 * `POST /api/chat` — the same route the web panel calls, which means the Slack
 * surface inherits the blocker dedupe, the status update and the persistence
 * ordering verbatim rather than growing a second copy that drifts from it. The
 * dedupe in particular is load-bearing here: the route returns `blocker: null`
 * when the obstacle was already open, and that null is what stops this bot
 * re-posting one escalation to the manager channel on every subsequent turn.
 *
 * The cost is that `npm run dev` has to be running. That is a one-line
 * precondition in docs/slack.md and a clear error below — a much cheaper
 * failure than silent state corruption in front of judges.
 */

import type { Blocker, HireState } from "@/lib/types";

/** What the Slack handlers are allowed to ask for. Implemented over HTTP below, faked in the harness. */
export interface VanavBackend {
  /** Derive the role, build the ramp, and seed the opening message. Slow on a cold cache. */
  start(input: {
    name: string;
    roleTitle: string;
    companySlug: string;
    /** Reuse an existing hire row instead of littering the dashboard with duplicates. */
    hireId?: string;
  }): Promise<{ hire: HireState; cached: boolean }>;

  /** One supervision turn. `blocker` is null when nothing was raised *or* it was deduped. */
  turn(input: { hireId: string; text: string }): Promise<{
    hire: HireState;
    reply: string;
    blocker: Blocker | null;
  }>;
}

export class VanavApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "VanavApiError";
    this.status = status;
  }
}

export type HttpBackendOptions = {
  baseUrl: string;
  /**
   * A cold derivation is two Opus calls over the whole corpus — minutes, not
   * seconds. A warm one is a disk read. The default has to cover the cold path
   * or the first `/onboard` of the day times out.
   */
  deriveTimeoutMs?: number;
  /** A supervision turn is 20–40s in practice; the margin is for a slow venue link. */
  turnTimeoutMs?: number;
  /** Injectable so the harness can drive this without a network. */
  fetchImpl?: typeof fetch;
};

const DEFAULT_DERIVE_TIMEOUT_MS = 300_000;
const DEFAULT_TURN_TIMEOUT_MS = 120_000;

export function createHttpBackend(opts: HttpBackendOptions): VanavBackend {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const doFetch = opts.fetchImpl ?? fetch;

  async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // The single most likely failure in this whole surface is "they forgot to
      // start the web app", so it gets the error message that says what to do
      // rather than `fetch failed`.
      const cause = err instanceof Error ? err.message : String(err);
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new VanavApiError(
          `The Vanav API did not answer within ${Math.round(timeoutMs / 1000)}s (${base}${path}). ` +
            `A cold role derivation genuinely takes a couple of minutes; if this was a chat turn, check the ` +
            `\`npm run dev\` terminal for an Anthropic error.`,
          504,
        );
      }
      throw new VanavApiError(
        `Cannot reach the Vanav API at ${base} (${cause}). Start it with \`npm run dev\` in another ` +
          `terminal, or set VANAV_API_URL if it is on a different port.`,
        503,
      );
    }

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new VanavApiError(
        `The Vanav API returned non-JSON from ${path} (HTTP ${response.status}). ` +
          `That usually means the request hit the Next dev overlay rather than the route.`,
        response.status,
      );
    }

    if (!response.ok) {
      const message =
        typeof parsed === "object" && parsed !== null && typeof (parsed as { error?: unknown }).error === "string"
          ? (parsed as { error: string }).error
          : `HTTP ${response.status} from ${path}`;
      throw new VanavApiError(message, response.status);
    }

    return parsed as T;
  }

  return {
    async start({ name, roleTitle, companySlug, hireId }) {
      const data = await post<{ hire: HireState; cached: boolean }>(
        "/api/derive",
        { name, roleTitle, companySlug, ...(hireId ? { hireId } : {}) },
        opts.deriveTimeoutMs ?? DEFAULT_DERIVE_TIMEOUT_MS,
      );
      return { hire: data.hire, cached: Boolean(data.cached) };
    },

    async turn({ hireId, text }) {
      const data = await post<{ hire: HireState; reply: string; blocker: Blocker | null }>(
        "/api/chat",
        { hireId, text },
        opts.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS,
      );
      return { hire: data.hire, reply: data.reply, blocker: data.blocker ?? null };
    },
  };
}
