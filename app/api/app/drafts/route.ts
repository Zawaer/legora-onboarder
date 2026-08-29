/**
 * POST /api/app/drafts  { draftId, action, editedBody? }  → decides one draft.
 *
 * The queue itself is read in the browser under row-level security, which is
 * the real boundary. This route is not, because it writes with the service
 * key: RLS is off for it, and the only thing between a signed-in stranger and
 * another company's queue is the two checks below. Both of them, in order,
 * every time.
 *
 *   1. The bearer token is verified against Supabase, not decoded here. A JWT
 *      this route merely parsed would be a JWT anyone could forge.
 *   2. The draft's own company_id is read from the row and checked against
 *      `members`. The company is never taken from the request, because the
 *      caller would simply send one they belong to.
 *
 * It writes to the service key because `decided_by` has to be the verified
 * user and `body` has to survive an edit untouched, and neither is something a
 * client-side update can be trusted to get right.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  draftId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  editedBody: z.string().trim().min(1).max(20000).optional(),
});

export async function POST(request: Request) {
  const db = serviceClient();
  if (!db) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }
  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  const { draftId, action, editedBody } = parsed.data;

  // An edit only means something attached to an approval. Silently dropping it
  // on a reject would write a decision nobody made.
  if (action === "reject" && editedBody !== undefined) {
    return NextResponse.json(
      { error: "An edit belongs with an approval, not a rejection." },
      { status: 400 },
    );
  }

  const { data: draft, error: draftErr } = await db
    .from("drafts")
    .select("id, company_id, status")
    .eq("id", draftId)
    .maybeSingle();
  if (draftErr) {
    return NextResponse.json({ error: "Could not read the draft." }, { status: 500 });
  }
  if (!draft) {
    return NextResponse.json({ error: "No such draft." }, { status: 404 });
  }

  // The authorisation. Note it reads the company off the row rather than off
  // the request: a caller who could name the company would be authorising
  // themselves.
  const { data: membership } = await db
    .from("members")
    .select("role")
    .eq("company_id", draft.company_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || membership.role !== "admin") {
    return NextResponse.json(
      { error: "Only an admin of this company can decide its drafts." },
      { status: 403 },
    );
  }

  const patch: Record<string, unknown> = {
    status: action === "approve" ? "approved" : "rejected",
    // From the verified session, never from the body. This column is the audit
    // trail a quality function will read, so a client-supplied value would
    // make it worse than useless.
    decided_by: user.id,
    decided_at: new Date().toISOString(),
  };
  // `body` is deliberately absent from this patch. The schema keeps the
  // agent's original so "what did it actually say" stays answerable.
  if (editedBody !== undefined) patch.edited_body = editedBody;

  // `status = pending` in the filter makes this a compare-and-set: two admins
  // clicking at once, or one double-click, and the second write finds nothing
  // to update rather than overwriting the first decision and its timestamp.
  const { data: updated, error: updateErr } = await db
    .from("drafts")
    .update(patch)
    .eq("id", draftId)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (updateErr) {
    return NextResponse.json({ error: "Could not save the decision." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json(
      { error: "This draft has already been decided." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, draft: updated });
}
