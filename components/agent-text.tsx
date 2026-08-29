import type { ReactNode } from "react";
import { WEB_ESCAPE_HATCH, WEB_PREAMBLE } from "@/lib/web/contract";

/**
 * Renders the agent's prose as React elements.
 *
 * The agent writes light markdown — `**bold**` for a task title, `> ` for the
 * verbatim quote under a drift note. Both surfaces rendered `{message.text}`
 * raw, so the opening brief showed literal asterisks around the first task and
 * a drift note's evidence blockquote — the visible proof that the citation is
 * real, and the single most important thing on that screen — came out as a
 * stray `>` at the start of a line.
 *
 * Deliberately not a markdown library, and deliberately not
 * `dangerouslySetInnerHTML`: this text is model output. Building React elements
 * means the content can never be interpreted as markup no matter what the model
 * emits, which matters more here than supporting the rest of markdown. Anything
 * it does not recognise falls through as plain text rather than disappearing.
 *
 * TWO KINDS OF SENTENCE, AND WHY THEY MUST NOT LOOK ALIKE
 *
 * There are now two sources a paragraph can come from, and the difference
 * between them is the product. An internal citation is verbatim, attributed to
 * a named colleague, with a channel and a date — that is the claim customers
 * are buying. A web answer is none of those things. If the two render the same
 * way, the reader stops being able to tell them apart by looking, and the
 * stronger one is dragged down to the weaker one's level for free.
 *
 * So the accent-ruled blockquote is reserved, permanently, for verified
 * internal quotes. A web answer gets its own quieter container — dashed, no
 * accent, no attribution line, no rule — announced by `WEB_PREAMBLE` before its
 * first word and closed by `WEB_ESCAPE_HATCH`. Those two constants are appended
 * in code (`lib/agent/web-answer.ts`), never generated, which is what makes
 * detecting the block here exact rather than a guess. It also means the plain
 * text degrades correctly everywhere else — in Slack, or pasted into a ticket,
 * it still reads as prose that says out loud where it came from.
 */

/** `**bold**` → <strong>. Splits on the delimiter rather than parsing. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/\*\*/);
  return parts.map((part, i) =>
    // Odd indices sit between a pair of delimiters. An unmatched trailing `**`
    // leaves its text in an odd slot and simply renders bold — wrong, but
    // invisible to a reader, which beats dropping the sentence.
    i % 2 === 1 ? (
      <strong key={`${keyPrefix}-b${i}`} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

/**
 * `*italic*` → <em>, on top of bold.
 *
 * Scoped to the web block rather than added to `inline`, because the only place
 * single asterisks are currently emitted is `WEB_ESCAPE_HATCH` ("how *we* do
 * it") and widening the parser would change how every existing internal reply
 * renders in exchange for nothing.
 */
function emphasis(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(?<!\*)\*(?!\*)/).flatMap((part, i): ReactNode[] =>
    i % 2 === 1
      ? [
          <em key={`${keyPrefix}-i${i}`} className="italic">
            {inline(part, `${keyPrefix}-i${i}`)}
          </em>,
        ]
      : inline(part, `${keyPrefix}-t${i}`),
  );
}

/**
 * `[title](https://…)` → an anchor, with everything around it left as text.
 *
 * Only http(s) is linked. This text originates outside the company by
 * definition, so a `javascript:` or `data:` href gets no benefit of the doubt —
 * it renders as the plain characters it is. (`lib/agent/web-answer.ts` already
 * filters the source list; this is the second lock on the same door, because
 * the answer body can carry a URL too.)
 */
function withLinks(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;

  for (const m of text.matchAll(pattern)) {
    const at = m.index ?? 0;
    if (at > last) out.push(...emphasis(text.slice(last, at), `${keyPrefix}-${last}`));
    out.push(
      <a
        key={`${keyPrefix}-a${at}`}
        href={m[2]}
        target="_blank"
        // `noopener` for the window handle, `nofollow` because we did not
        // vouch for this page — a search engine should not read a link the
        // agent surfaced as an endorsement by us.
        rel="noopener noreferrer nofollow"
        // Muted and underlined, never accent-coloured: accent is the internal
        // citation's colour and a web source must not borrow it.
        className="underline decoration-line-strong underline-offset-2 hover:text-ink"
      >
        {m[1]}
      </a>,
    );
    last = at + m[0].length;
  }

  if (last < text.length) out.push(...emphasis(text.slice(last), `${keyPrefix}-${last}`));
  return out;
}

/**
 * A web answer, in its own quiet container.
 *
 * Everything about it is deliberately *not* the internal citation: dashed
 * rather than solid, a flat surface rather than an accent rule, a label that
 * says where it came from rather than who said it, and no name anywhere on it.
 * A reader skimming at arm's length should be able to tell which of the two
 * they are looking at without reading a word.
 */
function WebAnswerBlock({ lines, index }: { lines: string[]; index: number }) {
  const preamble = lines[0] ?? WEB_PREAMBLE;
  const hatch = lines[lines.length - 1] === WEB_ESCAPE_HATCH ? WEB_ESCAPE_HATCH : null;
  const middle = lines.slice(1, hatch ? -1 : undefined);

  // `Sources:` is emitted as its own line followed by `- [title](url)` items.
  const sourcesAt = middle.findIndex((l) => l.trim() === "Sources:");
  const body = (sourcesAt >= 0 ? middle.slice(0, sourcesAt) : middle).join("\n").trim();
  const sources =
    sourcesAt >= 0
      ? middle
          .slice(sourcesAt + 1)
          .map((l) => l.replace(/^\s*[-*]\s+/, "").trim())
          .filter(Boolean)
      : [];

  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface-2/60 px-3.5 py-3">
      <div className="label">From the web · not from your team</div>

      <p className="mt-2 text-[12.5px] leading-[1.55] text-faint">
        {emphasis(preamble, `web${index}-pre`)}
      </p>

      {body && (
        <div className="mt-2.5 flex flex-col gap-2 text-[13.5px] leading-[1.6] text-muted">
          {body.split(/\n{2,}/).map((para, i) => (
            <p key={`web${index}-p${i}`} className="whitespace-pre-wrap">
              {withLinks(para, `web${index}-p${i}`)}
            </p>
          ))}
        </div>
      )}

      {sources.length > 0 && (
        <div className="mt-3">
          <div className="label">Sources</div>
          <ul className="mt-1.5 flex flex-col gap-1">
            {sources.map((s, i) => (
              <li key={`web${index}-s${i}`} className="text-[12.5px] leading-[1.5] text-muted">
                {withLinks(s, `web${index}-s${i}`)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hatch && (
        // The correction affordance, given its own hairline so it reads as an
        // invitation rather than the last sentence of the answer.
        <p className="mt-3 border-t border-line pt-2.5 text-[12.5px] leading-[1.5] text-faint">
          {emphasis(hatch, `web${index}-hatch`)}
        </p>
      )}
    </div>
  );
}

export default function AgentText({ text }: { text: string }) {
  const lines = text.split("\n");

  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const body = paragraph.join("\n");
    blocks.push(
      <p key={`p-${blocks.length}`} className="whitespace-pre-wrap">
        {inline(body, `p${blocks.length}`)}
      </p>,
    );
    paragraph = [];
  };

  const flushQuote = () => {
    if (!quote.length) return;
    blocks.push(
      // The citation. Given its own visual weight because it is the evidence,
      // not decoration around it. Reserved for verified internal quotes — a web
      // source never appears in here, which is why the web block below is a
      // separate component rather than a variant of this one.
      <blockquote
        key={`q-${blocks.length}`}
        className="border-l-2 border-accent/40 pl-3 text-[13.5px] leading-[1.55] text-muted whitespace-pre-wrap"
      >
        {inline(quote.join("\n"), `q${blocks.length}`)}
      </blockquote>,
    );
    quote = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;

    // The web block, matched on the two constants the server appends verbatim.
    // Consumed whole here so nothing inside it can reach the blockquote branch
    // below, whatever the search provider returned.
    if (line.trim() === WEB_PREAMBLE) {
      flushQuote();
      flushParagraph();

      const collected: string[] = [WEB_PREAMBLE];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const l = lines[j] as string;
        collected.push(l);
        if (l.trim() === WEB_ESCAPE_HATCH) break;
      }
      // An unterminated block still renders as a web block. Falling back to the
      // ordinary path would render web prose in the company's own voice, which
      // is the one outcome worth being defensive about.
      blocks.push(
        <WebAnswerBlock
          key={`web-${blocks.length}`}
          index={blocks.length}
          lines={collected.map((l) => l.trimEnd())}
        />,
      );
      i = Math.min(j, lines.length - 1);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      quote.push(line.replace(/^\s*>\s?/, ""));
    } else if (line.trim() === "") {
      flushQuote();
      flushParagraph();
    } else {
      flushQuote();
      paragraph.push(line);
    }
  }
  flushQuote();
  flushParagraph();

  return <div className="flex flex-col gap-2.5">{blocks}</div>;
}
