/**
 * GET  /api/hire            — list every hire
 * GET  /api/hire?id=...     — one hire's full state
 * POST /api/hire            — create a hire shell (no model call)
 *
 * Creating a hire is deliberately separate from deriving their role: the shell
 * is instant and free, the derivation costs a model call and thirty seconds. A
 * UI that wants to show "deriving..." needs something to attach that spinner to.
 */

import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { loadCompany } from "@/lib/agent/knowledge";
import { getHire, listHires, putHire } from "@/lib/agent/hires";
import type { HireState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  companySlug: z.string().min(1),
  roleTitle: z.string().min(2).max(120),
  name: z.string().min(1).max(80),
});

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");

  if (!id) return NextResponse.json({ hires: await listHires() }, { status: 200 });

  const hire = await getHire(id);
  if (!hire) return NextResponse.json({ error: "Unknown hire." }, { status: 404 });
  return NextResponse.json({ hire }, { status: 200 });
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

  const { companySlug, roleTitle, name } = parsed.data;

  // Same resolver /api/derive uses, so a slug is never accepted by one and
  // rejected by the other — seeded or ingested, both are real companies here.
  if (!(await loadCompany(companySlug))) {
    return NextResponse.json({ error: `No company known as "${companySlug}".` }, { status: 404 });
  }

  const hire: HireState = {
    id: randomUUID(),
    name,
    roleTitle,
    companySlug,
    startedAt: new Date().toISOString(),
    taskStatus: {},
    messages: [],
    blockers: [],
  };

  await putHire(hire);
  return NextResponse.json({ hire }, { status: 201 });
}
