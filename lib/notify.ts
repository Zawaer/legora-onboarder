/**
 * One outbound notification channel, shared by everything worth being told
 * about the moment it happens.
 *
 * `data/*.json` is per-instance and read-only on serverless, so anything a
 * visitor submits in production exists only in a log line until something
 * durable takes it. A webhook into the team's own Slack is that something: it
 * is instant, it is where they are already looking, and it costs nothing to
 * stand up.
 *
 * Accepts `NOTIFY_WEBHOOK_URL` first and falls back to `WAITLIST_WEBHOOK_URL`,
 * which is already configured — so LOIs start arriving with no new environment
 * variable, and the more honestly-named one can replace it later without a
 * flag day.
 */

const TIMEOUT_MS = 5_000;

export function notifyUrl(): string | undefined {
  return (
    process.env.NOTIFY_WEBHOOK_URL?.trim() ||
    process.env.WAITLIST_WEBHOOK_URL?.trim() ||
    undefined
  );
}

export function isNotifyConfigured(): boolean {
  return Boolean(notifyUrl());
}

/**
 * Returns false rather than throwing. Every caller is on a request path where
 * the visitor's own outcome matters more than our bookkeeping — a signed LOI
 * still renders its artefact whether or not we managed to tell ourselves about
 * it.
 */
export async function notify(
  text: string,
  payload: Record<string, unknown> = {},
): Promise<boolean> {
  const url = notifyUrl();
  if (!url) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // `text` is what Slack renders; the fields ride along so a non-Slack
      // endpoint (a Zap into a sheet, say) gets structured data rather than
      // having to parse prose back apart.
      body: JSON.stringify({ text, ...payload }),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
