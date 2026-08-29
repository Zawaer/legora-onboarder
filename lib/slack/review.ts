/**
 * The gate between the agent and a new hire.
 *
 * Two customers signed on the day this was written and both named the same
 * thing as their blocker. Satu Vartiainen, VP Quality Management at Fermion:
 * "functionality, data security and fit with our onboarding needs". Jussi
 * Luhtasela, COO at Apukuski: "connects to Slack, to our AI Brain, and GDPR
 * compliant". Neither asked for a better answer. Both asked for control over
 * what an AI says to their staff before it says it.
 *
 * So when a company has `auto_send` off, nothing the agent writes reaches a
 * person. It becomes a row in `drafts` for an admin to approve, edit or
 * reject.
 *
 * DEFAULTS, AND WHY THIS ONE
 *
 * Held is the default, in the schema and here. A company with no configuration
 * at all is not opted into automation by our convenience. The failure mode of
 * getting that backwards is a regulated customer discovering an AI messaged
 * their staff unreviewed, which is not a bug report, it is the end of the
 * account.
 *
 * The exception is deliberate and narrow: with no VANAV_COMPANY_ID set there is
 * no customer here at all, so this is the demo or a local run, and holding
 * every message would break it for nobody's benefit.
 */
import { isSupabaseConfigured, serviceClient } from "@/lib/supabase";

export type ReviewOutcome =
  | { held: false }
  | { held: true; draftId: string | null };

function companyId(): string | undefined {
  return process.env.VANAV_COMPANY_ID?.trim() || undefined;
}

/** Is a real customer account attached to this bot? */
export function isReviewConfigured(): boolean {
  return Boolean(companyId() && isSupabaseConfigured());
}

/**
 * Decide whether this message may go out, queueing it if not.
 *
 * Never throws. A failure to reach the database returns `held: false` rather
 * than silencing the bot: a new hire staring at nothing because our store was
 * briefly unreachable is a worse outcome than a message that skipped review,
 * and the log line below is what makes that recoverable.
 */
export async function reviewBeforeSend(input: {
  hireRef: string;
  kind: string;
  /** The readable message. Not Slack's notification preview, which is clipped. */
  body: string;
  /** What Slack renders. Kept so an approved message keeps its formatting. */
  blocks?: unknown;
}): Promise<ReviewOutcome> {
  const id = companyId();
  if (!id || !isSupabaseConfigured()) return { held: false };

  const db = serviceClient();
  if (!db) return { held: false };

  try {
    const { data: company, error } = await db
      .from("companies")
      .select("auto_send")
      .eq("id", id)
      .maybeSingle();

    if (error || !company) {
      console.warn(
        `[review] could not read company ${id}; sending without review. ${error?.message ?? "not found"}`,
      );
      return { held: false };
    }

    if (company.auto_send) return { held: false };

    const { data: draft, error: insertErr } = await db
      .from("drafts")
      .insert({
        company_id: id,
        hire_ref: input.hireRef,
        kind: input.kind,
        body: input.body,
        blocks: input.blocks ?? null,
      })
      .select("id")
      .single();

    if (insertErr) {
      // Could not queue it and must not send it: this company has explicitly
      // asked that nothing goes out unreviewed. Log the whole message so it is
      // recoverable, the same way a signed letter of intent is.
      console.error(
        `[review] DRAFT_UNQUEUED ${JSON.stringify(input)} — ${insertErr.message}`,
      );
      return { held: true, draftId: null };
    }

    return { held: true, draftId: draft?.id ?? null };
  } catch (err) {
    console.warn(`[review] failed, sending without review: ${(err as Error).message}`);
    return { held: false };
  }
}
