/**
 * POST /api/ingest — the step that turns the demo into a pilot.
 *
 * Everything else in this product runs on a corpus we wrote. This route takes a
 * corpus we have never seen — a Slack export, a CSV, four hundred lines pasted
 * out of a Slack window — parses it into the same `Company` shape the seed
 * uses, and stores it under a fresh slug that `/api/derive` can then resolve.
 *
 * It deliberately does NOT derive. A derivation is two Opus calls over the
 * whole corpus: two to three minutes and a dollar or two. Firing that off the
 * back of an upload means the first thing a customer learns about a
 * misparsed file is a three-minute wait and a bad answer. So this route is
 * cheap, fast and honest — it hands back exactly what it understood
 * (artifacts, people, channels, date range, and every warning) so a human can
 * look at it and decide whether to spend the money. Confirmation is the
 * product decision here, not a UI detail.
 *
 * Accepts either JSON (`{ name, roleTitle, raw }`) or a multipart upload
 * (`file` + fields), because "paste it" and "drag the export in" are two
 * genuinely different moments and both happen.
 */

import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { MAX_INPUT_CHARS, parseCorpus, slugify } from "@/lib/ingest/parse";
import { listIngestedCompanies, saveCompany } from "@/lib/ingest/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A whole Slack workspace export is far bigger than this, and that is fine:
 * the parser caps the corpus at ~200k characters anyway, so accepting 8MB of
 * it would just be a slower way to reach the same cap. Rejecting at the door
 * with a 413 and a clear message beats streaming a 60MB body into memory and
 * dying somewhere less legible.
 */
const MAX_BYTES = 6 * 1024 * 1024;

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  roleTitle: z.string().trim().min(2).max(120),
  raw: z.string().min(1).max(MAX_INPUT_CHARS),
  /** One paragraph of public context. Optional, but it sharpens the derivation. */
  description: z.string().trim().max(2000).optional(),
});

/** What has been ingested on this instance. Lets the UI offer a corpus again. */
export async function GET() {
  const companies = await listIngestedCompanies();
  return NextResponse.json(
    {
      companies: companies.map((c) => ({
        slug: c.company.slug,
        name: c.company.name,
        roleTitle: c.roleTitle,
        ingestedAt: c.ingestedAt,
        format: c.format,
        artifactCount: c.company.artifacts.length,
        peopleCount: c.company.people.length,
      })),
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const limited = rateLimit(`ingest:${clientIp(request)}`, { limit: 8, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Give it a minute." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  // Cheapest check first: the client told us how big this is before we read it.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `That file is ${mb(declared)}MB. The limit is ${mb(MAX_BYTES)}MB, export a few of the busiest channels rather than the whole workspace; the corpus is capped well below this anyway.`,
      },
      { status: 413 },
    );
  }

  let input: z.infer<typeof Body>;
  try {
    input = await readInput(request);
  } catch (err) {
    const failure = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: failure.message ?? "Could not read that upload." },
      { status: failure.status ?? 400 },
    );
  }

  const parsed = Body.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the fields: a company name, a role title and some data are all required.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { name, roleTitle, raw, description } = parsed.data;

  // parseCorpus never throws — a partial parse with warnings beats a 500 while
  // a customer is watching. The try/catch is here only so a future bug in it
  // still produces a readable message rather than a framework error page.
  let result;
  try {
    result = parseCorpus(raw, { name, slug: slugify(name), description });
  } catch (err) {
    console.error("[ingest] parse failed", err);
    return NextResponse.json(
      { error: "Could not read that data. Try pasting a few hundred lines of a channel instead." },
      { status: 422 },
    );
  }

  // Nothing usable. Deliberately not saved and deliberately not a 200: an empty
  // corpus would derive a confident role out of thin air, which is the one
  // thing this product exists not to do.
  if (result.company.artifacts.length === 0) {
    return NextResponse.json(
      {
        error: "No messages were found in that data.",
        warnings: result.warnings,
        format: result.format,
      },
      { status: 422 },
    );
  }

  // Same refusal, one step further in: a corpus with messages but no identifiable
  // authors. The parser drops artifacts whose author is unknown, so a plain
  // document paste lands here with artifacts but an empty roster.
  //
  // Refusing at the door matters more than it looks. Everything downstream
  // assumes a roster: `resolveOwner` picks who to name in "ask if stuck", and it
  // throws rather than inventing a colleague. That throw would otherwise land
  // three minutes and a dollar or two into a derivation, as an internal error
  // string in front of whoever we were showing it to. The failure is the same
  // either way; only the cost and the dignity differ.
  if (result.company.people.length === 0) {
    return NextResponse.json(
      {
        error:
          "No author names were found, so there is nobody for the agent to point a stuck hire at. Export with usernames included, or paste a channel where messages have names against them.",
        warnings: result.warnings,
        format: result.format,
      },
      { status: 422 },
    );
  }

  const stored = await saveCompany(result.company, {
    format: result.format,
    warnings: result.warnings,
    roleTitle,
  });

  const company = stored.company;

  return NextResponse.json(
    {
      slug: company.slug,
      name: company.name,
      roleTitle,
      artifactCount: company.artifacts.length,
      peopleCount: company.people.length,
      warnings: result.warnings,
      format: result.format,
      /** Absent when nothing was dated; inferred dates are flagged, never hidden. */
      dateRange: result.dateRange,
      datesInferred: result.datesInferred,
      seen: result.seen,
      channels: result.channels.slice(0, 12),
      people: company.people.slice(0, 12).map((p) => ({
        name: p.name,
        handle: p.slackHandle,
        team: p.team,
      })),
      /** A handful of real lines, so the user can see it read their words. */
      sample: company.artifacts.slice(0, 8).map((a) => ({
        kind: a.kind,
        source: a.channel ?? a.kind,
        author: a.author,
        snippet: a.text.replace(/\s+/g, " ").trim().slice(0, 140),
      })),
    },
    { status: 200 },
  );
}

/**
 * Both entry shapes, normalised.
 *
 * Multipart is the drag-and-drop path; JSON is the paste path. A `file` part
 * wins over a `raw` field when both are present — someone who attached a file
 * meant the file.
 */
async function readInput(request: Request): Promise<z.infer<typeof Body>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw fail(400, "That upload could not be read as a form.");
    }

    const file = form.get("file");
    let raw = field(form, "raw") ?? "";

    if (file && typeof file === "object" && "text" in file) {
      const blob = file as File;
      if (blob.size > MAX_BYTES) {
        throw fail(
          413,
          `That file is ${mb(blob.size)}MB. The limit is ${mb(MAX_BYTES)}MB, a few busy channels is plenty.`,
        );
      }
      raw = await blob.text();
    }

    return {
      name: field(form, "name") ?? "",
      roleTitle: field(form, "roleTitle") ?? "",
      raw,
      description: field(form, "description") || undefined,
    };
  }

  const text = await request.text();
  // `content-length` can be absent or wrong on a chunked body, so measure the
  // bytes we actually received too.
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
    throw fail(413, `That payload is over the ${mb(MAX_BYTES)}MB limit.`);
  }

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw fail(400, "Body must be JSON, or a multipart upload.");
  }

  const record = (body ?? {}) as Record<string, unknown>;
  return {
    name: String(record.name ?? ""),
    roleTitle: String(record.roleTitle ?? ""),
    raw: typeof record.raw === "string" ? record.raw : "",
    description: typeof record.description === "string" ? record.description : undefined,
  };
}

function field(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : undefined;
}

function fail(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
