/**
 * POST /api/chat — one turn of supervision.
 *
 * Appends the hire's message, asks the agent, then applies whatever the agent
 * decided: a reply, possibly a task status change, possibly a blocker. The
 * blocker is the interesting one — most turns should not produce one, and a
 * version of this that escalates on every uncertainty has quietly broken the
 * only promise the product makes.
 */

import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { loadCompany } from "@/lib/agent/knowledge";
import { currentTask, isDuplicateBlocker, respond } from "@/lib/agent/supervise";
import { getHire, updateHire } from "@/lib/agent/hires";
import { recordResolution } from "@/lib/agent/resolutions";
import { toApiError } from "@/lib/anthropic";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Turns measured 20-37 seconds, so 60 was cutting it closer than it looked:
 * the drift check runs concurrently, and a slow upstream on both calls at once
 * lands uncomfortably near the ceiling. `next dev` does not enforce this, so a
 * breach would first appear on the deployed URL, mid-demo.
 */
export const maxDuration = 120;

const Body = z.object({
  hireId: z.string().min(1),
  text: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { hireId, text } = parsed.data;

  const hire = await getHire(hireId);
  if (!hire) return NextResponse.json({ error: "Unknown hire." }, { status: 404 });

  // Same resolution as /api/derive: seeded, then ingested, then everything the
  // agent has elicited from the team and had confirmed. A hire created from an
  // ingested corpus has to be supervisable, or ingest produces a workspace whose
  // chat is dead — and the elicited layer is what closes the loop, because it
  // means a question that was escalated to a human last week is answered from
  // the corpus this week, with a citation, like anything else.
  const company = await loadCompany(hire.companySlug);
  if (!company) {
    return NextResponse.json(
      { error: `Hire references company "${hire.companySlug}", which is neither seeded nor ingested.` },
      { status: 409 },
    );
  }

  // Started before the model call, not inside it: the number that matters to a
  // hire is how long they sat there, which includes the web rung's classifier
  // and search hop when those run.
  const startedAt = Date.now();

  try {
    // The model sees the state as it was when the hire spoke, so the incoming
    // message is not folded into history before the call.
    const result = await respond(hire, company, text);
    const task = currentTask(hire);

    // The hire's own message id is the question id, so a record can always be
    // traced back to the exact words that produced it.
    const questionId = randomUUID();

    const updated = await updateHire(hireId, (h) => {
      const hireMessage: ChatMessage = {
        id: questionId,
        role: "hire",
        text,
        at: new Date().toISOString(),
        taskId: task?.id,
      };
      const agentMessage: ChatMessage = {
        id: randomUUID(),
        role: "agent",
        text: result.reply,
        at: new Date().toISOString(),
        taskId: task?.id,
      };

      // Deduped against the state as it is inside the lock, not the snapshot the
      // model saw. That covers both a turn that simply restates a still-open
      // obstacle and two turns landing together, neither of which can see the
      // other's blocker.
      const isNew = result.blocker != null && !isDuplicateBlocker(h.blockers, result.blocker);

      let blockers = isNew && result.blocker ? [...h.blockers, result.blocker] : h.blockers;

      // A drift note that needed a human arrives as an ordinary Blocker, so it
      // goes through the SAME dedupe — against the list including anything this
      // turn just added, not the snapshot before it. Nothing downstream has to
      // know where it came from.
      if (result.driftBlocker && !isDuplicateBlocker(blockers, result.driftBlocker)) {
        blockers = [...blockers, result.driftBlocker];
      }

      return {
        ...h,
        messages: [...h.messages, hireMessage, agentMessage],
        taskStatus:
          result.taskStatus && task ? { ...h.taskStatus, [task.id]: result.taskStatus } : h.taskStatus,
        blockers,
        // Kept so the next turn's drift check can see what has already been said
        // to this person and not say it again.
        driftNotes: result.drift ? [...(h.driftNotes ?? []), result.drift] : h.driftNotes,
      };
    });

    if (!updated) return NextResponse.json({ error: "Unknown hire." }, { status: 404 });

    // Counted after the turn is safely stored, and awaited rather than
    // fire-and-forget: on a serverless runtime the response ends the instance,
    // and a record written into a dead process is a number that is quietly
    // wrong. `recordResolution` is documented never to throw, so this cannot
    // cost the hire their answer.
    await recordResolution({
      questionId,
      hireId,
      companySlug: hire.companySlug,
      classification: result.resolution.classification,
      confidence: result.resolution.confidence,
      resolvedBy: result.resolution.resolvedBy,
      latencyMs: Date.now() - startedAt,
      at: new Date().toISOString(),
    });

    // Only report a blocker the caller can actually find on the hire — saying we
    // raised one that was deduped away is the same class of lie as a spinner
    // over a disk read.
    const raised =
      result.blocker && updated.blockers.some((b) => b.id === result.blocker?.id)
        ? result.blocker
        : null;

    return NextResponse.json(
      // `drift` is additive and usually absent. The hire has already read it —
      // it is appended to `reply` — so this is for callers that want it as data
      // rather than prose.
      { hire: updated, reply: result.reply, blocker: raised, drift: result.drift ?? null },
      { status: 200 },
    );
  } catch (err) {
    const { status, message } = toApiError(err);
    console.error("[chat]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
