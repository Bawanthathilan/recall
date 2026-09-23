/**
 * Note types. A *note* is what you write; a *card* is one way of being tested
 * on it. `cardOrds()` decides which cards a note needs: "ord" 0 is the forward
 * card, 1 the reversed card, and for cloze notes N means "hide cloze N".
 *
 * Pure TypeScript — no React, no database — so it's easy to unit-test.
 */

export type NoteType = 'basic' | 'cloze' | 'code' | 'vocab';

export type BasicFields = { front: string; back: string; reverse: boolean };
export type ClozeFields = { text: string; extra: string };
export type CodeFields = { prompt: string; language: string; code: string; answer: string; explanation: string };
export type VocabFields = {
  word: string;
  reading: string; // e.g. kana for kanji, pinyin for hanzi
  transliteration: string; // e.g. romaji
  pos: string; // part of speech: "Verb", "Noun"…
  meaning: string; // comma-separated alternatives: "to study, to learn"
  example: string;
  reverse: boolean; // also practise producing the word from its meaning
};

/** A discriminated union: checking `note.type` tells TypeScript which fields exist. */
export type NoteData =
  | { type: 'basic'; fields: BasicFields }
  | { type: 'cloze'; fields: ClozeFields }
  | { type: 'code'; fields: CodeFields }
  | { type: 'vocab'; fields: VocabFields };

export const NOTE_TYPE_LABEL: Record<NoteType, string> = {
  basic: 'Basic',
  cloze: 'Cloze',
  code: 'Code',
  vocab: 'Vocabulary',
};

const EMPTY: { [K in NoteType]: Extract<NoteData, { type: K }>['fields'] } = {
  basic: { front: '', back: '', reverse: false },
  cloze: { text: '', extra: '' },
  code: { prompt: '', language: 'javascript', code: '', answer: '', explanation: '' },
  vocab: { word: '', reading: '', transliteration: '', pos: '', meaning: '', example: '', reverse: false },
};

export function emptyNote(type: NoteType): NoteData {
  return { type, fields: { ...EMPTY[type] } } as NoteData;
}

/** Parse the JSON stored in notes.fields, filling in any missing keys with defaults. */
export function parseNote(type: string, json: string): NoteData {
  const t: NoteType = type in EMPTY ? (type as NoteType) : 'basic';
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(json) ?? {};
  } catch {
    // Corrupt JSON: fall back to an empty note rather than crashing the study screen.
  }
  return { type: t, fields: { ...EMPTY[t], ...raw } } as NoteData;
}

// ─── Cloze ──────────────────────────────────────────────────────────────────

/** Matches {{c1::answer}} and {{c1::answer::hint}}. */
export const CLOZE_RE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

/** Distinct cloze numbers in the text, ascending. */
export function clozeNumbers(text: string): number[] {
  const nums = new Set<number>();
  for (const m of text.matchAll(CLOZE_RE)) nums.add(Number(m[1]));
  return [...nums].filter((n) => n > 0).sort((a, b) => a - b);
}

export function nextClozeNumber(text: string): number {
  const nums = clozeNumbers(text);
  return nums.length ? nums[nums.length - 1] + 1 : 1;
}

// ─── Cards per note ─────────────────────────────────────────────────────────

/** Which cards this note should have. */
export function cardOrds(note: NoteData): number[] {
  switch (note.type) {
    case 'basic':
      return note.fields.reverse ? [0, 1] : [0];
    case 'vocab':
      return note.fields.reverse ? [0, 1] : [0];
    case 'cloze':
      return clozeNumbers(note.fields.text);
    case 'code':
      return [0];
  }
}

/** Why a note can't be saved yet, or null if it's fine. */
export function validateNote(note: NoteData): string | null {
  switch (note.type) {
    case 'basic':
      return !note.fields.front.trim() || !note.fields.back.trim() ? 'Fill in both sides' : null;
    case 'cloze':
      if (!note.fields.text.trim()) return 'Write some text';
      return clozeNumbers(note.fields.text).length ? null : 'Select a word and tap “Cloze” to hide it';
    case 'code':
      return !note.fields.prompt.trim() || !note.fields.code.trim() || !note.fields.answer.trim()
        ? 'Add a prompt, code and answer'
        : null;
    case 'vocab':
      return !note.fields.word.trim() || !note.fields.meaning.trim() ? 'Add the word and its meaning' : null;
  }
}

/** One-line summary for lists (deck page). Markup is stripped. */
export function notePreview(note: NoteData): string {
  const text = (() => {
    switch (note.type) {
      case 'basic':
        return note.fields.front;
      case 'cloze':
        return note.fields.text.replace(CLOZE_RE, (_m, _n, answer) => answer);
      case 'code':
        return note.fields.prompt;
      case 'vocab':
        return [note.fields.word, note.fields.meaning].filter(Boolean).join(' — ');
    }
  })();
  return text
    .replace(/```\w*\n?/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Tags ───────────────────────────────────────────────────────────────────

/** "Closures, scope  async" → ["closures", "scope", "async"] (stored space-separated, like Anki). */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[\s,]+/)) {
    const tag = raw.trim().replace(/^#/, '').toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

// ─── Typed answers (vocab) ──────────────────────────────────────────────────

/** What you typed on a vocab card, and whether it matched. */
export type Typed = { value: string; correct: boolean };

function normalise(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents: "café" → "cafe"
    .toLowerCase()
    .replace(/[.!?¡¿"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim() // trim *before* the "to " check: " to learn" (after a comma) must match too
    .replace(/^to /, ''); // "to study" ≈ "study"
}

/** True if `typed` matches any of the comma/semicolon-separated alternatives in `expected`. */
export function checkTypedAnswer(typed: string, expected: string): boolean {
  const t = normalise(typed);
  if (!t) return false;
  return expected
    .split(/[,;/]/)
    .map(normalise)
    .some((alt) => alt && alt === t);
}
