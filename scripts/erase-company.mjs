/**
 * Erase everything we hold for one company.
 *
 *   npm run erase -- <slug>          show what would be removed
 *   npm run erase -- <slug> --yes    remove it
 *
 * GDPR Art. 17. docs/data-processing.md §5 promises this to customers, and
 * docs/security.md §2 item 4 tracks it. The dry run is the default because
 * this is irreversible and the argument is a slug someone typed.
 *
 * Reads .env.local, so run it from the repo root against whichever environment
 * that file points at. To erase production data, point it at production
 * credentials deliberately — there is no flag that does it for you.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [slug, ...flags] = process.argv.slice(2);
const confirmed = flags.includes("--yes");

if (!slug) {
  console.error("usage: npm run erase -- <slug> [--yes]");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const BUCKET = "materials";
const KV_KEY = "store:companies";

console.log(`\n${confirmed ? "ERASING" : "DRY RUN —"} company "${slug}"`);
console.log(`  target: ${new URL(url).host}\n`);

// ── 1. the corpus, in kv ─────────────────────────────────────────────────────
const { data: kvRow } = await db.from("kv").select("value").eq("key", KV_KEY).maybeSingle();
const rows = Array.isArray(kvRow?.value) ? kvRow.value : [];
const match = rows.find((r) => r?.company?.slug === slug);
console.log(
  match
    ? `  corpus:  found — ingested ${match.ingestedAt}, format ${match.format}`
    : "  corpus:  none stored",
);

// ── 1b. the agent stores, in kv ──────────────────────────────────────────────
// What was *derived* from the corpus: the hire's plan and conversation, what
// colleagues were asked, what was resolved. Deleting the corpus and keeping
// these keeps the customer's people and their words in a different shape.
const AGENT_KEYS = ["store:hires", "store:derivations", "store:knowledge", "store:resolutions"];
const agentRows = {};
for (const key of AGENT_KEYS) {
  const { data } = await db.from("kv").select("value").eq("key", key).maybeSingle();
  const all = Array.isArray(data?.value) ? data.value : [];
  agentRows[key] = { all, mine: all.filter((r) => r?.companySlug === slug) };
  console.log(`  ${key.replace("store:", "").padEnd(12)} ${agentRows[key].mine.length} row(s) for this company`);
}

// ── 2. the account row, and what cascades from it ────────────────────────────
const { data: company } = await db.from("companies").select("id, name").eq("slug", slug).maybeSingle();
let files = [];
if (company) {
  console.log(`  company: ${company.name} (${company.id})`);
  for (const t of ["members", "drafts", "materials"]) {
    const { count } = await db.from(t).select("*", { count: "exact", head: true }).eq("company_id", company.id);
    console.log(`    ${t.padEnd(10)} ${count ?? 0} row(s) — cascades`);
  }
  const { data: listed } = await db.storage.from(BUCKET).list(company.id);
  files = listed ?? [];
  console.log(`    files      ${files.length} object(s) — removed explicitly`);
} else {
  console.log("  company: no account row (corpus-only, which is the normal pilot case)");
}

if (!confirmed) {
  console.log("\nNothing was changed. Re-run with --yes to erase.\n");
  process.exit(0);
}

// ── erase ────────────────────────────────────────────────────────────────────
if (match) {
  const kept = rows.filter((r) => r?.company?.slug !== slug);
  const { error } = await db
    .from("kv")
    .upsert({ key: KV_KEY, value: kept, updated_at: new Date().toISOString() }, { onConflict: "key" });
  console.log(error ? `  corpus:  FAILED — ${error.message}` : "  corpus:  deleted");
}

for (const key of AGENT_KEYS) {
  const { all, mine } = agentRows[key];
  if (!mine.length) continue;
  const kept = all.filter((r) => r?.companySlug !== slug);
  const { error } = await db
    .from("kv")
    .upsert({ key, value: kept, updated_at: new Date().toISOString() }, { onConflict: "key" });
  console.log(error ? `  ${key}: FAILED — ${error.message}` : `  ${key}: ${mine.length} deleted`);
}

if (company) {
  if (files.length) {
    const { error } = await db.storage.from(BUCKET).remove(files.map((f) => `${company.id}/${f.name}`));
    console.log(error ? `  files:   FAILED — ${error.message}` : `  files:   ${files.length} deleted`);
  }
  const { error } = await db.from("companies").delete().eq("id", company.id);
  console.log(error ? `  row:     FAILED — ${error.message}` : "  row:     deleted (cascaded)");
}

console.log(
  "\nDone. Serving instances may hold the corpus in memory until they recycle;\n" +
    "redeploy if the erasure must take effect immediately.\n",
);
