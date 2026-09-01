/**
 * The durable half of the waitlist: filesystem and webhook.
 *
 * Split out of lib/waitlist.ts because that file is imported by a client
 * component for the booking URL and the count, and pulling node:fs into the
 * browser bundle fails the build outright. Server-only code lives here and is
 * imported by the route alone.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { isKvConfigured, kvAppend } from "@/lib/kv";
import { isNotifyConfigured, notify, notifyUrl } from "@/lib/notify";

export type Signup = {
  email: string;
  company?: string;
  at: string;
  source?: string;
};

const FILE = path.join(process.cwd(), "data", "waitlist.json");

/**
 * Is anything durable configured? Never returns the URL itself — a webhook is a
 * credential, and the only question worth answering from outside is whether one
 * is present. Exists so a 503 can be told apart from a misconfiguration without
 * reading the deployment's environment.
 */
export function waitlistSinkStatus(): { webhook: boolean; host: string | null } {
  const url = notifyUrl();
  if (!isNotifyConfigured() || !url) return { webhook: false, host: null };
  try {
    return { webhook: true, host: new URL(url).host };
  } catch {
    return { webhook: true, host: "invalid-url" };
  }
}


/**
 * Post to whatever is on the other end of WAITLIST_WEBHOOK_URL. Shaped as a
 * Slack incoming webhook payload, which is the fastest durable sink to stand up
 * and the one place the team is already looking — but any endpoint that accepts
 * JSON works, because `email` and `company` are sent as plain fields too.
 */
async function toWebhook(signup: Signup): Promise<boolean> {
  return notify(
    `*New waitlist signup*\n${signup.email}` +
      (signup.company ? `\n${signup.company}` : "") +
      (signup.source ? `\n_via ${signup.source}_` : ""),
    { kind: "waitlist", ...signup },
  );
}

/**
 * Postgres, via the kv store.
 *
 * The webhook put every signup in Slack, which is where the team looks but not
 * something you can query, dedupe or export — the first four days of signups
 * exist only as chat messages. Disk is ephemeral on Vercel. Neither is a list.
 *
 * Uses the same `store:` key convention as lib/store.ts, so a signup lands
 * beside the letters of intent rather than in a table of its own.
 */
async function toStore(signup: Signup): Promise<boolean> {
  if (!isKvConfigured()) return false;
  return kvAppend("store:waitlist", signup);
}

/** Local development, where the disk is real and durable. */
async function toDisk(signup: Signup): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    let rows: Signup[] = [];
    try {
      rows = JSON.parse(await fs.readFile(FILE, "utf8")) as Signup[];
    } catch {
      // First signup, or the file is unreadable. Either way we start a new list.
    }
    rows.push(signup);
    await fs.writeFile(FILE, JSON.stringify(rows, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns false when nothing durable took it. The caller must surface that to
 * the visitor rather than thanking them for an address we did not keep.
 */
export async function recordSignup(signup: Signup): Promise<boolean> {
  const [store, webhook, disk] = await Promise.all([
    toStore(signup),
    toWebhook(signup),
    toDisk(signup),
  ]);

  // Logged either way. On Vercel this is the last line of defence: the address
  // is at least readable in the deployment logs for as long as they are kept.
  console.log(
    `[waitlist] ${signup.email}${signup.company ? ` · ${signup.company}` : ""} ` +
      `· store=${store} webhook=${webhook} disk=${disk}`,
  );

  return store || webhook || disk;
}
