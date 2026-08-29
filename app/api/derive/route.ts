/**
 * POST /api/derive — the whole thesis in one request.
 *
 * Read the company's corpus, derive what the role actually is, verify every
 * citation against the source text, build two days of real first work, and hand
 * back a hire who already has an opening message waiting for them.
 *
 * The route itself stays thin on purpose: all the judgement lives in lib/agent,
 * where it can be read, argued with, and tested without a running server.
 */

import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getCompany } from "@/lib/seed";
import { deriveRoleWithGrounding } from "@/lib/agent/derive";
import { buildRampPlan } from "@/lib/agent/plan";
import { openingMessage } from "@/lib/agent/supervise";
import { getHire, putHire } from "@/lib/agent/hires";
import { toApiError } from "@/lib/anthropic";
import type { HireState, TaskStatus } from "@/lib/types";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  companySlug: z.string().min(1),
  roleTitle: z.string().min(2).max(120),
  name: z.string().min(1).max(80).optional(),
  /** Attach to an existing hire instead of creating one. */
  hireId: z.string().min(1).optional(),
});

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

  const company = getCompany(companySlug);
  if (!company) {
    return NextResponse.json({ error: `No company seeded for "${companySlug}".` }, { status: 404 });
  }

  try {
    const { role, grounding } = await deriveRoleWithGrounding(company, roleTitle);

    // Logged, never swallowed. If the model is inventing quotes we want to know
    // it from the server log, not from a hiring manager pointing at the screen.
    if (grounding.droppedCount > 0) {
      console.warn(
        `[derive] dropped ${grounding.droppedCount} unverifiable citation(s) for "${roleTitle}" @ ${companySlug}:`,
        grounding.dropped.map((d) => `${d.artifactId}:${d.reason}`).join(", "),
      );
    }

    const plan = await buildRampPlan(company, role);

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

    return NextResponse.json(
      { hire, grounding: { kept: grounding.keptCount, dropped: grounding.droppedCount } },
      { status: 200 },
    );
  } catch (err) {
    const { status, message } = toApiError(err);
    console.error("[derive]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
