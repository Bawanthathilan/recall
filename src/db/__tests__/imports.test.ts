/**
 * @jest-environment node
 *
 * Builds small Anki collections in both schemas (old JSON-in-`col`, and the
 * newer notetypes/templates tables), then imports them into a Recall database.
 */
import { zipSync } from 'fflate';

import { readAnkiCollection, saveImportedDecks } from '@/db/imports';
import { migrateDbIfNeeded } from '@/db/schema';
import { openTestDb } from '@/db/testing/openTestDb';
import { convertCollection, extractCollection, ImportError, protobufVarint } from '@/lib/anki';

// Only readApkg() uses expo-sqlite itself (to open the unzipped file); tests pass databases in directly.
jest.mock('expo-sqlite', () => ({}));

const CRT = Date.UTC(2025, 0, 1) / 1000;
const DAY_S = 86_400;

/** Tables both schemas share. */
function ankiTables(raw: ReturnType<typeof openTestDb>['raw']) {
  raw.exec(`
    CREATE TABLE notes (id INTEGER PRIMARY KEY, guid TEXT, mid INTEGER, mod INTEGER, usn INTEGER, tags TEXT, flds TEXT, sfld TEXT, csum INTEGER, flags INTEGER, data TEXT);
    CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER, mod INTEGER, usn INTEGER, type INTEGER, queue INTEGER,
                        due INTEGER, ivl INTEGER, factor INTEGER, reps INTEGER, lapses INTEGER, left INTEGER, odue INTEGER, odid INTEGER, flags INTEGER, data TEXT);
  `);
  const note = raw.prepare(`INSERT INTO notes (id, mid, tags, flds) VALUES (?, ?, ?, ?)`);
  const card = raw.prepare(`INSERT INTO cards (nid, did, ord, type, due, ivl, factor, reps, lapses, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  // Basic + reversed, with the forward card in review (due 400 days after crt, 30-day interval).
  note.run(1, 100, ' spanish animals ', 'cat\x1f<b>gato</b>');
  card.run(1, 10, 0, 2, 400, 30, 2500, 5, 1, '');
  card.run(1, 10, 1, 0, 1, 0, 0, 0, 0, '');
  // Cloze with two deletions; card for c2 reviewed with Anki's FSRS memory state.
  note.run(2, 200, '', 'The {{c1::mitochondria}} makes {{c2::ATP}}<img src="cell.png">\x1fBiology 101');
  card.run(2, 11, 0, 0, 2, 0, 0, 0, 0, '');
  card.run(2, 11, 1, 2, 410, 12, 2300, 3, 0, '{"s":15.5,"d":6.2}');
  // Only an image: nothing to show.
  note.run(3, 100, '', '<img src="x.png">\x1f');
  card.run(3, 10, 0, 0, 3, 0, 0, 0, 0, '');
}

function legacyCollection() {
  const { raw, db } = openTestDb();
  raw.exec(`CREATE TABLE col (id INTEGER PRIMARY KEY, crt INTEGER, models TEXT, decks TEXT)`);
  raw.prepare(`INSERT INTO col VALUES (1, ?, ?, ?)`).run(
    CRT,
    JSON.stringify({ 100: { name: 'Basic (and reversed card)', type: 0, tmpls: [{}, {}] }, 200: { name: 'Cloze', type: 1, tmpls: [{}] } }),
    JSON.stringify({ 10: { name: 'Languages::Spanish' }, 11: { name: 'Science' } }),
  );
  ankiTables(raw);
  return db;
}

function modernCollection() {
  const { raw, db } = openTestDb();
  raw.exec(`
    CREATE TABLE col (id INTEGER PRIMARY KEY, crt INTEGER, models TEXT, decks TEXT);
    CREATE TABLE notetypes (id INTEGER PRIMARY KEY, name TEXT, config BLOB);
    CREATE TABLE templates (ntid INTEGER, ord INTEGER, name TEXT);
    CREATE TABLE decks (id INTEGER PRIMARY KEY, name TEXT);
  `);
  raw.prepare(`INSERT INTO col VALUES (1, ?, '', '')`).run(CRT);
  // Protobuf: field 3 (css, a string) comes first, then field 1 = kind.
  const cloze = new Uint8Array([0x1a, 0x02, 0x61, 0x62, 0x08, 0x01]);
  raw.prepare(`INSERT INTO notetypes VALUES (100, 'Basic (and reversed card)', ?), (200, 'Cloze', ?)`).run(new Uint8Array([0x1a, 0x00]), cloze);
  raw.exec(`INSERT INTO templates VALUES (100, 0, 'Card 1'), (100, 1, 'Card 2'), (200, 0, 'Cloze');
            INSERT INTO decks VALUES (10, 'Languages\x1fSpanish'), (11, 'Science');`);
  ankiTables(raw);
  return db;
}

describe.each([
  ['older Anki', legacyCollection],
  ['newer Anki', modernCollection],
])('importing from %s', (_label, make) => {
  it('converts note types, decks, tags and formatting', async () => {
    const result = convertCollection(await readAnkiCollection(make()), { keepProgress: true });
    expect(result.skipped).toBe(1); // the image-only note
    expect(result.lostMedia).toBe(1);
    expect(result.decks.map((d) => d.name)).toEqual(['Languages › Spanish', 'Science']);

    const [spanish, science] = result.decks;
    expect(spanish.notes[0]).toMatchObject({ note: { type: 'basic', fields: { front: 'cat', back: '**gato**', reverse: true } }, tags: ['spanish', 'animals'] });
    expect(science.notes[0].note).toEqual({ type: 'cloze', fields: { text: 'The {{c1::mitochondria}} makes {{c2::ATP}}', extra: 'Biology 101' } });
  });

  it('keeps review progress, using Anki’s FSRS state when it has one', async () => {
    const result = convertCollection(await readAnkiCollection(make()), { keepProgress: true });
    const basic = result.decks[0].notes[0].schedule;
    expect([...basic.keys()]).toEqual([0]); // only the reviewed forward card
    expect(basic.get(0)).toMatchObject({ state: 2, stability: 30, difficulty: 5, reps: 5, lapses: 1, due: (CRT + 400 * DAY_S) * 1000 });

    const cloze = result.decks[1].notes[0].schedule;
    expect(cloze.get(2)).toMatchObject({ stability: 15.5, difficulty: 6.2 }); // Anki card ord 1 = cloze 2
    expect(cloze.has(1)).toBe(false);
  });
});

it('saves imported decks, with progress, into Recall', async () => {
  const { raw, db } = openTestDb();
  await migrateDbIfNeeded(db);
  const result = convertCollection(await readAnkiCollection(legacyCollection()), { keepProgress: true });
  const summary = await saveImportedDecks(db, result.decks);

  expect(summary).toMatchObject({ notes: 2, cards: 4 }); // basic + reversed, two clozes
  expect(raw.prepare(`SELECT name FROM decks WHERE id IN (${summary.deckIds.join(',')}) ORDER BY id`).all()).toEqual([
    { name: 'Languages › Spanish' },
    { name: 'Science' },
  ]);
  const reviewed = raw
    .prepare(`SELECT c.ord, c.state, c.stability FROM cards c JOIN notes n ON n.id = c.note_id WHERE n.deck_id IN (${summary.deckIds.join(',')}) AND c.state = 2 ORDER BY c.ord`)
    .all();
  expect(reviewed).toEqual([
    { ord: 0, state: 2, stability: 30 },
    { ord: 2, state: 2, stability: 15.5 },
  ]);
});

it('can start everything fresh instead', async () => {
  const result = convertCollection(await readAnkiCollection(legacyCollection()), { keepProgress: false });
  expect(result.decks.every((d) => d.notes.every((n) => n.schedule.size === 0))).toBe(true);
});

describe('extractCollection', () => {
  it('finds the collection inside the zip', () => {
    const db = new Uint8Array([1, 2, 3]);
    expect(extractCollection(zipSync({ 'collection.anki2': db, media: new Uint8Array([123, 125]) }))).toEqual(db);
  });
  it('explains when the file isn’t an Anki deck', () => {
    expect(() => extractCollection(new Uint8Array([1, 2, 3]))).toThrow(ImportError);
  });
});

it('reads a varint field from a protobuf message', () => {
  expect(protobufVarint(new Uint8Array([0x1a, 0x02, 0x61, 0x62, 0x08, 0x01]), 1)).toBe(1);
  expect(protobufVarint(new Uint8Array([0x10, 0x96, 0x01]), 2)).toBe(150);
  expect(protobufVarint(new Uint8Array([]), 1)).toBeNull();
});
