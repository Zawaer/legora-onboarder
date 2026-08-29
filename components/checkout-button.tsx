"use client";

import { useState } from "react";
import type { PlanId } from "@/lib/stripe";

/**
 * Always pass `source` where the page knows it. Without it every purchase off
 * the landing page is attributed to "landing", so someone who arrived from a
 * LinkedIn post and paid looks identical to someone who typed the URL — and
 * the channel breakdown quietly stops being evidence of anything.
 */
export function CheckoutButton({
  plan = "pro",
  source,
  children = "Start a pilot",
  className,
}: {
  plan?: PlanId;
  source?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, source }),
      });
      const { url, error: message } = await res.json();
      if (!url) throw new Error(message ?? "no checkout url");
      window.location.href = url;
    } catch (err) {
      console.error(err);
      // Inline, next to the button they just pressed. A toast that fades is
      // the wrong shape for "the thing you tried to buy did not open".
      setError("Could not start checkout. Try again?");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={checkout}
        disabled={loading}
        className={
          className ??
          "rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        }
      >
        {loading ? "Redirecting…" : children}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
