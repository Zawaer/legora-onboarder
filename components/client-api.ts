/**
 * Thin, defensive client for the agent API.
 *
 * The API routes are written by another agent in parallel, so every reader here
 * accepts the handful of shapes a sane implementation might return rather than
 * hard-coding one. A demo must never blank out because a payload was wrapped in
 * `{ hire: … }` instead of returned bare.
 */

import type { Artifact, Blocker, ChatMessage, HireState } from "@/lib/types";

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return typeof v === "object" && v !== null;
}

/** Pull the first present key off an object. */
function pick(o: unknown, keys: string[]): unknown {
  if (!isObj(o)) return undefined;
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 400) };
  }
}

function errorFrom(body: unknown, res: Response): string {
  const msg = pick(body, ["error", "message", "detail"]);
  if (typeof msg === "string" && msg.trim()) return msg;
  return `${res.status} ${res.statusText || "request failed"}`;
}

/** Unwrap a hire-shaped object from any of the usual envelopes. */
export function asHire(body: unknown): HireState | null {
  const candidates = [
    body,
    pick(body, ["hire", "state", "hireState", "data", "result"]),
  ];
  for (const c of candidates) {
    if (isObj(c) && typeof c.id === "string") return c as unknown as HireState;
  }
  return null;
}

export function asHires(body: unknown): HireState[] {
  const raw = Array.isArray(body)
    ? body
    : pick(body, ["hires", "items", "data", "results", "state"]);
  if (!Array.isArray(raw)) {
    const one = asHire(body);
    return one ? [one] : [];
  }
  return raw.filter((h): h is HireState => isObj(h) && typeof h.id === "string");
}

export function asMessages(body: unknown): ChatMessage[] {
  const raw = pick(body, ["messages", "chat", "history"]);
  if (Array.isArray(raw)) {
    return raw.filter(
      (m): m is ChatMessage => isObj(m) && typeof m.text === "string",
    );
  }
  const hire = asHire(body);
  if (hire && Array.isArray(hire.messages)) return hire.messages;
  return [];
}

/** A single reply, however it was wrapped or named. */
export function asReply(body: unknown): ChatMessage | null {
  const direct = pick(body, ["message", "reply", "response", "answer"]);
  if (isObj(direct) && typeof direct.text === "string") {
    return direct as unknown as ChatMessage;
  }
  const str = typeof direct === "string" ? direct : pick(body, ["text"]);
  if (typeof str === "string" && str.trim()) {
    return {
      id: `agent-${Date.now()}`,
      role: "agent",
      text: str,
      at: new Date().toISOString(),
    };
  }
  return null;
}

/** The source corpus, if the route was kind enough to send it along. */
export function asArtifacts(body: unknown): Artifact[] {
  const roots = [pick(body, ["company"]), body, pick(body, ["hire", "data"])];
  for (const root of roots) {
    const raw = pick(root, ["artifacts", "corpus", "sources"]);
    if (Array.isArray(raw)) {
      return raw.filter(
        (a): a is Artifact => isObj(a) && typeof a.id === "string",
      );
    }
  }
  return [];
}

export function asCompanyName(body: unknown): string | undefined {
  const c = pick(body, ["company"]);
  const name = pick(c, ["name"]) ?? pick(body, ["companyName"]);
  return typeof name === "string" ? name : undefined;
}

export function asBlockers(body: unknown): Blocker[] {
  const raw = pick(body, ["blockers"]);
  if (Array.isArray(raw)) {
    return raw.filter(
      (b): b is Blocker => isObj(b) && typeof b.summary === "string",
    );
  }
  return [];
}

// ───────────────────────────────────────────────────────────────── calls

export async function startDerivation(input: {
  companySlug: string;
  roleTitle: string;
  /**
   * Who is actually starting. Optional because the product shouldn't require it,
   * but the demo always passes one — "New hire" with "NH" initials reads as an
   * unfinished stub on a projector, and this screen is shown to customers.
   */
  name?: string;
}): Promise<{ id: string }> {
  const res = await fetch("/api/derive", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorFrom(body, res));

  const hire = asHire(body);
  const id =
    hire?.id ??
    (typeof pick(body, ["hireId", "id"]) === "string"
      ? (pick(body, ["hireId", "id"]) as string)
      : undefined);

  if (!id) throw new Error("The derivation finished but returned no hire id.");
  return { id };
}

export type HirePayload = {
  hire: HireState;
  artifacts: Artifact[];
  companyName?: string;
};

/** Tries `?id=` first, then the nested route. */
export async function fetchHire(id: string): Promise<HirePayload | null> {
  const urls = [
    `/api/hire?id=${encodeURIComponent(id)}`,
    `/api/hire/${encodeURIComponent(id)}`,
  ];
  let lastError: string | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const body = await readJson(res);
      if (!res.ok) {
        lastError = errorFrom(body, res);
        continue;
      }
      const hire = asHire(body);
      if (hire) {
        return {
          hire,
          artifacts: asArtifacts(body),
          companyName: asCompanyName(body),
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  if (lastError) throw new Error(lastError);
  return null;
}

export async function fetchHires(): Promise<HireState[]> {
  const res = await fetch("/api/hire", { cache: "no-store" });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorFrom(body, res));
  return asHires(body);
}

export async function sendChat(hireId: string, text: string) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hireId, text }),
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorFrom(body, res));
  return {
    messages: asMessages(body),
    reply: asReply(body),
    blockers: asBlockers(body),
    hire: asHire(body),
  };
}
