import type { Artifact, Person } from "@/lib/types";
import {
  computeCoverage,
  coverageDate,
  type CoverageReport,
  type PersonCoverage,
} from "@/lib/agent/coverage";
import { Label, Pill } from "./ui";

/**
 * The spec sheet for the corpus a derivation was read out of.
 *
 * Sits directly under the derived role, unprompted, before anyone has asked
 * "how do you know?". Every product in this category shipped a ranking and
 * never shipped a receipt; this is the receipt, and it is deliberately not
 * hidden behind a link, a tooltip or an info icon.
 *
 * It is, however, folded to a single line by default, because fifteen lines of
 * provenance standing between the derived role and the evidence for it is a
 * wall the reader has to climb to reach the two things they came for. The fold
 * is not a hedge — the summary line states the counts out loud, unasked — and
 * on a THIN corpus the panel opens itself, because that is exactly the case
 * where the reader needs the limits before it occurs to them to ask.
 *
 * Tone rule, enforced by review rather than by types: this is a spec sheet, not
 * a disclaimer. Nothing here apologises, hedges, or asks to be forgiven. "No
 * direct messages." is a complete sentence and a complete thought.
 *
 * Pure: `lib/agent/coverage` is arithmetic over types, so this renders on the
 * server or in the client bundle with no cost either way.
 */
export default function CoverageNote({
  coverage,
  artifacts,
  people,
  companyName,
  className = "",
}: {
  /** A precomputed report — from `/api/derive`, say. */
  coverage?: CoverageReport;
  /** Or the corpus itself, and the report is computed here. */
  artifacts?: Artifact[];
  people?: Person[];
  companyName?: string;
  className?: string;
}) {
  const report =
    coverage ??
    (artifacts && artifacts.length
      ? computeCoverage({ artifacts, people, name: companyName })
      : undefined);

  if (!report || report.artifacts === 0) return null;

  const thin = report.standing === "thin";
  const { span } = report;
  const silentDays = span.days - span.daysWithArtifacts;

  return (
    <section
      className={`overflow-hidden rounded-xl border bg-surface ${
        thin ? "border-warn-line" : "border-line"
      } ${className}`}
    >
      {/* Folded by default, open on a thin corpus. `open` is an initial
          attribute, not controlled state: nothing re-renders this with a
          different value, so a reader's own toggle is never overwritten. */}
      <details open={thin}>
        <summary
          className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors sm:px-5 ${
            thin
              ? "text-warn hover:bg-warn-soft"
              : "text-muted hover:bg-surface-2 hover:text-ink"
          }`}
        >
          <span className="tnum min-w-0 flex-1 leading-[1.5]">
            {summaryLine(report)}
          </span>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="chev h-3 w-3 shrink-0 transition-transform"
            aria-hidden
          >
            <path
              d="M6 3.5 10.5 8 6 12.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>

        {/* ── headline: the facts, before anything derived from them ── */}
        {/* The rule above this block should only exist while the panel is
            open, which is why it is here and not on the summary. */}
        <div className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <Label className={thin ? "!text-warn" : ""}>What this was derived from</Label>
            <span className="h-3 w-px bg-line" />
            <span className="text-[11px] text-faint">
              {report.companyName ? `${report.companyName}'s corpus` : "the corpus"}
            </span>
            <span className="ml-auto">
              <Pill tone={thin ? "warn" : "neutral"}>
                {thin
                  ? "Thin corpus"
                  : report.standing === "partial"
                    ? "Partial corpus"
                    : "Broad corpus"}
              </Pill>
            </span>
          </div>

          <p className="max-w-[62ch] text-[15px] leading-[1.5] font-medium tracking-[-0.005em] text-ink">
            {report.headline}
          </p>

          {/* the four numbers, in the same grid language as the manager board */}
          <div className="mt-1 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
            <Cell value={report.artifacts} label="artifacts held" tone={thin ? "warn" : "ink"} />
            <Cell
              value={report.authors}
              label={report.authors === 1 ? "person wrote them" : "people wrote them"}
              tone={thin ? "warn" : "ink"}
            />
            <Cell
              value={report.channels.length}
              label={report.channels.length === 1 ? "location" : "locations"}
            />
            <Cell
              value={span.days <= 1 ? "1" : String(span.days)}
              label={span.days <= 1 ? "day of record" : "days of record"}
              tone={thin ? "warn" : "ink"}
            />
          </div>

          <p className="max-w-[64ch] text-[13px] leading-[1.6] text-muted">
            {report.standingLine}
          </p>

          {/* Qualifiers sit in the panel's first screen, above the breakdown
              rather than inside it. On a thin corpus they are the whole point,
              which is exactly why a thin corpus opens the panel unasked: a fact
              behind a disclosure triangle is a fact nobody read. */}
          {report.qualifiers.length > 0 && (
            <ul className="mt-0.5 flex flex-col gap-1.5">
              {report.qualifiers.map((q) => (
                <li key={q.id} className="flex gap-2.5">
                  <span
                    className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                      thin ? "bg-warn/70" : "bg-line-strong"
                    }`}
                  />
                  <span className="text-[13.5px] leading-[1.5] text-ink">
                    {q.headline}{" "}
                    <span className="text-muted">{q.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── the full breakdown ── */}
        <details className="border-t border-line">
          <summary className="flex items-center gap-2 px-4 py-3 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink sm:px-5">
            <svg viewBox="0 0 16 16" fill="none" className="chev h-3 w-3 shrink-0 transition-transform" aria-hidden>
              <path
                d="M6 3.5 10.5 8 6 12.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Everything the corpus contains, and what it cannot
          </summary>

          <div className="flex flex-col gap-7 border-t border-line bg-surface-2/40 px-4 py-5 sm:px-5">
            {/* what it is made of */}
            <div className="flex flex-col gap-2.5">
              <Label>What it is made of</Label>
              <div className="flex flex-wrap gap-1.5">
                {report.byKind.map((k) => (
                  <Pill key={k.kind}>
                    <span className="tnum font-semibold">{k.artifacts}</span>
                    {kindWord(k.kind, k.artifacts)}
                  </Pill>
                ))}
              </div>
              <p className="text-[12.5px] leading-[1.55] text-muted">
                Across {report.channels.length}{" "}
                {report.channels.length === 1 ? "location" : "locations"}
                {report.slackChannels > 0 && (
                  <>
                    , of which {report.slackChannels}{" "}
                    {report.slackChannels === 1 ? "is a Slack channel" : "are Slack channels"}
                  </>
                )}
                : {report.channels.slice(0, 8).map((c) => c.channel).join(", ")}
                {report.channels.length > 8 && (
                  <> and {report.channels.length - 8} more</>
                )}
                .
              </p>
            </div>

            {/* per-person coverage of the corpus */}
            <div className="flex flex-col gap-2.5">
              <Label>How much of the corpus each name wrote</Label>
              <p className="max-w-[68ch] text-[12.5px] leading-[1.55] text-muted">
                This is the shape of the corpus, not a measure of anyone. Volume in a
                Slack export is how much a person types in public and nothing else.
              </p>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {report.people.map((p) => (
                  <PersonRow
                    key={p.name}
                    person={p}
                    total={report.artifacts}
                    shareMeaningful={report.sharesMeaningful}
                  />
                ))}
              </ul>
              <p className="text-[12px] leading-[1.55] text-faint">
                {report.people.some((p) => p.thinSlice)
                  ? "Counts in amber are two artifacts or fewer. The corpus does not describe how that work is done, and nothing derived from it should lean there. "
                  : ""}
                {report.denominatorNote}
              </p>
            </div>

            {/* the window */}
            <div className="flex flex-col gap-2.5">
              <Label>The window</Label>
              <p className="max-w-[68ch] text-[13px] leading-[1.6] text-ink">
                {span.days <= 1 ? (
                  <>Every artifact carries the date {coverageDate(span.first)}.</>
                ) : (
                  <>
                    {coverageDate(span.first)} to {coverageDate(span.last)}.{" "}
                    <span className="tnum">{span.daysWithArtifacts}</span> of the{" "}
                    <span className="tnum">{span.days}</span> days carry at least one
                    artifact
                    {silentDays > 0 && span.silentDaysAreWeekends && (
                      <>; the {silentDays} that do not are all weekends</>
                    )}
                    .
                  </>
                )}
              </p>
              {span.gaps.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {span.gaps.map((g) => (
                    <li key={g.from} className="text-[12.5px] text-muted">
                      Silent for {g.days} days: {coverageDate(`${g.from}T00:00:00Z`)} to{" "}
                      {coverageDate(`${g.to}T00:00:00Z`)}. Work continued; the record of it
                      is not here.
                    </li>
                  ))}
                </ul>
              )}
              {report.roster && (
                <p className="max-w-[68ch] text-[13px] leading-[1.6] text-ink">
                  {report.roster.independent ? (
                    <>
                      <span className="tnum">{report.roster.appearing}</span> of the{" "}
                      <span className="tnum">{report.roster.size}</span> people on the
                      roster appear in the corpus as authors
                      {report.roster.silent.length > 0 && (
                        <>. Never heard from: {report.roster.silent.join(", ")}</>
                      )}
                      .
                    </>
                  ) : (
                    <>
                      There is no roster independent of this corpus: the{" "}
                      <span className="tnum">{report.roster.size}</span> names were read
                      off the messages themselves, so anyone who does this work without
                      typing in these channels is not on any list here.
                    </>
                  )}
                </p>
              )}
            </div>

            {/* the absences */}
            <div className="flex flex-col gap-2.5">
              <Label>Not in the corpus</Label>
              <ul className="flex flex-col gap-2.5">
                {report.absent.map((a) => (
                  <li key={a.what} className="flex flex-col gap-0.5 border-l-2 border-line pl-3">
                    <span className="text-[13px] font-medium text-ink">{a.what}</span>
                    <span className="max-w-[70ch] text-[12.5px] leading-[1.55] text-muted">
                      {a.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="max-w-[70ch] border-t border-line pt-4 text-[11.5px] leading-[1.65] text-faint">
              Missing actors distort an inferred network faster than intuition suggests:
              roughly 8% of actors absent produces more than 10% structural error, and
              assortativity can reverse sign (Kossinets, 2006). We state what we hold
              rather than estimating what we do not, because the size of the missing part
              is not measurable from inside the sample.
            </p>
          </div>
        </details>
      </details>
    </section>
  );
}

/* ── pieces ────────────────────────────────────────────────────────────── */

/**
 * The single line the panel shows before it has been asked anything.
 *
 * Every number is read off the report. A hardcoded count here would be the
 * exact failure the rest of this file exists to prevent: on three messages
 * from one person it has to say three messages from one person, and it has to
 * stay true when the corpus underneath it changes.
 *
 * The unit word follows the corpus rather than the product's vocabulary — an
 * all-Slack export says "Slack messages", because "artifact" is a word the
 * reader has not agreed to yet. Mixed corpora fall back to it, because there
 * is no honest shorter word for a pile of messages, docs and tickets.
 */
function summaryLine(report: CoverageReport): string {
  const { span } = report;
  const unit =
    report.byKind.length === 1
      ? kindWord(report.byKind[0].kind, report.artifacts)
      : report.artifacts === 1
        ? "artifact"
        : "artifacts";

  const head =
    `Derived from ${report.artifacts} ${unit}` +
    ` by ${report.authors} ${report.authors === 1 ? "person" : "people"}` +
    (span.days <= 1 ? " on a single day" : ` over ${span.days} days`);

  const n = report.qualifiers.length;
  return n === 0
    ? head
    : `${head} · ${n} ${n === 1 ? "limit" : "limits"} worth naming`;
}

function Cell({
  value,
  label,
  tone = "ink",
}: {
  value: string | number;
  label: string;
  tone?: "ink" | "warn";
}) {
  return (
    <div className="bg-surface px-3.5 py-3">
      <div
        className={`tnum text-[21px] leading-none font-semibold tracking-[-0.02em] ${
          tone === "warn" ? "text-warn" : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] leading-tight text-muted">{label}</div>
    </div>
  );
}

function PersonRow({
  person,
  total,
  shareMeaningful,
}: {
  person: PersonCoverage;
  total: number;
  shareMeaningful: boolean;
}) {
  const pct = Math.round(person.share * 100);
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3.5 py-2.5">
      <span className="text-[13.5px] font-medium text-ink">{person.name}</span>
      {person.role && (
        <span className="min-w-0 flex-1 truncate text-[12px] text-faint">{person.role}</span>
      )}
      {!person.role && <span className="flex-1" />}
      <span
        className={`tnum text-[12.5px] ${
          person.thinSlice ? "text-warn" : "text-muted"
        }`}
      >
        {person.artifacts} of {total}
      </span>
      {shareMeaningful && (
        <span className="tnum w-9 text-right text-[12.5px] text-faint">{pct}%</span>
      )}
      {/* A composition strip, in the neutral rule colour. Deliberately not the
          accent: this measures the export, not the person. */}
      <span className="h-[3px] w-full shrink-0 overflow-hidden rounded-full bg-surface-2 sm:w-24">
        <span
          className={`block h-full rounded-full ${
            person.thinSlice ? "bg-warn/45" : "bg-line-strong"
          }`}
          style={{ width: `${Math.max(2, Math.round(person.share * 100))}%` }}
        />
      </span>
    </li>
  );
}

function kindWord(kind: Artifact["kind"], n: number): string {
  const one =
    kind === "slack"
      ? "Slack message"
      : kind === "doc"
        ? "doc"
        : kind === "ticket"
          ? "ticket"
          : "meeting minute";
  return n === 1 ? one : `${one}s`;
}
