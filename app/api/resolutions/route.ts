/**
 * GET /api/resolutions — how every question got answered, as numbers.
 *
 * Queryable rather than merely displayed, on purpose. The headline claim the
 * web rung makes is a ratio, and a ratio that only exists as pixels on a
 * dashboard cannot be checked, sliced by pilot, or quoted with a date attached.
 * Anyone writing this up should be able to run the query themselves and get the
 * same number:
 *
 *   /api/resolutions
 *   /api/resolutions?company=legora
 *   /api/resolutions?hire=demo-legal-engineer
 *   /api/resolutions?since=2026-08-29T00:00:00Z
 *   /api/resolutions?records=1        ← the rows the numbers were computed from
 *
 * `generalShareOfCorpusMisses` is null, never 0, when nothing has missed the
 * corpus yet: "0% of misses were general" and "there have been no misses" are
 * different claims and publishing the first when the second is true would be a
 * fabricated statistic.
 *
 * Read-only. Nothing here writes, and nothing here can reach the corpus.
 */

import { NextResponse } from "next/server";
import { listResolutions, summarise } from "@/lib/agent/resolutions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Enough rows to audit a demo or a pilot without shipping the whole history. */
const MAX_RECORDS_RETURNED = 500;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const companySlug = params.get("company")?.trim() || undefined;
  const hireId = params.get("hire")?.trim() || undefined;
  const since = params.get("since")?.trim() || undefined;

  if (since && !Number.isFinite(Date.parse(since))) {
    return NextResponse.json(
      { error: "`since` must be an ISO 8601 timestamp." },
      { status: 400 },
    );
  }

  try {
    const records = await listResolutions({ companySlug, hireId, since });
    const stats = summarise(records);

    const wantsRecords = ["1", "true", "yes"].includes(
      (params.get("records") ?? "").toLowerCase(),
    );

    return NextResponse.json(
      {
        query: { company: companySlug ?? null, hire: hireId ?? null, since: since ?? null },
        ...stats,
        // Newest first, and capped. The full store is on disk for anyone who
        // needs it; an endpoint that can return unbounded rows is one slow
        // request away from being the reason a demo stalls.
        records: wantsRecords ? records.slice(-MAX_RECORDS_RETURNED).reverse() : undefined,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[resolutions]", err);
    return NextResponse.json({ error: "Couldn't read the resolution log." }, { status: 500 });
  }
}
