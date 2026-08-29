/**
 * Sending an approved draft.
 *
 * The gate held it, an admin released it, and then nothing happened: approving
 * wrote a status and no part of the system was listening for it. The chain was
 * agent drafts, held, approved, and stopped. This is the missing link.
 *
 * It posts from the web app rather than from the bot process. The bot runs on
 * somebody's laptop and may not be running when an admin gets round to the
 * queue, and a message that waits for a background worker to exist is a
 * message that arrives whenever, which is not a promise worth making to a
 * customer who was told a human releases it.
 *
 * Server-only: it holds the workspace bot token.
 */

const POST_MESSAGE = "https://slack.com/api/chat.postMessage";
const TIMEOUT_MS = 6_000;

export function isDeliveryConfigured(): boolean {
  return Boolean(process.env.SLACK_BOT_TOKEN?.trim());
}

export type DeliveryResult =
  | { sent: true }
  | { sent: false; reason: string };

/**
 * Post one message to a Slack conversation.
 *
 * Never throws. A failure leaves the draft `approved` rather than `sent`, so
 * it is visibly undelivered and can be retried, instead of being marked done
 * on the strength of a request nobody checked.
 */
export async function deliverToSlack(
  channel: string,
  text: string,
  blocks?: unknown,
): Promise<DeliveryResult> {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) return { sent: false, reason: "no_bot_token" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(POST_MESSAGE, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(
        Array.isArray(blocks) && blocks.length
          ? { channel, text, blocks }
          : { channel, text },
      ),
      signal: controller.signal,
    });

    // Slack answers 200 with ok:false for real failures, so the status code
    // alone tells you almost nothing.
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    if (!body.ok) {
      const reason = body.error ?? `http_${res.status}`;
      console.warn(`[deliver] Slack refused: ${reason}`);
      return { sent: false, reason };
    }
    return { sent: true };
  } catch (err) {
    const reason = (err as Error).name === "AbortError" ? "timeout" : "network";
    console.warn(`[deliver] ${reason}`);
    return { sent: false, reason };
  } finally {
    clearTimeout(timer);
  }
}
