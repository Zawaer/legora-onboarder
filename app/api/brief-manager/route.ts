/**
 * GET  /api/brief-manager?hireId=…[&startsAt=…][&format=slack]
 * POST /api/brief-manager   { hireId, startsAt?, format? }
 *
 * The manager brief for one hire: who the buddy should be, who to meet, the
 * first real task with a worked example beside it, and what the company has not
 * decided. Every item carries a verified quote from the company's own corpus.
 *
 * ── WHY THERE IS NO MODEL CALL BEHIND THIS ──────────────────────────────────
 *
 * Unlike /api/derive, this route is pure composition over material that has
 * already been derived (see the header of lib/agent/manager-brief.ts). That is
 * a product decision as much as a cost one: this endpoint is designed to be hit
 * by a scheduler two days before every start date, so it has to be free, fast
 * and identical on every call. It costs nothing, it cannot 502 on an upstream,
 * and it cannot hallucinate a colleague's name at 03:00 with nobody watching.
 *
 * Consequently the rate limit is generous — it defends against a stranger
 * hammering a public URL, not against a bill.
 *
 * ── WHY `startsAt` IS A PARAMETER ───────────────────────────────────────────
 *
 * `HireState.startedAt` is when the record was created, not when the person
 * walks in; the type has no field for a start date, and inventing one from a
 * message in the corpus would be exactly the kind of confident guess the rest
 * of this codebase refuses to make. So a caller that knows the date passes it,
 * and a caller that does not gets a brief that says plainly, in `gaps`, that
 * the date on it is a record timestamp.
 *
 * `format=slack` returns the message as text/plain so the whole feature is
 * demonstrable with curl and pasteable straight into Slack.
 */

import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getHire } from "@/lib/agent/hires";
import { composeManagerBrief } from "@/lib/agent/manager-brief";
import { loadCompany } from "@/lib/agent/knowledge";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** No model call and no disk write beyond the hire read, so this can be polled. */
const LIMIT = 60;

const NO_STORE = { "cache-control": "no-store, max-age=0" } as const;

/**
 * An ISO 8601 instant. Rejecting anything else here rather than letting
 * `Date.parse` return NaN downstream is the difference between a 400 that says
 * what is wrong and a brief headed "Invalid Date".
 */
const IsoInstant = z
  .string()
  .trim()
  .min(10)
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), "Must be an ISO 8601 date-time.");

const Query = z.object({
  hireId: z.string().trim().min(1).max(200),
  startsAt: IsoInstant.optional(),
  format: z.enum(["json", "slack"]).default("json"),
});

async function handle(input: unknown): Promise<Response> {
  const parsed = Query.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.issues },
      { status: 400, headers: NO_STORE },
    );
  }

  const { hireId, startsAt, format } = parsed.data;

  const hire = await getHire(hireId);
  if (!hire) {
    return NextResponse.json({ error: "Unknown hire." }, { status: 404, headers: NO_STORE });
  }

  const company = await loadCompany(hire.companySlug);
  if (!company) {
    return NextResponse.json(
      { error: `No corpus for "${hire.companySlug}", so there is nothing to cite.` },
      { status: 404, headers: NO_STORE },
    );
  }

  const brief = composeManagerBrief(hire, company, { startsAt });

  if (format === "slack") {
    return new NextResponse(brief.slack, {
      status: 200,
      headers: {
        ...NO_STORE,
        "content-type": "text/plain; charset=utf-8",
        // Enough for a scheduler to decide whether to send without parsing the
        // body: a brief that knows nothing is one you would rather hold back.
        "x-brief-buddy": brief.buddy ? "yes" : "none",
        "x-brief-meet": String(brief.meet.length),
        "x-brief-gaps": String(brief.gaps.length),
      },
    });
  }

  return NextResponse.json({ brief }, { status: 200, headers: NO_STORE });
}

export async function GET(request: Request) {
  const limited = rateLimit(`brief-manager:${clientIp(request)}`, { limit: LIMIT });
  if (!limited.ok) return tooMany(limited.retryAfter);

  const params = new URL(request.url).searchParams;
  return handle({
    hireId: params.get("hireId") ?? params.get("hire") ?? undefined,
    startsAt: params.get("startsAt") ?? undefined,
    format: params.get("format") ?? undefined,
  });
}

export async function POST(request: Request) {
  const limited = rateLimit(`brief-manager:${clientIp(request)}`, { limit: LIMIT });
  if (!limited.ok) return tooMany(limited.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400, headers: NO_STORE });
  }
  return handle(body);
}

function tooMany(retryAfter: number): Response {
  return NextResponse.json(
    { error: "Too many briefs. Give it a minute." },
    { status: 429, headers: { ...NO_STORE, "retry-after": String(retryAfter) } },
  );
}
