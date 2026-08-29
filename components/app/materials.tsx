"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browserClient, type Material } from "@/lib/supabase";
import { Label, Spinner } from "@/components/ui";

/**
 * Company material: the documents a customer already has.
 *
 * The sharpest criticism of this product is that a role inferred only from
 * Slack is ambiguous, because a good half of any job is agreed out loud in a
 * room and never typed. That is true, and no amount of reading chat fixes it.
 * What does fix it is letting a company drag in the handbook, the role
 * description and the 30/60/90 they already wrote, so the agent starts from
 * what the company has decided rather than only from what it happened to say.
 *
 * The file goes from this component straight to Supabase Storage, where the
 * policies in supabase/storage.sql decide whether it may land in this
 * company's folder. Only then does it POST to /api/app/materials to record the
 * row. Two steps rather than one round trip through our server, because
 * proxying a 10 MB body through a serverless function to gain nothing is a way
 * to discover a request size limit at the worst moment.
 */

/** Matches the bucket's file_size_limit in supabase/storage.sql. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Extension to content type.
 *
 * The type is set explicitly on upload rather than trusting `file.type`,
 * because browsers disagree about markdown and CSV and some report an empty
 * string for both. The bucket's allow-list is exactly these five values, so a
 * guess here would show up as an opaque storage rejection there.
 */
const ACCEPTED: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
};

const ACCEPT_ATTR = ".pdf,.docx,.txt,.md,.csv";

type QueueItem = {
  key: string;
  name: string;
  bytes: number;
  /** No "uploading 47%": see the note on progress below. */
  status: "uploading" | "recording" | "error";
  error?: string;
};

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

/**
 * A storage-safe object name. The display name in the database keeps the
 * original, so a file called "Rollbeskrivning saljare (v2).pdf" still reads
 * correctly in the list even though its key on disk does not.
 */
function safeName(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+/, "")
      .slice(-120) || "file"
  );
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Locale-stable by hand, like clockTime in components/ui. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function Materials({
  companyId,
  canUpload,
}: {
  companyId: string;
  canUpload: boolean;
}) {
  const db = useMemo(() => browserClient(), []);
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Nested elements fire dragleave as the pointer crosses them, so a boolean
  // driven by the raw events flickers. Counting enters against leaves does not.
  const dragDepth = useRef(0);

  const load = useCallback(async () => {
    if (!db) {
      setLoading(false);
      setListError("Storage is not configured on this deployment.");
      return;
    }
    const { data, error } = await db
      .from("materials")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) {
      setListError("Could not load what is already here.");
    } else {
      setListError("");
      setItems((data ?? []) as Material[]);
    }
    setLoading(false);
  }, [db, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback((key: string, next: Partial<QueueItem>) => {
    setQueue((q) => q.map((item) => (item.key === key ? { ...item, ...next } : item)));
  }, []);

  /** One file, all the way through, or a message saying which one failed and why. */
  const upload = useCallback(
    async (file: File, key: string) => {
      if (!db) {
        patch(key, { status: "error", error: "Storage is not configured." });
        return;
      }

      const ext = extensionOf(file.name);
      const contentType = ACCEPTED[ext];
      const path = `${companyId}/${uuid()}-${safeName(file.name)}`;

      const { error: uploadErr } = await db.storage
        .from("materials")
        .upload(path, file, { contentType, upsert: false });

      if (uploadErr) {
        patch(key, {
          status: "error",
          error: /bucket/i.test(uploadErr.message)
            ? "The materials bucket does not exist yet. Run supabase/storage.sql."
            : uploadErr.message,
        });
        return;
      }

      patch(key, { status: "recording" });

      // The route runs with the service key and does its own authorisation, so
      // it needs the session token to know who is asking.
      const token = (await db.auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/app/materials", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          companyId,
          fileName: file.name,
          storagePath: path,
          bytes: file.size,
        }),
      }).catch(() => null);

      const body = (await res?.json().catch(() => ({}))) as {
        error?: string;
        material?: Material;
      };

      if (!res?.ok || !body.material) {
        // An object with no row is invisible to the product and still counts
        // against the customer's storage, so clean it up rather than leave a
        // ghost nobody can see or delete.
        await db.storage.from("materials").remove([path]);
        patch(key, {
          status: "error",
          error: body.error ?? "Uploaded, but could not be recorded.",
        });
        return;
      }

      const saved = body.material;
      setItems((prev) => [saved, ...prev]);
      // Done items leave the queue because they reappear in the list below.
      // Failures stay put until dismissed, so nothing fails quietly.
      setQueue((q) => q.filter((item) => item.key !== key));
    },
    [db, companyId, patch],
  );

  const accept = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const queued: { file: File; key: string }[] = [];
      const rejected: QueueItem[] = [];

      for (const file of Array.from(files)) {
        const key = `${file.name}-${file.size}-${uuid()}`;
        const ext = extensionOf(file.name);
        // Checked here rather than left to the request, because a 10 MB upload
        // that fails after a minute of waiting reads as a broken product. The
        // bucket enforces the same limit; this one exists to be quick and to
        // name the file.
        if (!ACCEPTED[ext]) {
          rejected.push({
            key,
            name: file.name,
            bytes: file.size,
            status: "error",
            error: "That file type is not accepted. Use PDF, DOCX, TXT, MD or CSV.",
          });
          continue;
        }
        if (file.size > MAX_BYTES) {
          rejected.push({
            key,
            name: file.name,
            bytes: file.size,
            status: "error",
            error: `Too large at ${formatBytes(file.size)}. The limit is 10 MB per file.`,
          });
          continue;
        }
        queued.push({ file, key });
      }

      setQueue((q) => [
        ...q,
        ...rejected,
        ...queued.map(({ file, key }) => ({
          key,
          name: file.name,
          bytes: file.size,
          status: "uploading" as const,
        })),
      ]);

      // Sequential. Five parallel uploads on an office connection make all
      // five slow and none of them informative.
      void (async () => {
        for (const { file, key } of queued) await upload(file, key);
      })();
    },
    [upload],
  );

  async function remove(material: Material) {
    if (busyId) return;
    setBusyId(material.id);
    const token = (await db?.auth.getSession())?.data.session?.access_token;
    const res = await fetch("/api/app/materials", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ id: material.id }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { error?: string };
    if (!res?.ok) {
      setListError(body.error ?? "Could not remove that file.");
      setBusyId(null);
      return;
    }
    setListError("");
    setItems((prev) => prev.filter((m) => m.id !== material.id));
    setBusyId(null);
  }

  /**
   * The bucket is private, so there is no permanent URL to link to. A signed
   * one is minted per click and expires in a minute.
   *
   * The window is opened before the await and pointed afterwards. Opening it
   * after would happen outside the click gesture, and every popup blocker
   * would eat it. No "noopener" in the feature string, because passing it
   * makes window.open return null and there would be nothing left to point.
   */
  async function open(material: Material) {
    if (!db) return;
    const w = window.open("about:blank", "_blank");
    const { data, error } = await db.storage
      .from("materials")
      .createSignedUrl(material.storage_path, 60);
    if (error || !data) {
      w?.close();
      setListError("Could not open that file.");
      return;
    }
    if (w) w.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-line-strong bg-surface"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-2/70 px-5 py-3">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
          Material · what the agent reads
        </span>
        {items.length > 0 && (
          <span className="tnum font-mono text-[11px] text-faint">
            {items.length} {items.length === 1 ? "file" : "files"}
          </span>
        )}
      </div>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <p className="max-w-[62ch] text-[14px] leading-[1.6] text-muted">
          Slack shows what a team said. It does not show what was agreed in a
          room. Add the handbook, the role description, the ramp plan you
          already wrote, and the agent works from those too.
        </p>

        {canUpload ? (
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              dragDepth.current += 1;
              setDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              e.preventDefault();
              dragDepth.current = Math.max(0, dragDepth.current - 1);
              if (dragDepth.current === 0) setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              dragDepth.current = 0;
              setDragging(false);
              accept(e.dataTransfer.files);
            }}
            className={`mt-5 flex flex-col items-center gap-3 rounded-lg border border-dashed px-5 py-8 text-center transition-colors ${
              dragging ? "border-ink bg-surface-2" : "border-line-strong bg-paper"
            }`}
          >
            <p className="text-[14px] text-muted">Drag files here</p>

            {/*
              The input is the real control and stays in the tab order, so this
              is reachable and operable from the keyboard. The label is its
              visible surface, and it takes the focus ring on the input's
              behalf because an sr-only element cannot show one itself.
            */}
            <label className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-ink px-4 text-[14px] font-medium text-paper transition-opacity hover:opacity-90 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink">
              <input
                type="file"
                multiple
                accept={ACCEPT_ATTR}
                className="sr-only"
                onChange={(e) => {
                  accept(e.target.files);
                  // Reset, or picking the same file twice in a row is silent.
                  e.target.value = "";
                }}
              />
              Choose files
            </label>

            <p className="text-[12.5px] text-faint">
              PDF, DOCX, TXT, MD or CSV. Up to 10 MB each.
            </p>
          </div>
        ) : (
          <p className="mt-5 rounded-lg border border-line bg-surface-2 px-4 py-3 text-[13px] leading-[1.55] text-muted">
            You can read what is here. Ask an admin to add or remove material.
          </p>
        )}

        {queue.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {queue.map((item) => (
              <li
                key={item.key}
                className={`rounded-lg border px-3.5 py-2.5 ${
                  item.status === "error"
                    ? "border-warn-line bg-warn-soft"
                    : "border-line bg-surface-2"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13.5px] font-medium text-ink">
                    {item.name}
                  </span>
                  <span className="tnum shrink-0 font-mono text-[11.5px] text-faint">
                    {formatBytes(item.bytes)}
                  </span>
                </div>

                {item.status === "error" ? (
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <p role="alert" className="text-[12.5px] leading-[1.5] text-warn">
                      {item.error}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setQueue((q) => q.filter((x) => x.key !== item.key))
                      }
                      className="shrink-0 rounded px-1.5 text-[12px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <>
                    {/*
                      An indeterminate bar rather than a percentage. The
                      Supabase client does not report upload progress, so any
                      number here would be an animation pretending to be
                      telemetry, and this product's whole argument is that it
                      does not do that.
                    */}
                    <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-line">
                      <div className="h-full w-1/3 animate-pulse rounded-full bg-ink/60" />
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
                      <Spinner />
                      {item.status === "uploading" ? "Uploading" : "Recording"}
                    </p>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-7">
          <Label>On file</Label>

          {listError && (
            <p role="alert" className="mt-3 text-[13px] leading-[1.5] text-warn">
              {listError}
            </p>
          )}

          {loading ? (
            <p className="mt-3 flex items-center gap-2 text-[13.5px] text-muted">
              <Spinner />
              Loading
            </p>
          ) : items.length === 0 ? (
            <p className="mt-3 text-[13.5px] leading-[1.55] text-faint">
              Nothing yet. The agent is working from Slack alone until something
              lands here.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-line border-y border-line">
              {items.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => void open(m)}
                      className="max-w-full truncate text-left text-[14px] font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      {m.file_name}
                    </button>
                    <p className="tnum mt-0.5 font-mono text-[11.5px] text-faint">
                      {formatBytes(m.bytes)}
                      {m.bytes !== null ? " · " : ""}
                      {formatDate(m.created_at)}
                    </p>
                  </div>

                  {/*
                    Shown to whoever the dashboard says may manage material.
                    The route checks admin again with the database in front of
                    it and answers 403 otherwise, so this flag decides what is
                    worth showing, not what is allowed.
                  */}
                  {canUpload && (
                    <button
                      type="button"
                      onClick={() => void remove(m)}
                      disabled={busyId === m.id}
                      className="shrink-0 rounded-md px-2 py-1 text-[12.5px] text-muted transition-colors hover:bg-warn-soft hover:text-warn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
                    >
                      {busyId === m.id ? "Removing" : "Remove"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
