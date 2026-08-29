/**
 * Linkup — the web rung's search provider, called directly over REST.
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────
 *
 * `lib/web/contract.ts` has the reasoning: a large share of what a new hire asks
 * is not institutional knowledge at all, and every one of those questions that
 * reaches a colleague spends a scarce resource on something the open web already
 * answers. This file is the half of that rung which fetches the answer. The
 * other half — deciding whether the question was ever ours to answer — is
 * `lib/agent/classify.ts`, and it runs first.
 *
 * ── WHY NO SDK ───────────────────────────────────────────────────────────────
 *
 * One POST returning one JSON object. A dependency for that buys nothing and
 * costs a lockfile entry and a supply-chain surface, on a project that is four
 * dependencies deep. `fetch` is global on the Node runtime. Same call as
 * `lib/voice/elevenlabs.ts`, same reasoning.
 *
 * ── WHY `search` AND NEVER `research` ────────────────────────────────────────
 *
 * Linkup exposes two endpoints. `research` reads across sources over multiple
 * steps and runs for minutes; `search` at `depth: "standard"` is single-shot and
 * measured here at a 2.9s median / 3.7s p90 (see `WEB_TIMEOUT_MS`). This sits
 * inside a live chat turn where a hire is watching a cursor blink, so only the
 * second one is admissible. Do not "upgrade" the depth or the endpoint to
 * improve answer quality — the improvement is not worth a chat turn that appears
 * to have hung, and `WEB_TIMEOUT_MS` would kill it anyway.
 *
 * ── WHY EVERY FAILURE THROWS ─────────────────────────────────────────────────
 *
 * The caller's fallback is the existing escalation ladder: a human. That is a
 * perfectly good outcome — it is what happens today for every question. So there
 * is nothing to gain by returning a degraded, partial or empty answer, and a lot
 * to lose: an empty "here's the general answer:" block is worse than silence,
 * because it spends the hire's trust and still does not answer them. Failures
 * are distinguishable by `code` so the caller can log why the rung did not fire
 * without having to string-match a message.
 *
 * ── ON THE KEY ───────────────────────────────────────────────────────────────
 *
 * The key is never logged, never returned, never put in a thrown message, and
 * never echoed to the client. Upstream error text goes through `redact()` first,
 * because an API that quotes your bad credential back at you is a real thing
 * that happens and these messages end up in a server log.
 *
 * `LINKUP_API_KEY` may legitimately be absent — it is the newest credential in
 * the project. `missing_key` is therefore its own code and is thrown before any
 * network call, so "we never configured this" never looks like "the web is
 * down".
 */

import { WEB_TIMEOUT_MS, type SearchWeb, type WebAnswer, type WebSource } from "@/lib/web/contract";

const SEARCH_URL = "https://api.linkup.so/v1/search";

/**
 * The contract's shape, and a deliberate limit rather than an incidental one.
 * Three links is what a person actually clicks; a wall of ten reads as a search
 * results page, which is exactly the thing the hire came here to avoid.
 */
const MAX_SOURCES = 3;

export type WebFailureCode =
  | "missing_key"
  | "unauthorized"
  | "rate_limited"
  | "bad_request"
  | "upstream_error"
  | "network_error"
  | "timeout"
  | "aborted"
  | "unusable_answer";

/**
 * A failure the caller can branch on. `status` is the HTTP status the caller
 * *would* use if it chose to surface this; the chat path mostly chooses not to,
 * and escalates to a human instead.
 */
export class WebSearchError extends Error {
  readonly code: WebFailureCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: WebFailureCode,
    message: string,
    { status = 502, retryAfterSeconds }: { status?: number; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "WebSearchError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Whether the rung can even be attempted. Lets a caller skip straight to
 * escalation — and a dashboard stay honest about why the web rung never fires —
 * without burning a request to find out.
 */
export function isWebSearchConfigured(): boolean {
  return Boolean(process.env.LINKUP_API_KEY?.trim());
}

export function webSearchStatus(): { configured: boolean; provider: "linkup"; timeoutMs: number } {
  return { configured: isWebSearchConfigured(), provider: "linkup", timeoutMs: WEB_TIMEOUT_MS };
}

/** Scrub anything key-shaped out of text on its way to a log. Belt and braces. */
function redact(text: string): string {
  const key = process.env.LINKUP_API_KEY?.trim();
  let out = text;
  if (key && key.length >= 8) out = out.split(key).join("[redacted]");
  // Linkup keys are opaque; catch the general shape of a bearer credential too.
  return out.replace(/\b[A-Za-z0-9]{24,}\b/g, "[redacted]");
}

/** Keep upstream prose short enough to sit on one line of a server log. */
function tidy(text: string): string {
  const clean = redact(text).replace(/\s+/g, " ").trim();
  return clean.length > 200 ? `${clean.slice(0, 197)}...` : clean;
}

type ErrorBody = { error?: { message?: string } | string; message?: string; detail?: string };

function messageOf(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const b = body as ErrorBody;
  if (typeof b.error === "string") return b.error;
  return b.error?.message ?? b.message ?? b.detail ?? "";
}

/**
 * Map a Linkup failure onto something the caller can reason about.
 *
 * The distinction that matters operationally is "this key is wrong or absent"
 * (nothing will fix itself, stop trying) versus "try again in a moment" (429,
 * 5xx). Collapsing them into one branch is how you spend twenty minutes
 * rotating a credential that was never the problem.
 */
function classify(status: number, body: unknown, rawText: string, retryAfter: string | null): WebSearchError {
  const upstream = tidy(messageOf(body) || rawText || `HTTP ${status}`);
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) || undefined : undefined;

  if (status === 401 || status === 403) {
    return new WebSearchError("unauthorized", `Linkup rejected the API key. ${upstream}`, {
      status: 401,
    });
  }
  if (status === 429) {
    return new WebSearchError("rate_limited", `Linkup is rate limiting this key. ${upstream}`, {
      status: 429,
      retryAfterSeconds,
    });
  }
  if (status === 400 || status === 422) {
    return new WebSearchError("bad_request", `Linkup rejected the request. ${upstream}`, {
      status: 502,
    });
  }
  return new WebSearchError("upstream_error", `Linkup returned ${status}. ${upstream}`, {
    status: 502,
  });
}

/**
 * Linkup returns `{name, url, snippet}`; the contract wants `{title, url}`.
 *
 * Nothing here trusts the shape it is handed. A source with no usable URL is
 * dropped rather than rendered as a dead link, and a non-http scheme is dropped
 * rather than put in front of a user — this text ends up in an anchor tag.
 */
function normaliseSources(raw: unknown): WebSource[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const sources: WebSource[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const { name, url } = entry as { name?: unknown; url?: unknown };
    if (typeof url !== "string") continue;

    const href = url.trim();
    let parsed: URL;
    try {
      parsed = new URL(href);
    } catch {
      continue;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
    if (seen.has(parsed.href)) continue;
    seen.add(parsed.href);

    // A missing title is not a reason to drop a good link — the host is a
    // perfectly readable label, and it is never fabricated.
    const title = typeof name === "string" && name.trim() ? name.trim() : parsed.hostname;

    sources.push({ title, url: href });
    if (sources.length >= MAX_SOURCES) break;
  }

  return sources;
}

/**
 * One web search. Throws on every failure; the caller falls through to human
 * escalation, which is the contract.
 *
 * `signal` is for the caller that already has a request-scoped abort (a closed
 * chat connection). It composes with — it does not replace — the hard
 * `WEB_TIMEOUT_MS` ceiling below.
 */
export const searchWeb: SearchWeb = async (
  query: string,
  options: { signal?: AbortSignal } = {},
): Promise<WebAnswer> => {
  const key = process.env.LINKUP_API_KEY?.trim();
  if (!key) {
    throw new WebSearchError(
      "missing_key",
      "LINKUP_API_KEY is not set, so the web rung is unavailable and this question escalates to a human.",
      { status: 503 },
    );
  }

  const q = query.trim();
  if (!q) {
    throw new WebSearchError("bad_request", "There is nothing to search for.", { status: 400 });
  }

  // A signal that was already aborted before we were called fires no event, so
  // subscribing to it below would silently miss it and we would issue a request
  // for a chat turn that is already gone. Check the flag first.
  if (options.signal?.aborted) {
    throw new WebSearchError("aborted", "The caller aborted before the search started.", {
      status: 499,
    });
  }

  // An explicit controller rather than AbortSignal.timeout, so that after the
  // abort we still know whose abort it was: ours (timeout — the hire is waiting,
  // so escalate) or the caller's (they are gone — say nothing).
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, WEB_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onCallerAbort, { once: true });

  let res: Response;
  try {
    res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      // `standard` + `sourcedAnswer`: one shot, and an answer that arrives with
      // its citations already attached. `deep` and the research endpoint are
      // both minutes-scale and have no place on a chat turn.
      body: JSON.stringify({ q, depth: "standard", outputType: "sourcedAnswer" }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (timedOut) {
      throw new WebSearchError(
        "timeout",
        `Linkup did not respond within ${WEB_TIMEOUT_MS}ms.`,
        { status: 504 },
      );
    }
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      throw new WebSearchError("aborted", "The web search was aborted by the caller.", {
        status: 499,
      });
    }
    // The message is ours, not the network stack's: a DNS or TLS error string
    // can contain the whole request, and this one carries a bearer token.
    throw new WebSearchError("network_error", "Could not reach Linkup.", { status: 502 });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onCallerAbort);
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    throw classify(res.status, parsed, raw, res.headers.get("retry-after"));
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new WebSearchError("upstream_error", "Linkup returned a body that was not JSON.", {
      status: 502,
    });
  }

  const { answer, sources } = (body ?? {}) as { answer?: unknown; sources?: unknown };

  // A 200 carrying an empty answer is not an answer. Failing here — where the
  // caller can still escalate to someone who knows — is strictly better than
  // rendering the preamble above an empty block.
  const text = typeof answer === "string" ? answer.trim() : "";
  if (!text) {
    throw new WebSearchError("unusable_answer", "Linkup returned an empty answer.", {
      status: 502,
    });
  }

  return { answer: text, sources: normaliseSources(sources) };
};
