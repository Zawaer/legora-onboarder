import Link from "next/link";
import { KNOWN_SOURCES } from "@/lib/source";
import type { Loi, Payment } from "@/lib/types";
import SiteHeader, { NavLink } from "./site-header";
import TractionLoiCard from "./traction-loi-card";
import { type Band, formatMoney, stamp, summarise } from "./traction-math";
import { Label, Pill } from "./ui";

/** What each band means, in the four words a judge needs. */
const BAND_NAME: Record<Band, string> = {
  0: "nothing captured yet",
  6: "demand signal captured",
  12: "paying customer + LOIs",
  18: "three paying customers",
};

export default function TractionBoard({
  payments,
  lois,
  keysAreLive,
  renderedAt,
}: {
  payments: Payment[];
  lois: Loi[];
  /** From `isLiveMode()` — whether this deployment is running on live Stripe keys. */
  keysAreLive: boolean;
  renderedAt: string;
}) {
  const s = summarise(payments, lois);
  const nothingYet = s.totalRecords === 0;
  const { channels } = s;

  const basisNoun =
    channels.basis === "revenue" ? "revenue" : channels.basis === "customers" ? "customers" : "signed intent";

  return (
    <div className="min-h-dvh">
      <SiteHeader
        right={
          <>
            <NavLink href="/manager">Manager view</NavLink>
            <NavLink href="/loi">Letter of intent</NavLink>
            <NavLink href="/pay" emphasis>
              Pricing
            </NavLink>
          </>
        }
      />

      <main className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8 lg:py-14">
        {/* ── the claim ── */}
        <header className="flex flex-col gap-5 border-b border-line pb-9">
          <Label>Traction · live evidence</Label>
          <h1 className="max-w-[20ch] text-[32px] leading-[1.08] font-semibold tracking-[-0.028em] text-balance sm:text-[40px]">
            Every number here is a Stripe record or a signed name.
          </h1>
          <p className="max-w-[72ch] text-[15.5px] leading-[1.65] text-muted">
            Traction is 18 of 50 points. This page reads the payment and letter-of-intent
            stores on every request — nothing is typed in by hand, nothing is cached, and
            nothing is rounded up. Stripe test-mode records are listed in full at the
            bottom and counted nowhere above.
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-faint">
            <span className="inline-flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${keysAreLive ? "bg-ok" : "bg-warn"}`} />
              {keysAreLive
                ? "Stripe live keys — anything captured now counts"
                : "Stripe test keys — anything captured now is recorded as test"}
            </span>
            <span className="hidden h-3 w-px bg-line sm:block" />
            <span className="tnum">
              {s.totalRecords} {s.totalRecords === 1 ? "record" : "records"} on disk
            </span>
            <span className="hidden h-3 w-px bg-line sm:block" />
            <span className="tnum">read {stamp(renderedAt)}</span>
          </div>
        </header>

        {/*
          The test-mode banner sits ABOVE the headline numbers on purpose. Read
          in order, nobody reaches a figure on this page without first being
          told what is excluded from it — including us, at 4am, screenshotting
          our own dashboard.
        */}
        {s.hasTestRecords ? (
          <div className="mt-8 flex gap-3.5 rounded-xl border border-warn-line bg-warn-soft px-5 py-4">
            <svg viewBox="0 0 20 20" aria-hidden className="mt-0.5 h-4 w-4 shrink-0">
              <path
                d="M10 2.8 18 17H2L10 2.8Z"
                className="stroke-warn"
                strokeWidth="1.5"
                fill="none"
                strokeLinejoin="round"
              />
              <path d="M10 8v4" className="stroke-warn" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="10" cy="14.4" r="0.9" className="fill-warn" />
            </svg>
            <div className="min-w-0">
              <p className="text-[14px] leading-snug font-semibold text-warn">
                {s.test.payments.length + s.test.lois.length} of {s.totalRecords} records are
                Stripe test mode. They are not traction and are excluded from every number
                above.
              </p>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-warn/85">
                {s.test.payments.length > 0
                  ? `That includes ${s.test.payments.length} test ${
                      s.test.payments.length === 1 ? "payment" : "payments"
                    } worth ${s.testRevenue
                      .map((m) => formatMoney(m.amount, m.currency))
                      .join(" + ")} of fake money. `
                  : ""}
                Every record is listed at the bottom of this page so the split can be
                checked rather than trusted.
              </p>
            </div>
          </div>
        ) : null}

        {/* ── the headline numbers ── */}
        <section className="mt-8">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
            <Stat
              label="Paying customers"
              value={String(s.payingCustomers)}
              note={
                s.live.pending.length > 0
                  ? `distinct, live mode · ${s.live.pending.length} started but unpaid, not counted`
                  : "distinct Stripe customers, live mode"
              }
            />
            <Stat
              label="Revenue collected"
              value={
                s.revenue.length > 0
                  ? s.revenue.map((m) => formatMoney(m.amount, m.currency)).join(" + ")
                  : formatMoney(0)
              }
              note="captured at checkout · renewals not re-counted"
            />
            <Stat
              label="Signed LOIs"
              value={String(s.loiCount)}
              note="server-timestamped signatures, live mode"
            />
            <Stat
              label="Traction band"
              value={
                <>
                  {s.band}
                  <span className="text-faint"> / 18</span>
                </>
              }
              note={BAND_NAME[s.band]}
              accent
            />
          </div>
        </section>

        {/* ── the rubric, and the exact gap to the next rung ── */}
        <section className="border-b border-line py-10">
          <Label>Rubric</Label>
          <h2 className="mt-3 text-[19px] font-semibold tracking-[-0.02em]">
            Where the 18 points actually sit
          </h2>

          <ol className="mt-5 flex flex-col gap-px overflow-hidden rounded-xl border border-line bg-line">
            {s.ladder.map((rung) => (
              <li
                key={rung.band}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5 ${
                  rung.band === s.band ? "bg-accent-soft" : "bg-surface"
                }`}
              >
                <span
                  className={`tnum grid h-7 w-11 shrink-0 place-items-center rounded-md border text-[12.5px] font-semibold ${
                    rung.band === s.band
                      ? "border-transparent bg-accent text-paper"
                      : rung.met
                        ? "border-line bg-surface-2 text-muted"
                        : "border-line bg-surface-2 text-faint"
                  }`}
                >
                  {rung.band}
                </span>
                <span
                  className={`min-w-0 flex-1 text-[13.5px] leading-snug ${
                    rung.met ? "text-ink" : "text-muted"
                  }`}
                >
                  {rung.criterion}
                </span>
                {rung.band === 0 ? (
                  <span className="text-[12px] text-faint">baseline</span>
                ) : rung.met ? (
                  <Pill tone="ok">met</Pill>
                ) : (
                  <span className="text-[12.5px] font-medium text-warn">
                    needs {rung.remaining.join(" and ")}
                  </span>
                )}
              </li>
            ))}
          </ol>

          {s.next ? (
            <div className="mt-5 rounded-xl border border-accent/25 bg-accent-soft px-5 py-5 sm:px-6">
              <Label>Still outstanding</Label>
              <p className="mt-2.5 text-[21px] leading-[1.25] font-semibold tracking-[-0.02em] text-balance text-accent-ink sm:text-[25px]">
                {s.next.remaining.join(" and ")} for {s.next.band} / 18.
              </p>
              {/* With nothing captured at all, the empty block below carries the
                  same two links — one pair of buttons, not two. */}
              {nothingYet ? null : (
                <>
                  <p className="mt-2.5 max-w-[62ch] text-[13.5px] leading-[1.6] text-muted">
                    Nothing else on this page moves the score. Both links below carry
                    <code className="mx-1 font-mono text-[12.5px]">?source=room</code>
                    so whatever comes back is attributed to the channel it came from.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href="/pay?source=room"
                      className="inline-flex h-9 items-center rounded-lg bg-ink px-4 text-[13.5px] font-medium text-paper hover:opacity-90"
                    >
                      Take a payment
                    </Link>
                    <Link
                      href="/loi?source=room"
                      className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-4 text-[13.5px] font-medium hover:border-line-strong"
                    >
                      Get an LOI signed
                    </Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-ok-line bg-ok-soft px-5 py-5 sm:px-6">
              <Label>Top band</Label>
              <p className="mt-2.5 text-[21px] leading-[1.25] font-semibold tracking-[-0.02em] text-ok sm:text-[25px]">
                18 / 18. {s.payingCustomers} paying customers, all verifiable in Stripe.
              </p>
            </div>
          )}
        </section>

        {/* ── nothing captured at all: say what to go and get ── */}
        {nothingYet ? (
          <section className="py-10">
            <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
              <p className="text-[17px] font-medium">No evidence captured yet.</p>
              <p className="mx-auto mt-2.5 max-w-[54ch] text-[14px] leading-[1.65] text-muted">
                Two things fill this page, and only these two. A completed Stripe checkout
                writes a payment; a signature on the LOI form writes a letter of intent with
                a server timestamp on it. Open one of these, turn the laptop round, and
                reload.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link
                  href="/pay?source=room"
                  className="inline-flex h-10 items-center rounded-lg bg-ink px-5 text-[14px] font-medium text-paper hover:opacity-90"
                >
                  Take a payment
                </Link>
                <Link
                  href="/loi?source=room"
                  className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-5 text-[14px] font-medium hover:border-line-strong"
                >
                  Get an LOI signed
                </Link>
              </div>
              <p className="mx-auto mt-7 max-w-[58ch] text-[12.5px] leading-[1.6] text-faint">
                Attribution rides on the link. Append{" "}
                <code className="font-mono">?source=</code> to either URL —{" "}
                {KNOWN_SOURCES.join(", ")} — and this page can then say which channel
                produced the money.
              </p>
            </div>
          </section>
        ) : (
          <>
            {/* ── channel attribution ── */}
            <section className="border-b border-line py-10">
              <Label>Attribution</Label>
              <h2 className="mt-3 text-[19px] font-semibold tracking-[-0.02em]">
                Which channel produced it
              </h2>
              <p className="mt-2.5 max-w-[72ch] text-[14px] leading-[1.65] text-muted">
                “Three customers” is a traction claim. “Three customers, all from one
                afternoon in the room” is evidence we can do it again — which is the thing
                actually being scored. Every link we hand out carries{" "}
                <code className="font-mono text-[13px]">?source=</code>, and it survives all
                the way into the Stripe metadata.
              </p>

              {channels.rows.length > 0 ? (
                <>
                  <div className="mt-6 flex flex-col gap-4">
                    {channels.rows.map((row) => {
                      const detail = [
                        row.customers > 0
                          ? `${row.customers} paying ${row.customers === 1 ? "customer" : "customers"}`
                          : null,
                        row.lois > 0
                          ? `${row.lois} signed ${row.lois === 1 ? "LOI" : "LOIs"}`
                          : null,
                        row.share > 0 ? `${Math.round(row.share)}% of ${basisNoun}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <div key={row.source}>
                          <div className="flex items-baseline justify-between gap-4">
                            <span className="truncate text-[14px] font-medium">{row.source}</span>
                            <span className="tnum shrink-0 text-[13.5px] font-medium">
                              {channels.basis === "revenue"
                                ? // A channel that produced intent but no money reads better
                                  // as a dash than as a hard "0 kr" verdict against it.
                                  row.revenue > 0
                                  ? formatMoney(row.revenue, row.currency)
                                  : "—"
                                : channels.basis === "customers"
                                  ? `${row.customers} paid`
                                  : `${row.lois} signed`}
                            </span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${Math.max(row.width, row.value > 0 ? 3 : 0)}%` }}
                            />
                          </div>
                          {detail ? (
                            <p className="tnum mt-1.5 text-[12px] text-faint">{detail}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {channels.basis !== "revenue" ? (
                    <p className="mt-5 text-[12.5px] leading-[1.6] text-faint">
                      {channels.basis === "customers"
                        ? "Bars measure customers, not money: payments span more than one currency and adding minor units across currencies would be arithmetic on incompatible numbers."
                        : "Bars measure signed intent — no live revenue has landed yet, so there is no money to split."}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-6 rounded-xl border border-dashed border-line bg-surface px-5 py-8 text-center text-[13.5px] leading-[1.65] text-muted">
                  No live-mode records to attribute yet
                  {s.hasTestRecords ? " — every record on disk is Stripe test mode" : ""}. The
                  channels wired up and ready to attribute are {KNOWN_SOURCES.join(", ")}.
                </p>
              )}
            </section>

            {/* ── the artefacts ── */}
            <section className="border-b border-line py-10">
              <Label>Signed</Label>
              <h2 className="mt-3 text-[19px] font-semibold tracking-[-0.02em]">
                {s.loiCount} {s.loiCount === 1 ? "letter" : "letters"} of intent
              </h2>
              <p className="mt-2.5 max-w-[72ch] text-[14px] leading-[1.65] text-muted">
                Each one is a named person at a named company saying what they would run and
                what has to be true first. The timestamp is the server’s, not the browser’s.
              </p>

              {s.live.lois.length > 0 ? (
                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {s.live.lois.map((loi) => (
                    <TractionLoiCard key={loi.id ?? loi.created_at} loi={loi} />
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed border-line bg-surface px-5 py-10 text-center">
                  <p className="text-[14px] font-medium">No live-mode letters of intent yet.</p>
                  <p className="mx-auto mt-2 max-w-[52ch] text-[13.5px] leading-[1.65] text-muted">
                    {s.test.lois.length > 0
                      ? `${s.test.lois.length} test-mode ${
                          s.test.lois.length === 1 ? "signature is" : "signatures are"
                        } listed below and cannot be counted here. `
                      : ""}
                    The form takes about ninety seconds with the phone in their hand.
                  </p>
                  <Link
                    href="/loi?source=room"
                    className="mt-5 inline-flex h-9 items-center rounded-lg bg-ink px-4 text-[13.5px] font-medium text-paper hover:opacity-90"
                  >
                    Get an LOI signed
                  </Link>
                </div>
              )}
            </section>
          </>
        )}

        {/* ── the excluded records, in full ── */}
        {s.hasTestRecords || s.live.pending.length > 0 ? (
          <section className="border-b border-line py-10">
            <Label>Excluded</Label>
            <h2 className="mt-3 text-[19px] font-semibold tracking-[-0.02em]">
              Records that are not traction
            </h2>
            <p className="mt-2.5 max-w-[72ch] text-[14px] leading-[1.65] text-muted">
              Listed rather than deleted. A page that quietly drops rows is a page you have
              to take on faith, and the point of this one is that you do not have to.
            </p>

            <div className="mt-6 flex flex-col gap-px overflow-hidden rounded-xl border border-dashed border-warn-line bg-warn-line/50">
              {s.test.payments.map((p) => (
                <ExcludedRow
                  key={p.stripe_session_id}
                  reason="Stripe test mode"
                  title={`${formatMoney(p.amount_total ?? 0, p.currency)} · ${p.plan} · ${p.status}`}
                  meta={`${stamp(p.created_at)} · via ${p.source || "unknown"} · ${
                    p.stripe_session_id ?? "no session id"
                  }`}
                />
              ))}
              {s.live.pending.map((p) => (
                <ExcludedRow
                  key={p.stripe_session_id}
                  reason={`live, ${p.status}`}
                  title={`${formatMoney(p.amount_total ?? 0, p.currency)} · ${p.plan} · not collected`}
                  meta={`${stamp(p.created_at)} · via ${p.source || "unknown"} · ${
                    p.stripe_session_id ?? "no session id"
                  }`}
                />
              ))}
              {s.test.lois.map((loi) => (
                <ExcludedRow
                  key={loi.id ?? loi.created_at}
                  reason="Stripe test mode"
                  title={`LOI · ${loi.full_name || "unnamed"}${loi.company ? ` · ${loi.company}` : ""}`}
                  meta={`${stamp(loi.created_at)} · via ${loi.source || "unknown"} · intends to ${
                    loi.intent || "—"
                  }`}
                />
              ))}
            </div>
          </section>
        ) : null}

        <footer className="pt-8 pb-4">
          <Label>How these numbers are computed</Label>
          <ul className="mt-4 flex max-w-[74ch] list-none flex-col gap-2 text-[13px] leading-[1.65] text-faint">
            <li>
              A <span className="text-muted">paying customer</span> is a distinct Stripe
              customer on a live-mode checkout that Stripe reports as collected. A session
              that started and never paid is listed under Excluded, never counted.
            </li>
            <li>
              <span className="text-muted">Revenue</span> is the amount captured at
              checkout, as reported by Stripe in minor units. Subscription renewals are not
              re-counted here — Stripe remains the system of record.
            </li>
            <li>
              <span className="text-muted">Live versus test</span> comes from Stripe’s own{" "}
              <code className="font-mono">livemode</code> flag on the webhook event, not
              from anything we set. A record whose flag is missing is treated as test.
            </li>
            <li>
              <span className="text-muted">Attribution</span> is the{" "}
              <code className="font-mono">?source=</code> parameter carried from the link
              into the Stripe session metadata, so it cannot drift from the payment.
            </li>
          </ul>
        </footer>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className={`px-5 py-6 ${accent ? "bg-accent-soft" : "bg-surface"}`}>
      <Label>{label}</Label>
      <div
        className={`tnum mt-3 text-[32px] leading-none font-semibold tracking-[-0.03em] wrap-break-word sm:text-[38px] ${
          accent ? "text-accent-ink" : ""
        }`}
      >
        {value}
      </div>
      <p className="mt-3 text-[12px] leading-[1.5] text-faint">{note}</p>
    </div>
  );
}

function ExcludedRow({
  reason,
  title,
  meta,
}: {
  reason: string;
  title: string;
  meta: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-warn-soft px-4 py-3 sm:px-5">
      <span className="shrink-0 rounded-full border border-warn-line px-2 py-[2px] text-[10.5px] font-semibold tracking-[0.06em] text-warn uppercase">
        {reason}
      </span>
      <span className="text-[13.5px] font-medium">{title}</span>
      {/* Session ids are long. Truncating rather than wrapping keeps a row one
          line, so a ten-record ledger stays scannable on a projector. */}
      <span className="tnum w-full min-w-0 truncate text-[11.5px] text-warn/70 sm:w-auto sm:flex-1">
        {meta}
      </span>
    </div>
  );
}
