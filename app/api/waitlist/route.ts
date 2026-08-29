/**
 * POST /api/waitlist  { email, company?, source? } → { ok: true }
 *
 * Returns 503 rather than 200 when no durable sink accepted the address. A tick
 * over a black hole is the one outcome worth being careful about here: the
 * visitor walks away believing they are on a list they are not on.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { isPlausibleEmail } from "@/lib/waitlist";
import { recordSignup, waitlistSinkStatus } from "@/lib/waitlist-sink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().min(1).max(254),
  company: z.string().max(120).optional(),
  source: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = parsed.data.email.trim();
  if (!isPlausibleEmail(email)) {
    return NextResponse.json(
      { error: "That does not look like an email address." },
      { status: 400 },
    );
  }

  const kept = await recordSignup({
    email,
    company: parsed.data.company?.trim() || undefined,
    source: parsed.data.source?.trim() || undefined,
    at: new Date().toISOString(),
  });

  if (!kept) {
    return NextResponse.json(
      {
        error:
          "We could not save that just now. Email us directly and we will add you by hand.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}

/** Diagnostic only: is a durable sink configured for this deployment? */
export async function GET() {
  return NextResponse.json(waitlistSinkStatus());
}
