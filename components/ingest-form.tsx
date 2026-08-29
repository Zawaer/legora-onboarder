"use client";

/**
 * The ingest form: drop a Slack export, name the company and the role, see what
 * we understood, and only then spend money.
 *
 * The two-step shape is the whole point. Reading the corpus is free and takes
 * milliseconds; deriving the role is two Opus calls over the entire corpus —
 * two to three minutes and a dollar or two. Firing the derivation straight off
 * the upload would mean the first thing anyone learns about a misparsed file is
 * a three-minute wait and a wrong answer. So this screen shows the parse first,
 * with its warnings, and waits to be told to go on.
 */

import { useRef, useState, type DragEvent } from "react";
import { Label, Panel, Pill } from "./ui";
import IngestDerive from "./ingest-derive";

/** Mirrors the JSON from POST /api/ingest. */
export type IngestResult = {
  slug: string;
  name: string;
  roleTitle: string;
  artifactCount: number;
  peopleCount: number;
  warnings: string[];
  format: string;
  dateRange?: { from: string; to: string };
  datesInferred: boolean;
  seen: number;
  channels: { channel: string; count: number }[];
  people: { name: string; handle: string; team: string }[];
  sample: { kind: string; source: string; author: string; snippet: string }[];
};

const FORMAT_LABEL: Record<string, string> = {
  "slack-export-json": "Slack export (JSON)",
  "slack-channels-json": "Slack export, split by channel",
  "records-json": "JSON records",
  csv: "CSV",
  "chat-log": "Pasted chat log",
  documents: "Plain documents",
  empty: "Nothing recognised",
};

/** Matches the route's cap, so we can refuse a 60MB export before uploading it. */
const MAX_BYTES = 6 * 1024 * 1024;

const PLACEHOLDER = `#legal-eng  Johan Berg  10:32  the standard playbook doesn't cover this ask
#legal-eng  Elin Sandberg  10:41  then build a bespoke one, and write it up after

#cust-esc  Marta Rossi  14:02  not fixing an Italian jurisdiction miss with a keyword list`;

export default function IngestForm() {
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [description, setDescription] = useState("");
  const [raw, setRaw] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const hasData = Boolean(file) || raw.trim().length > 0;
  const canSubmit = name.trim().length > 0 && roleTitle.trim().length >= 2 && hasData && !reading;

  function takeFile(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > MAX_BYTES) {
      setError(
        `${next.name} is ${(next.size / 1024 / 1024).toFixed(1)}MB — the limit is 6MB. Export a few of the busiest channels rather than the whole workspace.`,
      );
      return;
    }
    setFile(next);
    // A file is a stronger signal than a half-typed paste; say so rather than
    // silently sending one and ignoring the other.
    if (raw.trim()) setRaw("");
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    takeFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function submit() {
    if (!canSubmit) return;
    setReading(true);
    setError(null);
    setResult(null);

    try {
      let response: Response;

      if (file) {
        const form = new FormData();
        form.set("name", name.trim());
        form.set("roleTitle", roleTitle.trim());
        if (description.trim()) form.set("description", description.trim());
        form.set("file", file);
        response = await fetch("/api/ingest", { method: "POST", body: form });
      } else {
        response = await fetch("/api/ingest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            roleTitle: roleTitle.trim(),
            description: description.trim() || undefined,
            raw,
          }),
        });
      }

      const body = (await response.json().catch(() => null)) as
        | (IngestResult & { error?: string; warnings?: string[] })
        | null;

      if (!response.ok || !body || body.error) {
        const detail = body?.warnings?.length ? ` ${body.warnings[0]}` : "";
        throw new Error(`${body?.error ?? `Upload failed (${response.status}).`}${detail}`);
      }

      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong reading that data.");
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Company"
              hint="Used to name the workspace."
              value={name}
              onChange={setName}
              placeholder="Acme Legal"
            />
            <Field
              label="Role you are hiring for"
              hint="The title, even if nobody has done it yet."
              value={roleTitle}
              onChange={setRoleTitle}
              placeholder="Legal Engineer"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>What the company does — optional</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="One paragraph of public context: what you sell, how fast you are growing."
              className="w-full resize-y rounded-lg border border-line bg-surface-2/40 px-3 py-2.5 text-[13.5px] leading-[1.55] text-ink outline-none placeholder:text-faint focus:border-line-strong"
            />
            <p className="text-[11.5px] leading-[1.5] text-faint">
              We do not look your company up. Without this, the derivation only
              knows what is in the corpus below — which works, but a sentence
              here makes the role noticeably more specific.
            </p>
          </div>

          {/* ── the corpus ── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <Label>Your Slack, docs or tickets</Label>
              <span className="text-[11.5px] text-faint">
                Slack export JSON · CSV · pasted log
              </span>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-7 text-center transition-colors ${
                dragging ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-2/40"
              }`}
            >
              {file ? (
                <>
                  <p className="text-[13.5px] font-medium text-ink">{file.name}</p>
                  <p className="text-[12px] text-faint">
                    {(file.size / 1024).toFixed(0)} KB · ready to read
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      takeFile(null);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                    className="text-[12.5px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[13.5px] text-muted">
                    Drop a file here, or{" "}
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="font-medium text-accent-ink underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
                    >
                      choose one
                    </button>
                  </p>
                  <p className="text-[11.5px] text-faint">Up to 6MB. Nothing leaves this server.</p>
                </>
              )}
              <input
                ref={fileInput}
                type="file"
                accept=".json,.csv,.txt,.log,.md,.tsv,application/json,text/csv,text/plain"
                onChange={(e) => takeFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </div>

            {!file && (
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={8}
                spellCheck={false}
                placeholder={PLACEHOLDER}
                className="scroll-thin w-full resize-y rounded-lg border border-line bg-surface-2/40 px-3 py-2.5 font-mono text-[12.5px] leading-[1.6] text-ink outline-none placeholder:text-faint/70 focus:border-line-strong"
              />
            )}
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex h-11 items-center gap-2.5 rounded-lg bg-ink px-5 text-[14.5px] font-medium text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {reading ? "Reading…" : "Read my data"}
            </button>
            <p className="max-w-[46ch] text-[12.5px] leading-[1.5] text-faint">
              This step is free and instant — no model call. You will see exactly
              what was understood before anything is derived.
            </p>
          </div>

          {error && (
            <p className="rounded-lg border border-warn-line bg-warn-soft px-4 py-3 text-[13px] leading-relaxed text-warn">
              {error}
            </p>
          )}
        </div>
      </Panel>

      {result && <ParseReport result={result} />}
    </div>
  );
}

/**
 * What we understood, before any money is spent.
 *
 * Every number here is a count of something that actually exists in the stored
 * corpus, and every warning the parser raised is shown rather than summarised
 * away — a partial parse the customer was told about is a trade-off they can
 * accept, and a silent one is the bug they find during the derivation.
 */
function ParseReport({ result }: { result: IngestResult }) {
  const dropped = Math.max(0, result.seen - result.artifactCount);

  return (
    <div className="rise flex flex-col gap-5">
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3.5">
          <Pill tone="ok">Read {result.name}</Pill>
          <Pill>{FORMAT_LABEL[result.format] ?? result.format}</Pill>
          {result.datesInferred && <Pill tone="warn">Dates inferred</Pill>}
          <span className="ml-auto font-mono text-[11.5px] text-faint">{result.slug}</span>
        </div>

        <div className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          <Stat label="Artifacts" value={result.artifactCount.toLocaleString()} note={dropped ? `${dropped.toLocaleString()} dropped or capped` : "all of them kept"} />
          <Stat label="People" value={result.peopleCount.toLocaleString()} note="from message authors" />
          <Stat label="Channels" value={result.channels.length.toLocaleString()} note={result.channels[0]?.channel ?? "—"} />
          <Stat
            label="Date range"
            value={result.dateRange ? `${result.dateRange.from.slice(0, 10)}` : "—"}
            note={
              result.dateRange
                ? `to ${result.dateRange.to.slice(0, 10)}${result.datesInferred ? " · partly placeholder" : ""}`
                : "no dates found"
            }
          />
        </div>

        {result.sample.length > 0 && (
          <ul className="flex flex-col divide-y divide-line border-t border-line">
            {result.sample.map((line, i) => (
              <li
                key={`${line.source}-${i}`}
                className="flex min-w-0 items-baseline gap-3 px-5 py-2.5"
              >
                <span className="shrink-0 font-mono text-[11px] text-accent-ink">{line.source}</span>
                <span className="shrink-0 text-[11.5px] text-faint">{line.author}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
                  {line.snippet}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-5">
          <Label className="mb-3">Who the agent can escalate to</Label>
          {result.people.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-muted">
              No author names were found, so a blocker has nobody to route to.
              Data with a name against each message works far better.
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-1.5">
                {result.people.map((person) => (
                  <li key={person.handle} className="flex items-baseline gap-2 text-[13px]">
                    <span className="font-medium text-ink">{person.name}</span>
                    <span className="font-mono text-[11.5px] text-faint">{person.handle}</span>
                    <span className="ml-auto shrink-0 text-[11.5px] text-muted">{person.team}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11.5px] leading-[1.5] text-faint">
                Team is the channel each person posts in most — a fact about the
                corpus, not a guess at your org chart. Nobody is marked as owning
                anything, because the corpus does not say so and inventing it
                would send a stuck hire to the wrong person.
              </p>
            </>
          )}
        </Panel>

        <Panel className="p-5">
          <Label className="mb-3">
            {result.warnings.length ? `What to know (${result.warnings.length})` : "Nothing to flag"}
          </Label>
          {result.warnings.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-muted">
              Everything in that file parsed cleanly.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {result.warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex gap-2.5 text-[12.5px] leading-[1.55] text-muted"
                >
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          )}

          {result.channels.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
              {result.channels.map((channel) => (
                <span
                  key={channel.channel}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-[3px] text-[11px] text-muted"
                >
                  <span className="font-mono">{channel.channel}</span>
                  <span className="tnum text-faint">{channel.count}</span>
                </span>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <IngestDerive result={result} />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border-b border-line px-5 py-4 sm:border-b-0">
      <Label>{label}</Label>
      <p className="tnum mt-1.5 text-[22px] leading-none font-semibold tracking-[-0.02em] text-ink">
        {value}
      </p>
      <p className="mt-1.5 text-[11.5px] leading-[1.4] text-faint">{note}</p>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-line bg-surface-2/40 px-3 text-[14px] text-ink outline-none placeholder:text-faint focus:border-line-strong"
      />
      <p className="text-[11.5px] text-faint">{hint}</p>
    </div>
  );
}
