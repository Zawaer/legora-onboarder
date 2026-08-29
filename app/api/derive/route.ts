/**
 * POST /api/derive — the whole thesis in one request.
 *
 * Read the company's corpus, derive what the role actually is, verify every
 * citation against the source text, build two days of real first work, and hand
 * back a hire who already has an opening message waiting for them.
 *
 * A cold run is two Opus calls over the full corpus: roughly two minutes, which
 * is the honest price of the only hard thing in the product. Repeating it for
 * an unchanged corpus and the same role title is not work, it is waiting, so
 * the result is cached on disk (see lib/agent/cache.ts). The response always
 * says which path it took — `cached` and `derivedAt` — because a spinner over a
 * disk read is a lie with a progress bar, and this product's whole claim is
 * that it does not show you things that did not happen.
 *
 * Creating a hire is unaffected either way: a new HireState, a fresh opening
 * message and a clean task board are built on every call, hit or miss.
 *
 * The route itself stays thin on purpose: all the judgement lives in lib/agent,
 * where it can be read, argued with, and tested without a running server.
 */

import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { loadCompany } from "@/lib/agent/knowledge";
import { deriveRoleWithGrounding } from "@/lib/agent/derive";
import { buildRampPlan } from "@/lib/agent/plan";
import { openingMessage } from "@/lib/agent/supervise";
import { getHire, putHire } from "@/lib/agent/hires";
import { listDerivations, readDerivation, writeDerivation } from "@/lib/agent/cache";
import { toApiError } from "@/lib/anthropic";
import type { DerivedRole, HireState, RampPlan, TaskStatus } from "@/lib/types";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A cold derivation measured 140-186 seconds against the seeded corpus, so the
 * 60 this used to be would have killed every uncached run on Vercel while
 * passing every rehearsal — `next dev` does not enforce it.
 *
 * 300 is the ceiling Vercel allows on Fluid Compute; if the account's plan
 * caps lower, the platform clamps it rather than failing the build, and the
 * symptom is the same timeout at whatever that limit is. The demo path is
 * unaffected either way because it is served from cache in ~20ms — this only
 * governs a genuinely new derivation, which is the `/ingest` flow.
 */
export const maxDuration = 300;

const Body = z.object({
  companySlug: z.string().min(1),
  roleTitle: z.string().min(2).max(120),
  name: z.string().min(1).max(80).optional(),
  /** Attach to an existing hire instead of creating one. */
  hireId: z.string().min(1).optional(),
  /** Force a real derivation and overwrite whatever is cached. */
  fresh: z.boolean().optional(),
});

/** What is already warm, so the UI can promise a fast path only when it has one. */
export async function GET() {
  return NextResponse.json({ derivations: await listDerivations() }, { status: 200 });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { companySlug, roleTitle, name, hireId } = parsed.data;

  // `?fresh=1` and `{ fresh: true }` both work: the query param is what you can
  // type into a browser bar mid-demo, the body field is what the UI sends.
  const freshParam = new URL(request.url).searchParams.get("fresh");
  const fresh = parsed.data.fresh === true || freshParam === "1" || freshParam === "true";

  // Seeded corpora first, then anything a customer ingested at /ingest, then
  // everything the agent has since elicited from the team and had confirmed. An
  // ingested company is the same `Company` shape, so everything below this
  // line is identical either way — which is the point: the pilot path and the
  // demo path must not be two different code paths.
  //
  // The third source is what makes this compound. A question that had to be
  // taken to a human last month is in `company.artifacts` this month, so the
  // next derivation reads it as ordinary corpus and can cite it, with no code
  // below this line knowing where it came from. See lib/agent/knowledge.ts.
  const company = await loadCompany(companySlug);
  if (!company) {
    return NextResponse.json(
      { error: `No company seeded or ingested for "${companySlug}".` },
      { status: 404 },
    );
  }

  try {
    let role: DerivedRole;
    let plan: RampPlan;
    let grounding: { kept: number; dropped: number };
    let derivedAt: string;
    let cached: boolean;

    // A hit is only a hit if it came from the corpus we are holding now —
    // readDerivation compares a hash, so editing the seed invalidates the entry
    // without anyone having to remember to.
    const hit = fresh ? undefined : await readDerivation(company, roleTitle);

    if (hit) {
      ({ role, plan, grounding, derivedAt } = hit);
      cached = true;
    } else {
      const derived = await deriveRoleWithGrounding(company, roleTitle);
      role = derived.role;

      // Logged, never swallowed. If the model is inventing quotes we want to
      // know it from the server log, not from a hiring manager pointing at the
      // screen. Note this runs on the cold path only — which is correct,
      // because the cached entry stores post-verification evidence: nothing
      // unverified is ever written to disk in the first place.
      if (derived.grounding.droppedCount > 0) {
        console.warn(
          `[derive] dropped ${derived.grounding.droppedCount} unverifiable citation(s) for "${roleTitle}" @ ${companySlug}:`,
          derived.grounding.dropped.map((d) => `${d.artifactId}:${d.reason}`).join(", "),
        );
      }

      plan = await buildRampPlan(company, role);
      grounding = { kept: derived.grounding.keptCount, dropped: derived.grounding.droppedCount };
      ({ derivedAt } = await writeDerivation(company, roleTitle, { role, plan, grounding }));
      cached = false;
    }

    const existing = hireId ? await getHire(hireId) : undefined;
    const taskStatus: Record<string, TaskStatus> = {};
    for (const day of plan.days) for (const task of day.tasks) taskStatus[task.id] = "not_started";

    const hire: HireState = {
      id: existing?.id ?? randomUUID(),
      name: name ?? existing?.name ?? "New hire",
      roleTitle,
      companySlug,
      startedAt: existing?.startedAt ?? new Date().toISOString(),
      derivedRole: role,
      plan,
      taskStatus,
      messages: [],
      blockers: existing?.blockers ?? [],
    };

    // The agent speaks first. This is not decoration — it is the behaviour that
    // separates this from a search box, so it happens at creation time rather
    // than waiting for the UI to ask for it.
    hire.messages = [openingMessage(hire, plan)];

    await putHire(hire);

    return NextResponse.json({ hire, cached, derivedAt, grounding }, { status: 200 });
  } catch (err) {
    const { status, message } = toApiError(err);
    console.error("[derive]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
