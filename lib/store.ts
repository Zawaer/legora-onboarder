/**
 * Persistence: two JSON files on disk.
 *
 * There is no database here on purpose. A signed LOI and a completed Stripe
 * session are the two rows that decide 18 of 50 points, and the failure mode
 * we actually fear on a 36-hour clock is "the database was misconfigured at
 * 09:50 on Sunday", not "we outgrew a JSON file". Everything below is
 * append-mostly and human-readable — if it ever breaks, you can open the file
 * and read the evidence with your eyes.
 *
 * Server-only: touches the filesystem. Never import into a client component.
 *
 * Note for deploys: on Vercel the filesystem is ephemeral and per-instance, so
 * this is durable in local/long-running deployments and best-effort on
 * serverless. Stripe remains the system of record for money either way — this
 * store is the fast local read for our own screens.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Loi, Payment } from "@/lib/types";

const DIR = path.join(process.cwd(), "data");
const LOIS = path.join(DIR, "lois.json");
const PAYMENTS = path.join(DIR, "payments.json");

/**
 * One promise chain per file, so two in-flight requests cannot interleave a
 * read-modify-write and drop one of the two records. Only covers this
 * instance — which is the same honest limitation the rate limiter has, and
 * for the traffic this will ever see, enough.
 */
const queues = new Map<string, Promise<unknown>>();

function serialise<T>(file: string, work: () => Promise<T>): Promise<T> {
  const next = (queues.get(file) ?? Promise.resolve()).then(work, work);
  // Park a swallowed copy in the map so one caller's rejection does not
  // poison every write that queues up behind it.
  queues.set(
    file,
    next.catch(() => undefined),
  );
  return next;
}

async function readAll<T>(file: string): Promise<T[]> {
  try {
    const raw = await readFile(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    // Missing file on first run, or a truncated write. Either way an empty
    // list is the right answer — a read must never take a page down.
    return [];
  }
}

async function writeAll<T>(file: string, rows: T[]): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(file, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}

export async function listLois(): Promise<Loi[]> {
  return readAll<Loi>(LOIS);
}

export async function saveLoi(loi: Loi): Promise<Loi> {
  return serialise(LOIS, async () => {
    const rows = await readAll<Loi>(LOIS);
    rows.push(loi);
    await writeAll(LOIS, rows);
    return loi;
  });
}

export async function listPayments(): Promise<Payment[]> {
  return readAll<Payment>(PAYMENTS);
}

/**
 * Upsert on `stripe_session_id`.
 *
 * Stripe retries a webhook until it gets a 2xx, and delivers the same event
 * more than once even when it does. Appending blindly would turn one sale into
 * four on the traction slide, which is the single worst way to lose credibility
 * with a judge. The session id is the only key present in both payment and
 * subscription mode, so it is the one we key on.
 */
export async function savePayment(payment: Payment): Promise<Payment> {
  return serialise(PAYMENTS, async () => {
    const rows = await readAll<Payment>(PAYMENTS);
    const existing = rows.findIndex(
      (row) => row.stripe_session_id === payment.stripe_session_id,
    );

    if (existing === -1) {
      rows.push(payment);
    } else {
      // Keep the original created_at: the sale happened when it happened, not
      // when Stripe last redelivered the event.
      rows[existing] = { ...rows[existing], ...payment, created_at: rows[existing].created_at };
    }

    await writeAll(PAYMENTS, rows);
    return payment;
  });
}
