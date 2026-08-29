/**
 * POST /api/jd — check a pasted job description against the company's traces.
 *
 * Paste the posting, get back every claim it makes about the work with one of
 * three verdicts: supported, contradicted, or silent — each non-silent one
 * carrying a quote that has been verified character-for-character against the
 * artifact it is attributed to.
 *
 * GET /api/jd?companySlug=… returns the corpus coverage on its own: how many
 * artifacts, which channels, what date range. No model call, so the page can
 * show what it is able to see *before* anyone spends money finding out.
 *
 * Two Opus calls, both over the corpus, so `maxDuration` matches /api/derive.
 * The second call carries the whole corpus behind a cache breakpoint, so a
 * second posting checked against the same company reads the cache rather than
 * writing it — see the comments in lib/agent/jd-contradiction.ts.
 *
 * Everything the route can classify comes back as a status and a sentence: a
 * missing corpus is a 404, an oversized paste is a 400, an upstream wobble is
 * whatever `toApiError` decided. Nothing reaches the client as an unhandled
 * exception, because the failure mode this guards against is a demo where the
 * screen says "500" and nobody can tell whether the model refused, the key is
 * wrong, or the company slug was a typo.
 */

import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { loadCompany } from "@/lib/agent/knowledge";
import {
  MAX_JD_CHARS,
  MIN_JD_CHARS,
  checkJobDescription,
  corpusCoverage,
} from "@/lib/agent/jd-contradiction";
import { toApiError } from "@/lib/anthropic";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same ceiling as /api/derive: two model calls over the full corpus. */
export const maxDuration = 300;

const NO_STORE = { "cache-control": "no-store, max-age=0" } as const;

/**
 * Low, because every accepted request is real money. The GET is metered
 * separately and generously — it reads a seed file.
 */
const POST_LIMIT = 5;
const GET_LIMIT = 60;

const Body = z.object({
  companySlug: z.string().trim().min(1).max(100),
  jobDescription: z
    .string()
    .trim()
    .min(
      MIN_JD_CHARS,
      `A job description needs at least ${MIN_JD_CHARS} characters before there is anything to check.`,
    )
    .max(
      MAX_JD_CHARS,
      `Job descriptions are capped at ${MAX_JD_CHARS.toLocaleString()} characters, the whole thing goes to the model in one prompt, so length is literally cost.`,
    ),
});

export async function GET(request: Request) {
  const limited = rateLimit(`jd-coverage:${clientIp(request)}`, { limit: GET_LIMIT });
  if (!limited.ok) return tooMany(limited.retryAfter);

  const slug = new URL(request.url).searchParams.get("companySlug")?.trim();
  if (!slug) {
    return NextResponse.json(
      { error: "Pass ?companySlug=…" },
      { status: 400, headers: NO_STORE },
    );
  }

  const company = await loadCompany(slug);
  if (!company) return unknownCompany(slug);

  return NextResponse.json(
    {
      companySlug: company.slug,
      companyName: company.name,
      coverage: corpusCoverage(company),
    },
    { status: 200, headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  const limited = rateLimit(`jd:${clientIp(request)}`, { limit: POST_LIMIT });
  if (!limited.ok) return tooMany(limited.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400, headers: NO_STORE });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        // The first issue's message is the one written for a human above; the
        // full list is there for anyone calling this with curl.
        error: parsed.error.issues[0]?.message ?? "Invalid request.",
        issues: parsed.error.issues,
      },
      { status: 400, headers: NO_STORE },
    );
  }

  const { companySlug, jobDescription } = parsed.data;

  const company = await loadCompany(companySlug);
  if (!company) return unknownCompany(companySlug);

  if (company.artifacts.length === 0) {
    return NextResponse.json(
      {
        error: `"${company.name}" has no artifacts, so every claim would come back silent and none of it would mean anything.`,
      },
      { status: 409, headers: NO_STORE },
    );
  }

  try {
    const check = await checkJobDescription(company, jobDescription);

    // Logged, never swallowed. Both numbers are the ones that tell an operator
    // the model was reaching on this run: quotes it could not produce, and
    // claims it attributed to a document that does not contain them.
    if (check.summary.droppedCitations > 0 || check.summary.inventedClaims > 0) {
      console.warn(
        `[jd] ${companySlug}: dropped ${check.summary.droppedCitations} unverifiable citation(s) and ` +
          `${check.summary.inventedClaims} claim(s) not present in the pasted text; ` +
          `${check.summary.downgraded} verdict(s) downgraded to silent.`,
      );
    }

    return NextResponse.json({ check }, { status: 200, headers: NO_STORE });
  } catch (err) {
    const { status, message } = toApiError(err);
    console.error("[jd]", err);
    return NextResponse.json({ error: message }, { status, headers: NO_STORE });
  }
}

function unknownCompany(slug: string): Response {
  return NextResponse.json(
    { error: `No company seeded or ingested for "${slug}".` },
    { status: 404, headers: NO_STORE },
  );
}

function tooMany(retryAfter: number): Response {
  return NextResponse.json(
    { error: "Too many checks. Give it a minute, each one is two model calls over the corpus." },
    { status: 429, headers: { ...NO_STORE, "retry-after": String(retryAfter) } },
  );
}
