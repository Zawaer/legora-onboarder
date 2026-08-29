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
import { getCompany } from "@/lib/seed";
import { currentTask, respond } from "@/lib/agent/supervise";
import { getHire, updateHire } from "@/lib/agent/hires";
import { toApiError } from "@/lib/anthropic";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const company = getCompany(hire.companySlug);
  if (!company) {
    return NextResponse.json(
      { error: `Hire references company "${hire.companySlug}", which is not seeded.` },
      { status: 409 },
    );
  }

  try {
    // The model sees the state as it was when the hire spoke, so the incoming
    // message is not folded into history before the call.
    const result = await respond(hire, company, text);
    const task = currentTask(hire);

    const updated = await updateHire(hireId, (h) => {
      const hireMessage: ChatMessage = {
        id: randomUUID(),
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

      return {
        ...h,
        messages: [...h.messages, hireMessage, agentMessage],
        taskStatus:
          result.taskStatus && task ? { ...h.taskStatus, [task.id]: result.taskStatus } : h.taskStatus,
        blockers: result.blocker ? [...h.blockers, result.blocker] : h.blockers,
      };
    });

    if (!updated) return NextResponse.json({ error: "Unknown hire." }, { status: 404 });

    return NextResponse.json(
      { hire: updated, reply: result.reply, blocker: result.blocker ?? null },
      { status: 200 },
    );
  } catch (err) {
    const { status, message } = toApiError(err);
    console.error("[chat]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
