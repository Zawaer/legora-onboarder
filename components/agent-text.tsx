import type { ReactNode } from "react";

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
      // not decoration around it.
      <blockquote
        key={`q-${blocks.length}`}
        className="border-l-2 border-accent/40 pl-3 text-[13.5px] leading-[1.55] text-muted whitespace-pre-wrap"
      >
        {inline(quote.join("\n"), `q${blocks.length}`)}
      </blockquote>,
    );
    quote = [];
  };

  for (const line of lines) {
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
