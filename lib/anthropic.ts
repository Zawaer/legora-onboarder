/**
 * The one place this app talks to Claude.
 *
 * Everything the agent does is a structured generation: a system prompt that
 * states the rules, a user message carrying the volatile company corpus, and a
 * Zod schema the response has to satisfy. Centralising that here means the
 * schema guard and the error translation are written once and cannot be
 * skipped by a route in a hurry the night before a demo.
 *
 * Server-only. Never import this from a client component — it reads a secret.
 */

import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

/**
 * WHERE INFERENCE RUNS, AND WHY IT MATTERS
 *
 * Set `AWS_BEDROCK_REGION` to an EU region and every model call goes to Amazon
 * Bedrock in that region instead of the Anthropic API. Leave it unset and
 * nothing changes.
 *
 * This is not a cost optimisation. Calling the Anthropic API means a transfer
 * to a US company, which under GDPR needs standard contractual clauses we have
 * not executed. Three of our four LOIs are blocked on data handling, and two
 * of the replies sent on 2 September say in writing that inference is moving
 * into the EU (docs/contacts.md). Bedrock in an EU region removes the transfer
 * entirely — the data stays in the EEA and there is nothing to justify.
 *
 * Full reasoning: docs/security.md §2.1. Pricing: docs/model-costs.md §2 —
 * EU regional endpoints carry a 10% premium over global, which is the cheapest
 * thing we will ever buy.
 *
 * Verify before claiming it: check the model actually answers from the chosen
 * region, and that `getLastUsage().cacheReadTokens` is still non-zero. A
 * silently broken cache costs 10x and the only symptom is a slower demo.
 */
export function bedrockRegion(): string | null {
  return process.env.AWS_BEDROCK_REGION?.trim() || null;
}

export function isBedrockConfigured(): boolean {
  return bedrockRegion() !== null;
}

/**
 * Exact model id. No date suffix — a suffixed id is a different (and usually
 * retired) model, and the failure is a 404 at demo time.
 */
export const MODEL = "claude-opus-5" as const;

/**
 * The small, fast model. Same rule about date suffixes.
 *
 * For the one-shot classifications that sit on the latency path of a live chat
 * turn (see `lib/agent/classify.ts`) — a decision between two labels does not
 * need a frontier model, and paying opus latency for it would be felt by the
 * person waiting. Everything that reasons over the corpus stays on `MODEL`.
 */
export const FAST_MODEL = "claude-haiku-4-5" as const;

/** Thrown before any network call when the developer has not set credentials. */
export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "No model credentials. Either set ANTHROPIC_API_KEY, or set " +
        "AWS_BEDROCK_REGION plus AWS credentials to run inference in the EU. " +
        "Copy .env.example to .env.local. This app derives roles from a live " +
        "model — there is no offline fallback, because faking the output would " +
        "defeat the entire point of the product.",
    );
    this.name = "MissingApiKeyError";
  }
}

/** Thrown when the model answered but the answer did not satisfy the schema. */
export class UnparseableModelOutputError extends Error {
  constructor(label: string) {
    super(
      `The model returned no parseable output for "${label}". Retry; if it keeps ` +
        `happening the schema is probably over-constrained.`,
    );
    this.name = "UnparseableModelOutputError";
  }
}

type ModelClient = Anthropic | AnthropicBedrockMantle;

let cached: ModelClient | null = null;
let lastUsage: GenerationUsage | null = null;

/**
 * Usage from the most recent generation. Read `cacheReadTokens`: if it stays at
 * zero across back-to-back calls something is quietly invalidating the corpus
 * prefix, and the only symptom otherwise is a slower, more expensive demo.
 */
export function getLastUsage(): GenerationUsage | null {
  return lastUsage;
}

export function getClient(): ModelClient {
  const region = bedrockRegion();
  if (region) {
    // Credentials resolve through the standard AWS chain — AWS_BEARER_TOKEN_BEDROCK,
    // then AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, then the default provider
    // chain — so we do not check for a specific variable here and get a clear
    // AuthenticationError from the API instead of guessing wrong locally.
    cached ??= new AnthropicBedrockMantle({ awsRegion: region });
    return cached;
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new MissingApiKeyError();
  // The SDK is stateless per-request; one client per process keeps the
  // connection pool warm across the two or three calls a derivation makes.
  cached ??= new Anthropic();
  return cached;
}

/**
 * Bedrock model ids carry an `anthropic.` prefix; the first-party API rejects
 * it. Applied at the call site so MODEL and FAST_MODEL stay the canonical ids
 * everywhere else and nothing downstream has to know where inference runs.
 */
function resolveModel(model: string): string {
  if (!isBedrockConfigured()) return model;
  return model.startsWith("anthropic.") ? model : `anthropic.${model}`;
}

export type GenerateOptions<S extends z.ZodType> = {
  /** Stable instructions. Goes in `system` so the prefix stays cacheable. */
  system: string;
  /**
   * The company corpus. Identical on every call for a given company, so it is
   * sent as its own leading user turn behind a cache breakpoint. See `generate`.
   */
  corpus?: string;
  /** The volatile ask. Goes last, after every cache breakpoint. */
  user: string;
  schema: S;
  /** Used only in error messages, so a failure names the step that failed. */
  label: string;
  maxTokens?: number;
  /** Prior conversation, oldest first. Used by the supervision loop. */
  history?: Anthropic.MessageParam[];
  /**
   * Defaults to `MODEL`. Only set this for a step that has a reason to be
   * cheaper or faster than the rest of the agent — `FAST_MODEL` for a
   * latency-path classification. Everything that reasons over the corpus and
   * produces something a human reads stays on the default.
   */
  model?: string;
};

/** What the last `generate` call actually cost, for latency/caching diagnostics. */
export type GenerationUsage = {
  inputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
};

/**
 * One structured generation.
 *
 * Streams rather than using a plain create: role derivation over a full Slack
 * corpus is a long generation, and a non-streaming request with a large
 * `max_tokens` is the classic way to eat an HTTP timeout and lose the whole
 * response after paying for it.
 */
export async function generate<S extends z.ZodType>({
  system,
  corpus,
  user,
  schema,
  label,
  maxTokens = 32000,
  history = [],
  model = MODEL,
}: GenerateOptions<S>): Promise<z.infer<S>> {
  const client = getClient();

  // Prefix order is tools -> system -> messages, and caching is a prefix match,
  // so the corpus goes in its OWN leading user turn rather than being glued to
  // the ask. The corpus is ~15k tokens and byte-identical across every call for
  // a company; the role title, the plan request and the hire's latest message
  // are a few hundred tokens that change constantly. Concatenating them would
  // put a volatile tail inside the cached block and the cache would never hit.
  //
  // It also has to sit BEFORE the conversation history, not after it: history
  // grows by two messages a turn, and anything downstream of a growing block is
  // permanently uncacheable.
  const messages: Anthropic.MessageParam[] = [];
  if (corpus) {
    messages.push({
      role: "user",
      content: [{ type: "text", text: corpus, cache_control: { type: "ephemeral" } }],
    });
  }
  messages.push(...history, { role: "user", content: user });

  const stream = client.messages.stream({
    model: resolveModel(model),
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
    output_config: { format: zodOutputFormat(schema) },
  });

  const message = await stream.finalMessage();

  lastUsage = {
    inputTokens: message.usage.input_tokens,
    cacheCreationTokens: message.usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    outputTokens: message.usage.output_tokens,
  };

  // A refusal is an HTTP 200 with no usable content. Reading `.parsed_output`
  // without checking would surface as a confusing null further downstream.
  if (message.stop_reason === "refusal") {
    throw new UnparseableModelOutputError(`${label} (model declined the request)`);
  }

  const parsed = message.parsed_output;
  if (parsed == null) throw new UnparseableModelOutputError(label);
  return parsed as z.infer<S>;
}

/**
 * Translate anything thrown above into an HTTP status and a message that is
 * safe to put on the wire.
 *
 * Most specific exception first — collapsing everything into one branch loses
 * the distinction between "retry in a second" (429, 5xx) and "your request is
 * wrong" (400), which is exactly the distinction the caller needs.
 */
export function toApiError(err: unknown): { status: number; message: string } {
  if (err instanceof MissingApiKeyError) {
    return { status: 500, message: err.message };
  }
  if (err instanceof UnparseableModelOutputError) {
    return { status: 502, message: err.message };
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return {
      status: 500,
      message: isBedrockConfigured()
        ? `AWS credentials were rejected by Bedrock in ${bedrockRegion()}. Check the ` +
          "credentials, and that this account has model access enabled for Anthropic " +
          "models in that region — access is a per-region opt-in in the Bedrock console."
        : "ANTHROPIC_API_KEY was rejected by the API. Check the key in .env.local.",
    };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 429, message: "Rate limited by the Anthropic API. Try again shortly." };
  }
  if (err instanceof Anthropic.BadRequestError) {
    return { status: 502, message: `Anthropic rejected the request: ${scrub(err.message)}` };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: 504, message: "Could not reach the Anthropic API." };
  }
  if (err instanceof Anthropic.APIError) {
    return { status: 502, message: `Anthropic API error ${err.status}: ${scrub(err.message)}` };
  }
  return { status: 500, message: scrub(err instanceof Error ? err.message : "Unexpected error.") };
}

/**
 * Belt and braces: no upstream error message we return should ever contain a
 * credential, and the cost of being wrong once is a leaked key in someone's
 * browser devtools.
 */
function scrub(message: string): string {
  return message.replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-***");
}
