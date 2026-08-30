"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, HireState } from "@/lib/types";
import { sendChat } from "./client-api";
import { Mark, clockTime } from "./ui";
import VoiceInput from "./voice-input";
import AgentText from "./agent-text";

const DEFAULT_PROMPTS = [
  "What should I start with?",
  "Who owns this decision?",
  "I'm stuck, I can't find the source of truth.",
];

export default function Chat({
  hireId,
  seedMessages = [],
  hireName = "You",
  suggestions = DEFAULT_PROMPTS,
  channel = "#onboarding",
  onMessages,
  onHire,
  className = "",
}: {
  hireId: string;
  seedMessages?: ChatMessage[];
  hireName?: string;
  suggestions?: string[];
  channel?: string;
  onMessages?: (messages: ChatMessage[]) => void;
  /** The chat turn also updates task status and blockers — hand them upstream. */
  onHire?: (hire: HireState) => void;
  className?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touched = useRef(false);

  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  /* Accept upstream seeding until the hire says something themselves. */
  useEffect(() => {
    if (touched.current) return;
    setMessages(seedMessages);
  }, [seedMessages]);

  /* Stick to the bottom once the conversation is live, but leave the opening
     brief pinned to the top on arrival — it is the first thing to read. */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = touched.current ? el.scrollHeight : 0;
  }, [messages, pending]);

  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const submit = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || pending || !hireId) return;

      touched.current = true;
      setError(null);
      setDraft("");

      const optimistic: ChatMessage = {
        id: `local-${Date.now()}`,
        role: "hire",
        text,
        at: new Date().toISOString(),
      };
      const base = [...messages, optimistic];
      setMessages(base);
      setPending(true);

      try {
        const out = await sendChat(hireId, text);
        const next =
          out.messages.length > 0
            ? out.messages
            : out.reply
              ? [...base, out.reply]
              : base;
        setMessages(next);
        onMessages?.(next);
        if (out.hire) onHire?.(out.hire);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setDraft(text);
        setMessages(messages);
      } finally {
        setPending(false);
      }
    },
    [hireId, messages, onHire, onMessages, pending],
  );

  const opening = messages[0]?.role === "agent" ? messages[0] : null;
  const rest = opening ? messages.slice(1) : messages;
  const showSuggestions = !pending && rest.length === 0 && suggestions.length > 0;

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface ${className}`}
      style={{ boxShadow: "var(--shadow)" }}
      aria-label="Conversation with the onboarding agent"
    >
      {/* ── header ── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-surface-2/70 px-4 py-3">
        <span className="relative grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface">
          <Mark className="h-[18px] w-[18px]" />
          <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-2 bg-ok" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">
              VANAV
            </span>
            <span className="truncate font-mono text-[11px] text-faint">
              {channel}
            </span>
          </div>
          {/* Says where this actually runs. The panel is styled as a channel
              and the product lives in the customer's own Slack, but the page
              never said so, so a visitor could reasonably conclude this web app
              is the product. It is not: it is the same agent with its working
              shown, which is the one thing a Slack DM cannot do and the reason
              this page is what we send to a prospect. */}
          <p className="truncate text-[11.5px] text-muted">
            Runs in your Slack. Shown here so you can check its sources.
          </p>
        </div>
      </header>

      {/* ── transcript ── */}
      <div
        ref={scroller}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5"
      >
        {messages.length === 0 && !pending && (
          <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 text-center">
            <div className="skeleton h-8 w-8 rounded-lg" />
            <p className="text-[13px] text-faint">
              The agent is reading the corpus and writing your opening brief…
            </p>
          </div>
        )}

        {opening && <OpeningMessage message={opening} />}

        <div className="flex flex-col gap-4">
          {rest.map((m) =>
            m.role === "agent" ? (
              <AgentBubble key={m.id} message={m} />
            ) : (
              <HireBubble key={m.id} message={m} name={hireName} />
            ),
          )}

          {pending && <Typing />}
        </div>
      </div>

      {/* ── suggestions ── */}
      {showSuggestions && (
        <div className="flex shrink-0 flex-wrap gap-2 border-t border-line px-4 pt-3 sm:px-5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── composer ── */}
      <form
        className="shrink-0 px-4 pt-3 pb-4 sm:px-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        {error && (
          <p className="mb-2 rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-[12.5px] leading-snug text-warn">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2 transition-colors focus-within:border-accent/50 focus-within:bg-surface">
          <textarea
            ref={textarea}
            rows={1}
            value={draft}
            disabled={!hireId}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(draft);
              }
            }}
            placeholder={`Message VANAV…`}
            className="max-h-40 min-h-6 flex-1 resize-none bg-transparent text-[14.5px] leading-[1.5] text-ink outline-none placeholder:text-faint"
          />
          <VoiceInput
            disabled={!hireId || pending}
            onTranscript={(text) => {
              /* Into the composer, never straight into the conversation. The
                 hire gets to fix a misheard acronym before the agent answers
                 it — see the note at the top of components/voice-input.tsx. */
              setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text));
              textarea.current?.focus();
            }}
          />
          <button
            type="submit"
            disabled={!draft.trim() || pending || !hireId}
            aria-label="Send"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-paper transition-opacity disabled:opacity-30"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
              <path
                d="M8 13V3.5M8 3.5 4 7.5M8 3.5l4 4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-[11px] text-faint">
          Enter to send · Shift+Enter for a new line
        </p>
      </form>
    </section>
  );
}

/* ── message renderers ────────────────────────────────────────────────── */

function OpeningMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="rise mb-5 overflow-hidden rounded-xl border border-accent/25 bg-accent-soft">
      <div className="flex items-center gap-2 border-b border-accent/20 px-4 py-2">
        <Mark className="h-4 w-4" />
        <span className="label !text-accent-ink">Opening brief</span>
        <span className="ml-auto tnum text-[11px] text-accent-ink/70">
          {clockTime(message.at)}
        </span>
      </div>
      <div className="px-4 py-3.5 text-[15px] leading-[1.62] text-ink">
        <AgentText text={message.text} />
      </div>
    </div>
  );
}

function AgentBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="rise flex items-start gap-2.5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line bg-surface-2">
        <Mark className="h-4 w-4" />
      </span>
      <div className="min-w-0 max-w-[86%]">
        <div className="rounded-2xl rounded-tl-md border border-line bg-surface-2 px-3.5 py-2.5">
          <div className="text-[14.5px] leading-[1.6] break-words text-ink">
            <AgentText text={message.text} />
          </div>
        </div>
        <span className="tnum mt-1 block pl-1 text-[10.5px] text-faint">
          VANAV · {clockTime(message.at)}
        </span>
      </div>
    </div>
  );
}

function HireBubble({ message, name }: { message: ChatMessage; name: string }) {
  return (
    <div className="rise flex flex-col items-end">
      <div className="max-w-[86%] rounded-2xl rounded-tr-md bg-accent px-3.5 py-2.5">
        <p className="text-[14.5px] leading-[1.6] whitespace-pre-wrap break-words text-paper">
          {message.text}
        </p>
      </div>
      <span className="tnum mt-1 pr-1 text-[10.5px] text-faint">
        {name} · {clockTime(message.at)}
      </span>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line bg-surface-2">
        <Mark className="h-4 w-4" />
      </span>
      <span
        className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-line bg-surface-2 px-3.5 py-3"
        role="status"
        aria-label="VANAV is typing"
      >
        <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
        <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
        <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
      </span>
    </div>
  );
}
