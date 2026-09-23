/**
 * A tiny markup language for card text:
 *
 *   ```js            fenced code block (language optional)
 *   code here
 *   ```
 *   **bold**   `inline code`   {{c1::cloze}}  {{c1::cloze::hint}}
 *
 * `parseMarkup` turns text into plain data (blocks of spans); the <Markup>
 * component draws it. Keeping parsing separate from drawing makes it testable.
 */

export type Span = {
  text: string;
  bold?: boolean;
  code?: boolean;
  /** "hidden" = the blank you're being asked about, "revealed" = its answer, highlighted. */
  cloze?: 'hidden' | 'revealed';
};

export type Block = { kind: 'text'; spans: Span[] } | { kind: 'code'; language: string; code: string };

/** How to show cloze deletions. `ord` = the cloze number this card tests. */
export type ClozeMode = { ord: number; revealed: boolean };

const FENCE_RE = /```([\w+#-]*)[^\S\n]*\n?([\s\S]*?)\n?```/g;

/** Inline markers. `::` and `}}` only mean something inside a cloze. */
const MARKER_RE = /(\{\{c\d+::|\}\}|::|\*\*|`)/;

export function parseMarkup(text: string, cloze?: ClozeMode): Block[] {
  const blocks: Block[] = [];
  let last = 0;
  for (const m of text.matchAll(FENCE_RE)) {
    pushText(blocks, text.slice(last, m.index), cloze);
    blocks.push({ kind: 'code', language: m[1].toLowerCase(), code: m[2] });
    last = m.index + m[0].length;
  }
  pushText(blocks, text.slice(last), cloze);
  return blocks;
}

function pushText(blocks: Block[], text: string, cloze?: ClozeMode) {
  // Trim the newlines that surrounded a code fence, but keep other whitespace.
  const trimmed = text.replace(/^\n+|\n+$/g, '');
  if (trimmed) blocks.push({ kind: 'text', spans: parseInline(trimmed, cloze) });
}

/**
 * Inline markup as a tiny state machine rather than one big regex, so markers
 * can nest: a cloze inside `code`, **bold** inside a cloze… The text is split
 * on markers, then walked left to right while tracking bold / code / cloze.
 * A marker with no partner later on (a stray backtick, `::` outside a cloze)
 * is kept as plain text.
 */
export function parseInline(text: string, cloze?: ClozeMode): Span[] {
  const parts = text.split(MARKER_RE).filter(Boolean);
  const spans: Span[] = [];
  let bold = false;
  let code = false;
  /** The cloze we're inside. `hidden` = it's the blank this card asks about. */
  let open: { hidden: boolean; target: boolean; inHint: boolean; hint: string; bold: boolean; code: boolean } | null = null;

  /** Append text, merging with the previous span when the style is identical. */
  const push = (t: string, style: { bold: boolean; code: boolean; cloze?: Span['cloze'] }) => {
    const span: Span = { text: t };
    if (style.bold) span.bold = true;
    if (style.code) span.code = true;
    if (style.cloze) span.cloze = style.cloze;
    const prev = spans[spans.length - 1];
    if (prev && !!prev.bold === !!span.bold && !!prev.code === !!span.code && prev.cloze === span.cloze) prev.text += t;
    else spans.push(span);
  };
  const hasLater = (i: number, marker: string) => parts.indexOf(marker, i + 1) !== -1;

  parts.forEach((part, i) => {
    const clozeOpen = /^\{\{c(\d+)::$/.exec(part);
    if (clozeOpen && !open && hasLater(i, '}}')) {
      const target = !!cloze && Number(clozeOpen[1]) === cloze.ord;
      open = { hidden: target && !cloze?.revealed, target, inHint: false, hint: '', bold, code };
    } else if (part === '}}' && open) {
      // A hidden blank becomes one placeholder, styled like the text around it.
      if (open.hidden) push(open.hint ? `[${open.hint}]` : '[…]', { bold: open.bold, code: open.code, cloze: 'hidden' });
      open = null;
    } else if (part === '::' && open && !open.inHint) {
      open.inHint = true; // {{c1::answer::hint}}
    } else if (part === '`' && (code || hasLater(i, '`'))) {
      code = !code;
    } else if (part === '**' && !code && (bold || hasLater(i, '**'))) {
      bold = !bold;
    } else if (open?.inHint) {
      open.hint += part; // hints only show on a hidden blank
    } else if (!open?.hidden) {
      push(part, { bold, code, cloze: open?.target ? 'revealed' : undefined });
    }
  });
  return spans;
}

// ─── Editing helpers (used by the formatting toolbar) ───────────────────────

export type Selection = { start: number; end: number };

/** Wrap the selection with `before`/`after`. With no selection, inserts `placeholder` wrapped. */
export function wrapSelection(value: string, sel: Selection, before: string, after: string, placeholder = '') {
  const selected = value.slice(sel.start, sel.end) || placeholder;
  const text = value.slice(0, sel.start) + before + selected + after + value.slice(sel.end);
  const start = sel.start + before.length;
  return { text, selection: { start, end: start + selected.length } };
}

/** Insert a fenced code block around the selection, on its own lines. */
export function insertCodeBlock(value: string, sel: Selection, language = '') {
  const pre = sel.start > 0 && value[sel.start - 1] !== '\n' ? '\n' : '';
  const post = sel.end < value.length && value[sel.end] !== '\n' ? '\n' : '';
  return wrapSelection(value, sel, `${pre}\`\`\`${language}\n`, `\n\`\`\`${post}`, 'code');
}
