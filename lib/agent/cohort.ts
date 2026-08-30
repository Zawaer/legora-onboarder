/**
 * The other people starting at the same time.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS, STATED PLAINLY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This is coordination through shared state. Nothing else is happening.
 *
 * Both planners read the same hire ledger before they write. The second one to
 * run sees what the first one already wrote down — the way a second person
 * walking up to a whiteboard sees what the first person put on it. There is no
 * message passing, no negotiation, no protocol, and the two runs never overlap
 * in time on purpose. Nothing in this file may ever be named `negotiate`,
 * `handoff` or `agentChat`, because each of those words claims a conversation
 * that does not take place, and the whole position of this product is that it
 * does not claim more than it does.
 *
 * Two consequences of that, worth writing down rather than discovering:
 *
 *   • It is last-reader-informed, not conflict-free. Two derivations started in
 *     the same second both read a ledger that does not contain the other, and
 *     can still land on the same ticket. Fixing that needs a queue, which we
 *     have not built and should not pretend to have.
 *
 *   • The earlier hire's plan is never rewritten. All of the dividing falls on
 *     whoever is planned second. That is also how it works when a human hands
 *     work out, so it is not a surprise to a manager — but it does mean the
 *     order people are derived in is visible in the output.
 *
 * The file is deliberately free of anything server-only: it is imported by the
 * planner on the server AND by the manager screen in the browser, and it has no
 * business knowing about disks, keys or models.
 */

import type { HireState, RampPlan, RampTask } from "@/lib/types";

/** Every task on a plan, in day order. `undefined` plan means no claims. */
function planTasks(plan: RampPlan | undefined): RampTask[] {
  return (plan?.days ?? []).flatMap((d) => d.tasks ?? []);
}

/**
 * Still in their ramp.
 *
 * State, not a clock. A hire is ramping while anything on their plan is not
 * done. A date cutoff would have been easier and is wrong in both directions:
 * someone who cleared the plan on day one would keep occupying work for a
 * fortnight, and someone who stalled would drop off the list on exactly the day
 * the help mattered.
 *
 * Someone whose plan has not been built yet holds nothing, so there is nothing
 * to divide around them and they are absent here until it exists. That is the
 * concurrency hole named at the top of the file, and it is the honest shape of
 * it rather than a guess dressed up as a reservation.
 */
export function stillRamping(hire: HireState): boolean {
  const tasks = planTasks(hire.plan);
  if (tasks.length === 0) return false;
  return tasks.some((t) => hire.taskStatus?.[t.id] !== "done");
}

/**
 * One other current starter, as the planner needs to see them.
 *
 * Titles only, not the whole task. The planner needs to know what is taken and
 * roughly what it touches; it does not need — and should not be handed — the
 * other person's context, which is written for them and is nobody else's
 * reading. Keeping it to titles also keeps this block small enough that it does
 * not push the corpus out of the model's attention.
 */
export type CohortPeer = {
  name: string;
  roleTitle: string;
  /** The titles of every task already on their plan. Done or not: still theirs. */
  taskTitles: string[];
};

/**
 * Who else is mid-ramp at this company right now.
 *
 * `excludeHireId` is for the re-derive path, where a hire is being re-planned
 * and must not be told to avoid the work they themselves are currently holding.
 */
export function cohortPeers(
  hires: HireState[],
  opts: { companySlug: string; excludeHireId?: string },
): CohortPeer[] {
  return hires
    .filter(
      (h) =>
        h.companySlug === opts.companySlug &&
        h.id !== opts.excludeHireId &&
        stillRamping(h),
    )
    .map((h) => ({
      name: h.name,
      roleTitle: h.roleTitle,
      taskTitles: planTasks(h.plan).map((t) => t.title),
    }));
}

// ───────────────────────────────────────────── reading it back off the plans

/**
 * One place where a plan says out loud that it runs alongside another starter.
 *
 * Note what this type does not have and must never have: no score, no
 * closeness rating, no overlap percentage, no "who is ahead". It is a pointer
 * at a sentence the planner already wrote, and the sentence is the whole
 * payload. A cohort view is the single most natural place in this product to
 * smuggle a comparison of two people in, which is exactly why it is named,
 * shaped and typed to make that impossible to do by accident.
 */
export type AdjoiningScope = {
  /** Stable across refreshes: derived from the three ids, never generated. */
  id: string;
  hireId: string;
  hireName: string;
  taskId: string;
  taskTitle: string;
  otherHireId: string;
  otherHireName: string;
  /** The sentence from the task's own context, verbatim. Never paraphrased. */
  note: string;
};

/**
 * Find the sentences where one starter's plan names another.
 *
 * Read off the plans rather than recorded at planning time on purpose: the
 * acknowledgement is only real if it is in the text the hire actually reads. If
 * the planner did not write the sentence, there is nothing here to show, and a
 * manager seeing an empty section is being told the truth — not shown a badge
 * for a coordination that never made it into anyone's plan.
 *
 * Grouped by company, because two people onboarding at two different customers
 * have nothing to do with each other.
 */
/** Two hire rows that are the same human. */
function samePerson(a: HireState, b: HireState): boolean {
  if (a.personKey && b.personKey) return a.personKey === b.personKey;
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
}

export function findAdjoiningScope(hires: HireState[]): AdjoiningScope[] {
  const ramping = hires.filter(stillRamping);
  const found: AdjoiningScope[] = [];

  for (const hire of ramping) {
    const peers = ramping.filter(
      (h) =>
        h.id !== hire.id &&
        h.companySlug === hire.companySlug &&
        // Same human, second row. One person can end up with more than one hire
        // (a re-run, a role they renamed), and matching on id alone let a plan
        // "coordinate" with its own author: the manager view read "Maire ->
        // Maire", advising her to check with herself. `personKey` is the real
        // identity where we have it; the name is the fallback, and it is also
        // what the note itself says out loud, so it is the right thing to match.
        !samePerson(h, hire),
    );
    if (peers.length === 0) continue;

    for (const task of planTasks(hire.plan)) {
      for (const peer of peers) {
        const note = sentenceNaming(task.context, needlesFor(peer, ramping));
        if (!note) continue;
        found.push({
          id: `${hire.id}:${task.id}:${peer.id}`,
          hireId: hire.id,
          hireName: hire.name,
          taskId: task.id,
          taskTitle: task.title,
          otherHireId: peer.id,
          otherHireName: peer.name,
          note,
        });
      }
    }
  }

  return found.sort(
    (a, b) => a.hireName.localeCompare(b.hireName) || a.taskId.localeCompare(b.taskId),
  );
}

/**
 * What counts as naming this person.
 *
 * The full name always. The first name only when no other current starter at
 * any company on this board shares it — a plan that says "Anna" while two Annas
 * are ramping is ambiguous, and guessing which one it meant would put the wrong
 * name in front of a manager.
 *
 * Known limit: a first name that is also a colleague's on the roster can still
 * match. The roster is not reachable from here (this file is bundled to the
 * browser and holds no company data), the failure mode is one extra card rather
 * than a wrong claim, and the sentence shown is the planner's own words, so a
 * manager can see for themselves what it is about.
 */
function needlesFor(peer: HireState, everyone: HireState[]): string[] {
  const full = peer.name.trim();
  const first = full.split(/\s+/)[0] ?? "";
  const needles = [full];

  const sharedFirstName = everyone.some(
    (h) =>
      h.id !== peer.id &&
      (h.name.trim().split(/\s+/)[0] ?? "").toLowerCase() === first.toLowerCase(),
  );
  if (first.length >= 3 && first.toLowerCase() !== full.toLowerCase() && !sharedFirstName) {
    needles.push(first);
  }
  return needles;
}

/** Sentence boundaries. Crude and adequate: the input is prose we generated. */
const SENTENCE = /(?<=[.!?])\s+/;

function sentenceNaming(text: string | undefined, needles: string[]): string | undefined {
  if (!text) return undefined;
  for (const sentence of text.split(SENTENCE)) {
    if (needles.some((n) => namesWholeWord(sentence, n))) return sentence.trim();
  }
  return undefined;
}

/**
 * Whole-word containment. "Anna" must not match inside "Annapurna", but
 * "Anna's" and "(Anna)" must both count.
 */
function namesWholeWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const hay = haystack.toLowerCase();
  const hit = needle.toLowerCase();
  let from = 0;
  for (;;) {
    const i = hay.indexOf(hit, from);
    if (i < 0) return false;
    if (!isWordChar(hay[i - 1]) && !isWordChar(hay[i + hit.length])) return true;
    from = i + 1;
  }
}

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
}
