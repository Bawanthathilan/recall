/**
 * Converting Anki decks into Cardly notes. Pure — the database side is in
 * src/db/imports.ts — so the conversion rules are tested.
 *
 * An .apkg file is a zip. Inside is the Anki collection, a SQLite database:
 *  - collection.anki2 / .anki21: plain SQLite (older Anki, or "support older versions" ticked)
 *  - collection.anki21b: SQLite compressed with zstd (Anki 2.1.50+). Files with this
 *    also contain a stub collection.anki2 that only says "please update Anki".
 * Media files are in the zip too; Cardly skips them until it supports images and audio.
 */
import { unzipSync } from 'fflate';
import { decompress } from 'fzstd';

import type { FsrsColumns } from '@/lib/fsrs';
import { htmlToMarkup } from '@/lib/html';
import { cardOrds, parseTags, validateNote, type NoteData } from '@/lib/notes';

export class ImportError extends Error {}

/** Pulls the collection database out of an .apkg (or .colpkg) file. */
export function extractCollection(apkg: Uint8Array): Uint8Array {
  let files: Record<string, Uint8Array>;
  try {
    // Only unpack the collection; media can be hundreds of MB.
    files = unzipSync(apkg, { filter: (f) => f.name.startsWith('collection.anki') });
  } catch {
    throw new ImportError('This file isn’t an Anki deck (.apkg).');
  }
  if (files['collection.anki21b']) return decompress(files['collection.anki21b']);
  const db = files['collection.anki21'] ?? files['collection.anki2'];
  if (!db) throw new ImportError('No Anki collection found in this file.');
  return db;
}

/**
 * Reads one number field from a protobuf message — just enough to get a note
 * type's "kind" (field 1: 0 = standard, 1 = cloze) from Anki's newer schema.
 */
export function protobufVarint(bytes: Uint8Array, field: number): number | null {
  let i = 0;
  const varint = () => {
    let result = 0;
    let shift = 0;
    for (;;) {
      const b = bytes[i++];
      result += (b & 0x7f) * 2 ** shift;
      if (b < 0x80 || i >= bytes.length) return result;
      shift += 7;
    }
  };
  while (i < bytes.length) {
    const key = varint();
    const [num, wire] = [Math.floor(key / 8), key & 7];
    if (wire === 0) {
      const v = varint();
      if (num === field) return v;
    } else if (wire === 2) {
      // Not `i += varint()`: that reads `i` before varint() moves it past the length.
      const length = varint();
      i += length;
    }
    else if (wire === 1) i += 8;
    else if (wire === 5) i += 4;
    else return null; // groups are obsolete; give up rather than misread
  }
  return null;
}

// ─── The collection, as read from its tables ────────────────────────────────

export type AnkiModel = { name: string; kind: 'standard' | 'cloze'; templateCount: number };
export type AnkiNote = { id: number; mid: number; tags: string; flds: string };
export type AnkiCard = {
  nid: number;
  did: number;
  ord: number;
  type: number; // 0 new, 1 learning, 2 review, 3 relearning
  due: number; // review cards: days since the collection was created
  ivl: number; // days
  factor: number; // ease, in permille (2500 = 250%)
  reps: number;
  lapses: number;
  data: string; // JSON; Anki's FSRS keeps {"s": stability, "d": difficulty} here
};
export type AnkiCollection = {
  crt: number; // collection creation, unix seconds
  models: Map<number, AnkiModel>;
  decks: Map<number, string>;
  notes: AnkiNote[];
  cards: AnkiCard[];
};

// ─── Conversion ─────────────────────────────────────────────────────────────

export type ImportedNote = {
  note: NoteData;
  tags: string[];
  /** Scheduling to keep, by Cardly card ord. Cards not listed start as new. */
  schedule: Map<number, FsrsColumns>;
};
export type ImportedDeck = { name: string; notes: ImportedNote[] };
export type ConvertResult = {
  decks: ImportedDeck[];
  /** Notes Cardly can't show: image occlusion, or nothing left once images/audio are removed. */
  skipped: number;
  /** Imported notes that lost an image or sound. */
  lostMedia: number;
};

const DAY = 86_400_000;

/** Anki separates nested deck names with "::" (older) or \x1f (newer). */
export const deckDisplayName = (name: string) => name.split(/\x1f|::/).join(' › ');

/**
 * Anki's review state → FSRS. If the deck used Anki's own FSRS we get the real
 * stability and difficulty; otherwise stability ≈ the current interval (at 90%
 * retention FSRS schedules about one stability ahead) and difficulty comes from
 * the ease factor (250% = average, 130% = hardest).
 */
export function ankiSchedule(card: AnkiCard, crt: number): FsrsColumns | null {
  if (card.type !== 2) return null; // new and mid-learning cards start fresh
  let memory: { s?: number; d?: number } = {};
  try {
    memory = card.data ? JSON.parse(card.data) : {};
  } catch {
    // not JSON: ignore
  }
  const ivl = Math.max(1, card.ivl);
  const due = (crt + card.due * 86_400) * 1000;
  const difficulty = memory.d ?? Math.min(10, Math.max(1, 5 + (2500 - (card.factor || 2500)) / 240));
  return {
    due,
    stability: memory.s ?? ivl,
    difficulty,
    elapsed_days: 0,
    scheduled_days: ivl,
    learning_steps: 0,
    reps: card.reps,
    lapses: card.lapses,
    state: 2, // Review
    last_review: due - ivl * DAY,
  };
}

export function convertCollection(col: AnkiCollection, { keepProgress }: { keepProgress: boolean }): ConvertResult {
  const cardsByNote = new Map<number, AnkiCard[]>();
  for (const c of col.cards) {
    if (!cardsByNote.has(c.nid)) cardsByNote.set(c.nid, []);
    cardsByNote.get(c.nid)!.push(c);
  }

  const decks = new Map<string, ImportedNote[]>();
  let skipped = 0;
  let lostMedia = 0;

  for (const n of col.notes) {
    const model = col.models.get(n.mid);
    const cards = (cardsByNote.get(n.id) ?? []).sort((a, b) => a.ord - b.ord);
    if (!model || !cards.length) continue;

    const fields = n.flds.split('\x1f').map(htmlToMarkup);
    const hadMedia = fields.some((f) => f.hadMedia);
    const [first = '', ...rest] = fields.map((f) => f.text);
    const extra = rest.filter(Boolean).join('\n\n');

    let note: NoteData;
    // Cardly ord for each Anki card ord. Anki cloze card 0 hides c1, card 1 hides c2…
    let toCardlyOrd: (ankiOrd: number) => number;
    if (model.kind === 'cloze') {
      if (first.includes('image-occlusion:')) {
        skipped++;
        continue;
      }
      note = { type: 'cloze', fields: { text: first, extra } };
      toCardlyOrd = (o) => o + 1;
    } else {
      // Basic: first field is the front, the rest the back. A second template means "and reversed".
      const reverse = model.templateCount >= 2 && cards.some((c) => c.ord === 1);
      note = { type: 'basic', fields: { front: first, back: extra, reverse } };
      toCardlyOrd = (o) => o;
    }
    if (validateNote(note)) {
      skipped++;
      continue;
    }
    if (hadMedia) lostMedia++;

    const ords = new Set(cardOrds(note));
    const schedule = new Map<number, FsrsColumns>();
    if (keepProgress) {
      for (const c of cards) {
        const s = ankiSchedule(c, col.crt);
        const ord = toCardlyOrd(c.ord);
        if (s && ords.has(ord)) schedule.set(ord, s);
      }
    }

    const deckName = deckDisplayName(col.decks.get(cards[0].did) ?? 'Imported');
    if (!decks.has(deckName)) decks.set(deckName, []);
    decks.get(deckName)!.push({ note, tags: parseTags(n.tags), schedule });
  }

  return { decks: [...decks].map(([name, notes]) => ({ name, notes })), skipped, lostMedia };
}
