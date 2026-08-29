/**
 * POST   /api/app/materials  { companyId, fileName, storagePath, bytes } → records an upload.
 * DELETE /api/app/materials  { id }                                      → removes a row and its object.
 *
 * The file itself goes straight from the browser to Supabase Storage, where
 * the policies in supabase/storage.sql decide who may write into which folder.
 * This route only writes the row that makes the file findable.
 *
 * It runs with the service key, which bypasses row-level security completely.
 * That is the whole reason it has to be paranoid: without the membership check
 * below, any signed-in stranger could POST a company id they do not belong to
 * and put rows in someone else's workspace. So the pattern from
 * /api/app/company holds here too. Verify the bearer token against Supabase
 * first, then check what that verified user is actually allowed to do, and
 * never take an identity from the request body.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mirrors the bucket's file_size_limit and the cap the uploader enforces. */
const MAX_BYTES = 10 * 1024 * 1024;

const PostBody = z.object({
  companyId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  storagePath: z.string().min(3).max(512),
  bytes: z.number().int().nonnegative().max(MAX_BYTES),
});

const DeleteBody = z.object({ id: z.string().uuid() });

type Ctx = { db: SupabaseClient; user: User };

/**
 * Resolve the caller, or the response to send instead.
 *
 * The token is verified by asking Supabase who it belongs to rather than
 * decoding it here. A JWT this route merely parsed would be a JWT anyone could
 * write themselves.
 */
async function context(request: Request): Promise<Ctx | NextResponse> {
  const db = serviceClient();
  if (!db) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await asUser.auth.getUser();
  const user = data?.user;
  if (error || !user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  return { db, user };
}

/** The caller's role in this company, or null if they are not in it at all. */
async function roleIn(
  db: SupabaseClient,
  userId: string,
  companyId: string,
): Promise<"admin" | "employee" | null> {
  const { data } = await db
    .from("members")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();
  return (data?.role as "admin" | "employee" | undefined) ?? null;
}

export async function POST(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof NextResponse) return ctx;
  const { db, user } = ctx;

  const parsed = PostBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "That upload could not be recorded." }, { status: 400 });
  }
  const { companyId, fileName, storagePath, bytes } = parsed.data;

  // The path is the access boundary in storage.sql, so a row is only allowed
  // to point inside its own company's folder. Storage policies already stop a
  // member writing an object into another company's folder, but nothing stops
  // them describing one, and a row pointing at a neighbour's file would be
  // handed a signed URL by the app on request. Cheap check, real hole closed.
  if (!storagePath.startsWith(`${companyId}/`) || storagePath.includes("..")) {
    return NextResponse.json({ error: "That upload could not be recorded." }, { status: 400 });
  }

  if (!(await roleIn(db, user.id, companyId))) {
    return NextResponse.json(
      { error: "You are not a member of that company." },
      { status: 403 },
    );
  }

  const { data, error } = await db
    .from("materials")
    .insert({
      company_id: companyId,
      file_name: fileName.trim().slice(0, 255),
      storage_path: storagePath,
      bytes,
      // From the verified token, never the body. This is the audit trail a
      // quality function will ask about, and it is only worth having if it
      // cannot be dictated by whoever is calling.
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not record the upload." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, material: data });
}

export async function DELETE(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof NextResponse) return ctx;
  const { db, user } = ctx;

  // Body first, query string as a fallback. Some clients drop a body on
  // DELETE, and losing a delete to a transport detail is a bad afternoon.
  const raw = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = raw?.id ?? new URL(request.url).searchParams.get("id") ?? undefined;
  const parsed = DeleteBody.safeParse({ id });
  if (!parsed.success) {
    return NextResponse.json({ error: "Nothing to delete." }, { status: 400 });
  }

  // Read the row first so the company id comes from the database rather than
  // from the caller. Authorising against an id in the request body would be
  // authorising against something the attacker chose.
  const { data: row } = await db
    .from("materials")
    .select("id, company_id, storage_path")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Nothing to delete." }, { status: 404 });
  }

  if ((await roleIn(db, user.id, row.company_id)) !== "admin") {
    return NextResponse.json(
      { error: "Only an admin can remove material." },
      { status: 403 },
    );
  }

  // Object before row. The other order can leave a file in the bucket that
  // nothing in the product knows about, which is the one outcome a customer
  // asking about data deletion will not accept.
  const { error: objectErr } = await db.storage
    .from("materials")
    .remove([row.storage_path]);
  if (objectErr) {
    return NextResponse.json({ error: "Could not remove the file." }, { status: 500 });
  }

  const { error: rowErr } = await db.from("materials").delete().eq("id", row.id);
  if (rowErr) {
    return NextResponse.json({ error: "Could not remove the file." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
