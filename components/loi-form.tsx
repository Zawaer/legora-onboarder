"use client";

import { useState } from "react";

/**
 * Letter of intent, signed on a phone in ninety seconds.
 *
 * The fallback when a buyer wants it but genuinely cannot pay this weekend —
 * procurement, a security review, a budget that opens next quarter. Ask for
 * the payment first, always: lead with the LOI and a possible customer becomes
 * a definite non-customer.
 *
 * On submit it renders the signed statement with a server timestamp, which is
 * the thing to screenshot. The submission form takes a handful of images and
 * assembling them at 09:40 on Sunday is not a plan.
 */

type Signed = {
  full_name: string;
  role: string;
  company: string;
  intent: string;
  blocker: string;
  email: string;
  signed_name: string;
  created_at: string;
};

const EMPTY = {
  full_name: "",
  role: "",
  company: "",
  intent: "",
  blocker: "",
  email: "",
  signed_name: "",
};

const inputClass =
 "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-ink";

const labelClass = "text-sm font-medium text-ink";

export function LoiForm({
  product,
  source = "room",
}: {
  product: string;
  source?: string;
}) {
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState<Signed | null>(null);

  function field(name: keyof typeof EMPTY) {
    return {
      id: name,
      name,
      value: form[name],
      className: inputClass,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [name]: e.target.value })),
    };
  }

  async function sign(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);

    try {
      const res = await fetch("/api/loi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "could not save");

      setSigned({ ...form, created_at: body.created_at });
    } catch (err) {
      console.error(err);
      setState("idle");
      // Inline rather than a toast: they are standing next to us and the
      // recovery is "press it again", which needs the message to stay put.
      setError("Something broke. Try again?");
    }
  }

  if (signed) return <SignedLoi loi={signed} product={product} />;

  return (
    <form onSubmit={sign} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="full_name" className={labelClass}>
          Your name
        </label>
        <input {...field("full_name")} required autoComplete="name" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="role" className={labelClass}>
            Role
          </label>
          <input
            {...field("role")}
            placeholder="Head of People, Hiring Manager…"
            autoComplete="organization-title"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="company" className={labelClass}>
            Company
          </label>
          <input {...field("company")} autoComplete="organization" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="intent" className={labelClass}>
          I intend to…
        </label>
        <input
          {...field("intent")}
          required
          placeholder="run a paid pilot with our next onboarding cohort"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="blocker" className={labelClass}>
          …once
        </label>
        {/* Specificity is the whole value of an LOI. "This looks cool" is
            worth nothing; "once it connects to our Slack workspace" is worth a
            point band and tells us what to build next. */}
        <textarea
          {...field("blocker")}
          rows={3}
          placeholder="it connects to our Slack workspace / security review clears"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className={labelClass}>
          Work email
        </label>
        <input {...field("email")} type="email" required autoComplete="email" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="signed_name" className={labelClass}>
          Type your full name to sign
        </label>
        <input {...field("signed_name")} required />
      </div>

      <p className="text-xs text-faint">
        This is a statement of intent, not a binding contract.
      </p>

      {error ? (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-lg bg-ink px-5 py-3 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {state === "sending" ? "Signing…" : "Sign"}
      </button>
    </form>
  );
}

/**
 * The artefact — and the actual deliverable of this whole file.
 *
 * OPERATOR: screenshot this screen the moment it appears, before handing the
 * phone back. This render *is* the proof that goes into the submission form;
 * the row on disk is only our copy. It cannot be reproduced later — the form
 * resets, and re-signing would stamp a new server time.
 */
function SignedLoi({ loi, product }: { loi: Signed; product: string }) {
  const date = new Date(loi.created_at);
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);

  const at = [loi.role, loi.company].filter(Boolean).join(" at ");

  return (
    <div className="flex w-full flex-col gap-5 rounded-xl border border-line bg-surface p-6">
      <h2 className="text-sm font-medium uppercase tracking-widest text-faint">
        Letter of intent
      </h2>

      <p className="text-pretty leading-relaxed text-ink">
        I, <strong>{loi.full_name}</strong>
        {at ? <>, {at},</> : ","} have used <strong>{product}</strong> on{" "}
        {new Intl.DateTimeFormat("sv-SE", { dateStyle: "long" }).format(date)}.
      </p>

      <p className="text-pretty leading-relaxed text-ink">
        I intend to <strong>{loi.intent}</strong>
        {loi.blocker ? (
          <>
            {" "}
            once <strong>{loi.blocker}</strong> is in place
          </>
        ) : null}
        .
      </p>

      <p className="text-sm text-faint">
        This is a statement of intent, not a binding contract.
      </p>

      <div className="flex flex-col gap-1 border-t border-line pt-4 text-sm text-ink">
        <span>
          Signed: <strong>{loi.signed_name}</strong>
        </span>
        <span className="text-muted">{loi.email}</span>
        {/* Server clock, rendered verbatim. This line is why the screenshot is
            evidence rather than a claim. */}
        <span className="font-mono text-xs text-faint">
          {stamp}
        </span>
      </div>
    </div>
  );
}
