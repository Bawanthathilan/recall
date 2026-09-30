/**
 * Database side of importing: reading an Anki collection, and saving imported
 * notes into Cardly. The conversion rules are in src/lib/anki.ts and csv.ts.
 */
import { deserializeDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { StarterDeck } from '@/data/starterDecks';
import { createDeck, createNote, setCardSchedule } from '@/db/queries';
import { t } from '@/i18n';
import {
  extractCollection,
  ImportError,
  protobufVarint,
  type AnkiCard,
  type AnkiCollection,
  type AnkiModel,
  type AnkiNote,
  type ImportedDeck,
} from '@/lib/anki';

/** Opens an .apkg's collection as an in-memory database and reads what Cardly needs. */
export async function readApkg(apkg: Uint8Array): Promise<AnkiCollection> {
  const anki = await deserializeDatabaseAsync(extractCollection(apkg));
  try {
    return await readAnkiCollection(anki);
  } finally {
    await anki.closeAsync();
  }
}

export async function readAnkiCollection(anki: SQLiteDatabase): Promise<AnkiCollection> {
  const hasTable = async (name: string) =>
    !!(await anki.getFirstAsync(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`, name));
  if (!(await hasTable('notes')) || !(await hasTable('col'))) throw new ImportError(t('import.notCollection'));

  const col = await anki.getFirstAsync<{ crt: number; models: string; decks: string }>('SELECT crt, models, decks FROM col');
  const models = new Map<number, AnkiModel>();
  const decks = new Map<number, string>();

  if (await hasTable('notetypes')) {
    // Newer Anki (schema 18): note types, templates and decks have their own tables.
    // A note type's settings are a protobuf blob; field 1 is its kind (1 = cloze).
    const types = await anki.getAllAsync<{ id: number; name: string; config: Uint8Array }>('SELECT id, name, config FROM notetypes');
    const templates = await anki.getAllAsync<{ ntid: number; n: number }>('SELECT ntid, COUNT(*) AS n FROM templates GROUP BY ntid');
    const tmplCount = new Map(templates.map((t) => [t.ntid, t.n]));
    for (const t of types) {
      models.set(t.id, {
        name: t.name,
        kind: protobufVarint(new Uint8Array(t.config), 1) === 1 ? 'cloze' : 'standard',
        templateCount: tmplCount.get(t.id) ?? 1,
      });
    }
    for (const d of await anki.getAllAsync<{ id: number; name: string }>('SELECT id, name FROM decks')) decks.set(d.id, d.name);
  } else {
    // Older Anki: note types and decks are JSON inside the single `col` row.
    const json = JSON.parse(col?.models || '{}') as Record<string, { name: string; type: number; tmpls: unknown[] }>;
    for (const [id, m] of Object.entries(json)) {
      models.set(Number(id), { name: m.name, kind: m.type === 1 ? 'cloze' : 'standard', templateCount: m.tmpls?.length ?? 1 });
    }
    for (const [id, d] of Object.entries(JSON.parse(col?.decks || '{}') as Record<string, { name: string }>)) decks.set(Number(id), d.name);
  }

  const cardColumns = (await anki.getAllAsync<{ name: string }>('PRAGMA table_info(cards)')).map((c) => c.name);
  const data = cardColumns.includes('data') ? 'data' : `'' AS data`;

  return {
    crt: col?.crt ?? 0,
    models,
    decks,
    notes: await anki.getAllAsync<AnkiNote>('SELECT id, mid, tags, flds FROM notes ORDER BY id'),
    cards: await anki.getAllAsync<AnkiCard>(`SELECT nid, did, ord, type, due, ivl, factor, reps, lapses, ${data} FROM cards`),
  };
}

export type ImportSummary = { deckIds: number[]; notes: number; cards: number };

/**
 * Saves imported decks in one transaction: a problem halfway leaves no
 * half-imported deck behind. Pass `intoDeckId` to add everything to an existing deck.
 */
export async function saveImportedDecks(db: SQLiteDatabase, decks: ImportedDeck[], intoDeckId?: number): Promise<ImportSummary> {
  const now = new Date();
  const summary: ImportSummary = { deckIds: [], notes: 0, cards: 0 };
  await db.withTransactionAsync(async () => {
    for (const deck of decks) {
      if (!deck.notes.length) continue;
      const deckId = intoDeckId ?? (await createDeck(db, deck.name, 'albums-outline', 'orange'));
      if (!summary.deckIds.includes(deckId)) summary.deckIds.push(deckId);
      for (const { note, tags, schedule } of deck.notes) {
        const { cardIds, ords } = await createNote(db, deckId, note, tags, now);
        for (const [i, ord] of ords.entries()) {
          const s = schedule.get(ord);
          if (s) await setCardSchedule(db, cardIds[i], s, now.getTime());
        }
        summary.notes++;
        summary.cards += cardIds.length;
      }
    }
  });
  return summary;
}

/** Copies a bundled starter deck (src/data/starterDecks.ts) into a new deck. Returns its id. */
export async function addStarterDeck(db: SQLiteDatabase, deck: StarterDeck): Promise<number> {
  let deckId = 0;
  const now = new Date();
  await db.withTransactionAsync(async () => {
    deckId = await createDeck(db, deck.name, deck.icon, deck.tone, deck.description);
    for (const { note, tags } of deck.notes) await createNote(db, deckId, note, tags ?? [], now);
  });
  return deckId;
}
