/**
 * The shared contract. Every other module builds against these types.
 *
 * The domain model encodes the thesis: a role that has never existed cannot be
 * looked up, only *derived* — so `DerivedRole` is an output of the agent, never
 * an input to it. Everything downstream (the ramp plan, the first task, the
 * blockers) hangs off that derivation.
 */

// ─────────────────────────────────────────────── the company's raw material

/**
 * One piece of evidence about how the company actually works: a Slack message,
 * a doc, a ticket, a meeting note.
 *
 * This is deliberately the *only* input the agent gets about a company. No job
 * descriptions, no onboarding checklists, no role templates — because at a
 * company inventing roles as it hires for them, none of those exist. If the
 * agent can work from this, it can work on day one at a real customer.
 */
export type Artifact = {
  id: string;
  kind: "slack" | "doc" | "ticket" | "meeting";
  /** Slack channel or doc location, e.g. "#eng-legal-engineering". */
  channel?: string;
  author: string;
  authorRole?: string;
  /** ISO 8601. */
  timestamp: string;
  title?: string;
  text: string;
};

export type Person = {
  name: string;
  role: string;
  team: string;
  /** What this person is the go-to for. Drives who a blocker escalates to. */
  owns: string[];
  slackHandle: string;
};

export type Company = {
  slug: string;
  name: string;
  /** One paragraph of public context — what the company sells, how fast it is growing. */
  description: string;
  people: Person[];
  artifacts: Artifact[];
};

// ─────────────────────────────────────────────────── what the agent derives

/**
 * A citation back to a specific artifact.
 *
 * Every claim the agent makes about a role has to point at the message or doc
 * it came from. Without this the output is a plausible-sounding job description
 * the model invented, which is exactly the failure a hiring manager will catch
 * in ten seconds — and the demo dies in front of the judges.
 */
export type Evidence = {
  artifactId: string;
  /** Verbatim substring of the artifact's text. Verified, not trusted. */
  quote: string;
  /** Why this passage tells us something about the role. */
  why: string;
};

/** The role, reconstructed from what the team is actually doing. */
export type DerivedRole = {
  title: string;
  /** What this role actually is, in two or three sentences. */
  summary: string;
  evidence: Evidence[];
  responsibilities: string[];
  /** What "ramped" looks like — the outcomes, not the reading list. */
  firstWeekOutcomes: string[];
  keyPeople: { name: string; why: string }[];
  /**
   * What the agent could NOT determine from the corpus.
   *
   * Kept as a first-class field because the honest answer is often "the company
   * has not decided this yet" — and surfacing that to the manager is genuinely
   * useful, where inventing an answer is actively harmful.
   */
  openQuestions: string[];
};

// ──────────────────────────────────────────────────────────── the ramp plan

export type RampTask = {
  id: string;
  title: string;
  /** Why this matters, grounded in company context — not generic filler. */
  why: string;
  /** What they need to know to actually do it without asking anyone. */
  context: string;
  doneWhen: string;
  /** Who to ask if genuinely stuck. Populated from `Company.people`. */
  askIfStuck: string;
  estimateMins: number;
};

export type RampDay = {
  day: 1 | 2;
  theme: string;
  tasks: RampTask[];
};

export type RampPlan = {
  role: string;
  days: RampDay[];
};

// ──────────────────────────────────────────────────── the supervision loop

export type TaskStatus = "not_started" | "in_progress" | "done" | "blocked";

export type ChatMessage = {
  id: string;
  role: "agent" | "hire";
  text: string;
  /** ISO 8601. */
  at: string;
  taskId?: string;
};

/**
 * Something in the new hire's way.
 *
 * Note what is deliberately absent: any score, percentage, or ranking of the
 * person. The manager screen shows blockers, never productivity — a tool that
 * reads as surveillance gets killed by the culture it is sold into, and the
 * customers we are building for say explicitly that they hire for ownership.
 */
export type Blocker = {
  id: string;
  hireId: string;
  taskId?: string;
  summary: string;
  /** ISO 8601. */
  raisedAt: string;
  /**
   * True only when the agent genuinely could not resolve it from company
   * context. This flag is the product: "tell me only when I'm actually needed".
   */
  needsHuman: boolean;
  suggestedPerson?: string;
  /** Honest estimate of how much of a human's time this costs. */
  minutesToUnblock?: number;
  resolved: boolean;
};

export type HireState = {
  id: string;
  name: string;
  roleTitle: string;
  companySlug: string;
  /** ISO 8601. */
  startedAt: string;
  derivedRole?: DerivedRole;
  plan?: RampPlan;
  taskStatus: Record<string, TaskStatus>;
  messages: ChatMessage[];
  blockers: Blocker[];
};

// ────────────────────────────────────────────────────── traction capture

/** A signed letter of intent. The 12-point traction band. */
export type Loi = {
  id: string;
  full_name: string;
  role: string;
  company: string;
  intent: string;
  blocker: string;
  email: string;
  signed_name: string;
  source: string;
  /** Server-side timestamp — never trusted from the client. */
  created_at: string;
  /** Whether the deployment was taking real money when this was signed. */
  livemode: boolean;
};

/** A completed Stripe checkout. The 18-point traction band. */
export type Payment = {
  stripe_session_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string;
  mode: string;
  source: string;
  /** Stripe's own flag — the one source of truth for real money vs a test card. */
  livemode: boolean;
  status: string;
  amount_total: number | null;
  currency: string | null;
  created_at: string;
};
