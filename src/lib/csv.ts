/**
 * Reading spreadsheet exports: CSV (Excel, Google Sheets, Numbers), tab-separated
 * text, and Anki's "Notes in Plain Text" export. Pure, so it's tested.
 */
import type { ImportedNote } from '@/lib/anki';
import { htmlToMarkup } from '@/lib/html';
import { CLOZE_RE, parseTags, validateNote, type NoteData } from '@/lib/notes';

export type Delimiter = ',' | '\t' | ';';

export type ParsedTable = {
  rows: string[][];
  delimiter: Delimiter;
  /** Anki's export says whether fields contain HTML (`#html:true`). */
  html: boolean;
  /** Column names, when the first row looks like a header or Anki's `#columns:` line says. */
  header: string[] | null;
};

const HEADER_WORDS = /^(front|back|question|answer|term|definition|word|meaning|tags?|text|extra|notes?)$/i;

/** Splits `text` into rows of fields, following RFC 4180 quoting ("a ""quoted"" field", line breaks inside quotes). */
export function parseDelimited(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else field += ch;
    i++;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines.
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/** The delimiter that splits the first few lines most consistently. */
export function detectDelimiter(text: string): Delimiter {
  const sample = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')).slice(0, 10);
  let best: Delimiter = ',';
  let bestScore = 0;
  for (const d of ['\t', ';', ','] as Delimiter[]) {
    const counts = parseDelimited(sample.join('\n'), d).map((r) => r.length);
    if (!counts.length || counts[0] < 2) continue;
    // Most lines should have the same number of columns.
    const same = counts.filter((c) => c === counts[0]).length;
    const score = same * 10 + counts[0];
    if (score > bestScore) [best, bestScore] = [d, score];
  }
  return best;
}

const ANKI_SEPARATORS: Record<string, Delimiter> = { tab: '\t', comma: ',', semicolon: ';', ',': ',', ';': ';' };

export function parseTable(input: string): ParsedTable {
  let text = input.replace(/^﻿/, ''); // Excel adds a byte-order mark
  let delimiter: Delimiter | null = null;
  let html = /<(br|div|b|i|span|p)\b/i.test(text);
  let header: string[] | null = null;

  // Anki's export starts with lines like "#separator:tab", "#html:true", "#columns:Front	Back	Tags".
  const lines = text.split(/\r?\n/);
  let skip = 0;
  for (const line of lines) {
    const m = /^#(\w+):(.*)$/.exec(line);
    if (!m) break;
    skip++;
    const [, key, value] = m;
    if (key === 'separator') delimiter = ANKI_SEPARATORS[value.trim().toLowerCase()] ?? delimiter;
    if (key === 'html') html = value.trim() === 'true';
    if (key === 'columns') header = value.split(delimiter ?? '\t').map((c) => c.trim());
  }
  if (skip) text = lines.slice(skip).join('\n');

  delimiter ??= detectDelimiter(text);
  let rows = parseDelimited(text, delimiter);
  if (!header && rows.length > 1 && rows[0].some((c) => HEADER_WORDS.test(c.trim()))) {
    header = rows[0].map((c) => c.trim());
    rows = rows.slice(1);
  }
  return { rows, delimiter, html, header };
}

/** Best guesses for which columns hold the front, back and tags. */
export function guessColumns(table: ParsedTable): { front: number; back: number; tags: number | null } {
  const find = (re: RegExp) => table.header?.findIndex((h) => re.test(h)) ?? -1;
  const front = Math.max(0, find(/^(front|question|term|word|text)$/i));
  let back = find(/^(back|answer|definition|meaning|extra)$/i);
  if (back < 0 || back === front) back = front === 0 ? 1 : 0;
  const tags = find(/^tags?$/i);
  return { front, back, tags: tags >= 0 ? tags : null };
}

export type ColumnChoice = { front: number; back: number; tags: number | null; reverse: boolean };

/**
 * One note per row. A front containing {{c1::…}} becomes a cloze note (the back
 * is its extra text); anything else is a basic note. Rows missing a side are skipped.
 */
export function tableToNotes(table: ParsedTable, cols: ColumnChoice): { notes: ImportedNote[]; skipped: number } {
  const clean = (s: string | undefined) => (table.html ? htmlToMarkup(s ?? '').text : (s ?? '').trim());
  const notes: ImportedNote[] = [];
  let skipped = 0;
  for (const row of table.rows) {
    const front = clean(row[cols.front]);
    const back = clean(row[cols.back]);
    const note: NoteData = new RegExp(CLOZE_RE.source).test(front)
      ? { type: 'cloze', fields: { text: front, extra: back } }
      : { type: 'basic', fields: { front, back, reverse: cols.reverse } };
    if (validateNote(note)) {
      skipped++;
      continue;
    }
    notes.push({ note, tags: cols.tags == null ? [] : parseTags(row[cols.tags] ?? ''), schedule: new Map() });
  }
  return { notes, skipped };
}
