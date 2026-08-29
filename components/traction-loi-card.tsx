import type { Loi } from "@/lib/types";
import { stamp } from "./traction-math";
import { Pill } from "./ui";

/**
 * One signed letter of intent, rendered as the artefact it is.
 *
 * This gets screenshotted on a phone and pasted into a submission form, so it
 * has to read standalone: who signed, what they run, what they committed to,
 * and when the server recorded it. Type sizes here are deliberately larger
 * than the rest of the page for that reason.
 *
 * The signer's email is captured but deliberately not rendered. A screenshot
 * of this card travels further than the person expects when they hand back the
 * phone, and their address is the one field nobody judging needs to see.
 */
export default function TractionLoiCard({ loi, test = false }: { loi: Loi; test?: boolean }) {
  const where = [loi.role, loi.company].filter(Boolean).join(" · ");

  return (
    <article
      className={`flex flex-col rounded-xl border bg-surface p-5 sm:p-6 ${
        test ? "border-dashed border-warn-line" : "border-line"
      }`}
      style={test ? undefined : { boxShadow: "var(--shadow)" }}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[17px] leading-tight font-semibold tracking-[-0.01em]">
            {loi.full_name || "Unnamed signer"}
          </h3>
          {where ? <p className="mt-1 text-[13.5px] text-muted">{where}</p> : null}
        </div>
        {test ? <Pill tone="warn">Test mode</Pill> : <Pill tone="ok">Signed</Pill>}
      </header>

      <blockquote
        className={`mt-5 border-l-2 pl-4 text-[16px] leading-[1.6] text-muted ${
          test ? "border-warn-line" : "border-accent/40"
        }`}
      >
        Intends to <span className="font-medium text-ink">{loi.intent}</span>
        {loi.blocker ? (
          <>
            , once <span className="font-medium text-ink">{loi.blocker}</span>.
          </>
        ) : (
          "."
        )}
      </blockquote>

      <footer className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-5 text-[12px] text-faint">
        {loi.signed_name ? <span>Signed “{loi.signed_name}”</span> : null}
        <span className="h-3 w-px bg-line" />
        <span className="tnum">{stamp(loi.created_at)} Stockholm</span>
        {loi.source ? (
          <>
            <span className="h-3 w-px bg-line" />
            <span>via {loi.source}</span>
          </>
        ) : null}
      </footer>
    </article>
  );
}
