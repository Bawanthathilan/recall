/**
 * Anki cards (and some CSV exports) are HTML. Cardly's cards use a small markup
 * instead (src/lib/markup.ts): **bold**, `code`, ``` code blocks ```, line breaks.
 * This converts the parts Cardly can show and drops the rest. Pure, so it's tested.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export type Converted = { text: string; hadMedia: boolean };

export function htmlToMarkup(html: string): Converted {
  let hadMedia = false;
  let s = html.replace(/\r\n?/g, '\n');

  // Images and audio can't be shown until Phase 6: drop them, but remember they were there.
  s = s.replace(/<img\b[^>]*>|\[sound:[^\]]*\]/gi, () => {
    hadMedia = true;
    return '';
  });
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  // Code blocks keep their line breaks and spacing exactly.
  const blocks: string[] = [];
  s = s.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_m, inner: string) => {
    const code = decodeEntities(inner.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/\n+$/, '');
    blocks.push('```\n' + code + '\n```');
    return `\u0001\u0000${blocks.length - 1}\u0000\u0001`;
  });

  // In HTML, plain line breaks in the source are just spaces.
  s = s.replace(/\n/g, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  // Block tags (<div>, <p>…) start a new line, but "</div><div>" is still one
  // line break: each becomes a \u0001 marker, and a run of markers becomes one \n.
  s = s.replace(/<li\b[^>]*>/gi, '\u0001• ');
  s = s.replace(/<\/?(div|p|li|h[1-6]|tr|ul|ol|blockquote)\b[^>]*>/gi, '\u0001');
  s = s.replace(/\u0001+/g, '\n');
  s = s.replace(/<\/?(b|strong)\b[^>]*>/gi, '**');
  s = s.replace(/<\/?code\b[^>]*>/gi, '`');
  s = s.replace(/<[^>]+>/g, ''); // every other tag: keep the text, lose the styling
  s = decodeEntities(s);

  // Tidy up: empty bold/code pairs left behind by stripped content, spaces at line ends, extra blank lines.
  s = s.replace(/\*\*(\s*)\*\*/g, '$1').replace(/``/g, '');
  s = s
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => blocks[Number(i)]);
  return { text: s, hadMedia };
}
