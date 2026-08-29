/**
 * POST /api/app/company  { name }  → creates a company and makes the caller its admin.
 *
 * This is the one operation row-level security cannot express. Every policy in
 * supabase/schema.sql answers "is the caller a member of this company", and at
 * first run the answer is no for every company including the one about to
 * exist. So it runs server-side with the service key, which bypasses RLS — and
 * therefore has to do the authorisation itself.
 *
 * It does exactly one thing with that power: verify the bearer token really
 * belongs to a signed-in user, then insert two rows tied to that user's id. It
 * never takes a user id from the request body, because a service-role route
 * that trusts a client-supplied id is an account takeover with extra steps.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ name: z.string().min(1).max(120) });

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "company"
  );
}

export async function POST(request: Request) {
  const db = serviceClient();
  if (!db) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  // Verify the token against Supabase rather than decoding it here. A JWT this
  // route merely parsed would be a JWT anyone could forge.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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
    return NextResponse.json({ error: "Give the company a name." }, { status: 400 });
  }

  // Already in one? Return it rather than making a second. Double-submitting
  // this form should be boring.
  const { data: existing } = await db
    .from("members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, companyId: existing.company_id });
  }

  const name = parsed.data.name.trim();
  const base = slugify(name);
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: company, error: companyErr } = await db
    .from("companies")
    .insert({ name, slug })
    .select()
    .single();
  if (companyErr || !company) {
    return NextResponse.json(
      { error: "Could not create the workspace." },
      { status: 500 },
    );
  }

  const { error: memberErr } = await db.from("members").insert({
    company_id: company.id,
    user_id: user.id,
    role: "admin",
    full_name: user.email ?? null,
  });
  if (memberErr) {
    // A company nobody can reach is worse than no company: it would sit there
    // invisible and the next attempt would make another.
    await db.from("companies").delete().eq("id", company.id);
    return NextResponse.json(
      { error: "Could not create the workspace." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, companyId: company.id });
}
