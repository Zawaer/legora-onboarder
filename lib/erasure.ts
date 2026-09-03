/**
 * Erasure: remove everything we hold for one company.
 *
 * GDPR Art. 17 requires this, and docs/data-processing.md §5 promises it. That
 * document must not go to a customer until this works, because a deletion
 * promise we cannot execute is the one claim in it a reviewer could catch us
 * on.
 *
 * WHY A FUNCTION AND A SCRIPT, NOT A BUTTON
 *
 * A documented manual process, executed within a stated timeframe, satisfies
 * the obligation. A self-serve delete button does not, on its own, and it adds
 * an authenticated destructive endpoint to a product with no customers yet —
 * more risk than the convenience is worth. Run scripts/erase-company.mjs.
 *
 * WHAT "EVERYTHING" MEANS
 *
 * Four stores, and missing any one of them makes the promise false:
 *
 *   1. Postgres `companies` — members, drafts and materials rows cascade from
 *      it (`on delete cascade` in supabase/schema.sql).
 *   2. Supabase Storage — the cascade does NOT reach uploaded files. They live
 *      under a folder named for the company id and must be removed explicitly.
 *   3. The kv corpus (`store:companies`) — this is the customer's actual
 *      content, the export or documents they handed us. A deletion that misses
 *      this has deleted nothing that matters.
 *   4. In-process memory — cleared by deleteIngestedCompany, or an instance
 *      that had the corpus cached keeps serving it and can write it back.
 *
 *   5. The four agent stores — hires, derivations, knowledge (elicitations)
 *      and resolutions. These were per-instance disk state that never
 *      persisted on serverless. They now have a kv backing, so they are
 *      durable, so they are in scope here. Each module exports its own
 *      purgeCompany so the in-memory map is cleared too.
 *
 * Server-only.
 */

import { purgeCompany as purgeDerivations } from "@/lib/agent/cache";
import { purgeCompany as purgeHires } from "@/lib/agent/hires";
import { purgeCompany as purgeKnowledge } from "@/lib/agent/knowledge";
import { purgeCompany as purgeResolutions } from "@/lib/agent/resolutions";
import { deleteIngestedCompany } from "@/lib/ingest/store";
import { isSupabaseConfigured, serviceClient } from "@/lib/supabase";

export type ErasureReport = {
  slug: string;
  companyId: string | null;
  corpusDeleted: boolean;
  /** Rows removed from the agent stores, by store. */
  agentRows: { hires: number; derivations: number; knowledge: number; resolutions: number };
  filesDeleted: number;
  rowDeleted: boolean;
  /** Non-fatal problems. A partial erasure is a failure — read these. */
  warnings: string[];
};

const BUCKET = "materials";

export async function eraseCompany(slug: string): Promise<ErasureReport> {
  const report: ErasureReport = {
    slug,
    companyId: null,
    corpusDeleted: false,
    agentRows: { hires: 0, derivations: 0, knowledge: 0, resolutions: 0 },
    filesDeleted: 0,
    rowDeleted: false,
    warnings: [],
  };

  // The corpus first. It is the content that matters, and it is the one store
  // that works without Supabase — so a misconfigured environment still erases
  // the thing a customer actually asked us to erase.
  try {
    report.corpusDeleted = await deleteIngestedCompany(slug);
  } catch (err) {
    report.warnings.push(`corpus: ${(err as Error).message}`);
  }

  // The agent stores hold what was *derived* from the corpus — the hire's
  // plan, their conversation, what colleagues were asked, what was resolved.
  // Deleting the corpus and keeping these would keep the customer's people
  // and their words in a different shape.
  const stores = [
    ["hires", purgeHires],
    ["derivations", purgeDerivations],
    ["knowledge", purgeKnowledge],
    ["resolutions", purgeResolutions],
  ] as const;
  for (const [name, purge] of stores) {
    try {
      report.agentRows[name] = await purge(slug);
    } catch (err) {
      report.warnings.push(`${name}: ${(err as Error).message}`);
    }
  }

  if (!isSupabaseConfigured()) {
    report.warnings.push(
      "Supabase is not configured, so no database row or uploaded file was touched. " +
        "Run this against the production environment.",
    );
    return report;
  }

  const db = serviceClient();
  if (!db) {
    report.warnings.push("No service-role client; database and storage untouched.");
    return report;
  }

  const { data: company, error: findErr } = await db
    .from("companies")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (findErr) {
    report.warnings.push(`lookup: ${findErr.message}`);
    return report;
  }
  if (!company) {
    // Not an error. A company can exist as an ingested corpus without ever
    // having had an account, which is exactly the pilot case.
    return report;
  }

  const companyId = (company as { id: string }).id;
  report.companyId = companyId;

  // Files before the row. The other order leaves orphaned objects with no row
  // left to tell us they existed.
  const { data: files, error: listErr } = await db.storage.from(BUCKET).list(companyId);
  if (listErr) {
    report.warnings.push(`storage list: ${listErr.message}`);
  } else if (files?.length) {
    const paths = files.map((f) => `${companyId}/${f.name}`);
    const { error: rmErr } = await db.storage.from(BUCKET).remove(paths);
    if (rmErr) report.warnings.push(`storage remove: ${rmErr.message}`);
    else report.filesDeleted = paths.length;
  }

  const { error: delErr } = await db.from("companies").delete().eq("id", companyId);
  if (delErr) report.warnings.push(`row delete: ${delErr.message}`);
  else report.rowDeleted = true;

  return report;
}
