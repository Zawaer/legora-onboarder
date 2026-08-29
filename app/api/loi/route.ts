import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { normaliseSource } from "@/lib/source";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isLiveMode } from "@/lib/livemode";
import { saveLoi } from "@/lib/store";
import { notify } from "@/lib/notify";
import type { Loi } from "@/lib/types";

const Body = z.object({
  full_name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).optional(),
  company: z.string().trim().max(120).optional(),
  intent: z.string().trim().min(1).max(400),
  blocker: z.string().trim().max(400).optional(),
  email: z.string().trim().email(),
  signed_name: z.string().trim().min(1).max(120),
  source: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  const limited = rateLimit(`loi:${clientIp(request)}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "check the fields" }, { status: 400 });
  }

  const { source, role, company, blocker, ...rest } = parsed.data;

  const loi: Loi = {
    ...rest,
    id: randomUUID(),
    role: role ?? "",
    company: company ?? "",
    blocker: blocker ?? "",
    source: normaliseSource(source, "room"),
    // Both stamped here, never taken from the client: a timestamp from the
    // signer's phone is a claim, and `livemode` from the browser is a lie
    // waiting to happen.
    created_at: new Date().toISOString(),
    livemode: isLiveMode(),
  };

  // Written to the log BEFORE the disk, on one line with a greppable prefix.
  // `data/*.json` is per-instance and ephemeral on serverless, and a signed LOI
  // is worth a full traction band — so the log is the backup of record:
  // `vercel logs | grep LOI_SIGNED` reconstructs every signature even if the
  // file store is wiped between requests.
  console.log(`LOI_SIGNED ${JSON.stringify(loi)}`);

  // Slack, in parallel with the disk write. The log line above is the backup of
  // record, but logs age out and "grep the deployment logs" is a poor way to
  // find out a letter of intent was signed. This is the channel that actually
  // tells somebody, while it still matters.
  //
  // Not awaited before the response for the same reason the disk failure is
  // swallowed: the client renders the signed artefact from this response and
  // that screenshot is the proof. Nothing we do for our own benefit should be
  // able to delay or block it.
  void notify(
    `*Letter of intent signed*\n` +
      `*${loi.full_name}* — ${loi.role}, ${loi.company}\n` +
      `Intends to: ${loi.intent}\n` +
      `Blocked on: ${loi.blocker}\n` +
      `${loi.email} · signed "${loi.signed_name}" · via ${loi.source}` +
      (loi.livemode ? "" : "\n_test mode — does not count as traction_"),
    { kind: "loi", ...loi },
  );

  try {
    await saveLoi(loi);
  } catch (error) {
    // Deliberately NOT a 500. The client renders the signed artefact from this
    // response and that screenshot is the proof we submit; a failed disk write
    // must never be what stops it appearing. We already have the LOI in the log
    // line above, so nothing is actually lost.
    console.error("loi save failed, recover from the LOI_SIGNED log line", error);
  }

  // The timestamp goes back to the form so the signed artefact it renders —
  // the thing we screenshot for the submission — carries our clock, not theirs.
  return NextResponse.json({ ok: true, created_at: loi.created_at });
}
