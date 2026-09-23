/**
 * @jest-environment node
 *
 * Runs the real migrations against a real SQLite database (Node's built-in
 * node:sqlite), through a tiny adapter with the same async API as expo-sqlite.
 */
import { cardsRemovedBy, createNote, getDeckSummaries, getProgress, getStudyQueue, searchNotes, updateNote } from '@/db/queries';
import { migrateDbIfNeeded, MIGRATIONS } from '@/db/schema';
import { openTestDb } from '@/db/testing/openTestDb';

describe('fresh install', () => {
  it('creates the latest schema and seeds sample decks of every type', async () => {
    const { raw, db } = openTestDb();
    await migrateDbIfNeeded(db);

    expect(raw.prepare('PRAGMA user_version').get()).toEqual({ user_version: MIGRATIONS.length });
    const types = raw.prepare('SELECT type, COUNT(*) AS n FROM notes GROUP BY type ORDER BY type').all();
    expect(types).toEqual([
      { type: 'basic', n: 14 },
      { type: 'cloze', n: 2 },
      { type: 'code', n: 1 },
      { type: 'vocab', n: 6 },
    ]);
    // 14 basic + 1 code + (2 + 3) cloze + 6 × 2 vocab (reversed)
    expect(raw.prepare('SELECT COUNT(*) AS n FROM cards').get()).toEqual({ n: 32 });
    expect(raw.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
  });
});

describe('upgrading a Phase 2 (v2) database', () => {
  it('turns each card into a basic note and keeps flags, scheduling and review history', async () => {
    const { raw, db } = openTestDb();
    await MIGRATIONS[0](db);
    await MIGRATIONS[1](db);
    raw.exec(`
      PRAGMA user_version = 2;
      INSERT INTO decks (id, name, icon, tone, created_at) VALUES (1, 'Old deck', 'code-slash', 'blue', 0);
      INSERT INTO cards (id, deck_id, front, back, created_at, updated_at, due, stability, state, reps, flagged)
        VALUES (7, 1, 'Q', 'A', 0, 0, 123, 30, 2, 5, 1);
      INSERT INTO review_logs (card_id, rating, state, due, stability, difficulty, elapsed_days, last_elapsed_days,
                               scheduled_days, learning_steps, review)
        VALUES (7, 3, 2, 123, 30, 5, 1, 1, 30, 0, 99);
    `);

    await migrateDbIfNeeded(db);

    expect(raw.prepare('SELECT id, deck_id, type, fields FROM notes').all()).toEqual([
      { id: 7, deck_id: 1, type: 'basic', fields: '{"front":"Q","back":"A","reverse":false}' },
    ]);
    expect(raw.prepare('SELECT id, note_id, ord, flagged, due, stability, state, reps FROM cards').all()).toEqual([
      { id: 7, note_id: 7, ord: 0, flagged: 1, due: 123, stability: 30, state: 2, reps: 5 },
    ]);
    expect(raw.prepare('SELECT card_id FROM review_logs').all()).toEqual([{ card_id: 7 }]);
    // No sample decks on upgrade — only on a fresh install.
    expect(raw.prepare('SELECT COUNT(*) AS n FROM decks').get()).toEqual({ n: 1 });
  });
});

describe('notes and their cards', () => {
  it('adds and removes cards when a note changes, keeping the rest', async () => {
    const { raw, db } = openTestDb();
    await migrateDbIfNeeded(db);
    const deck = Number((raw.prepare("SELECT id FROM decks WHERE name = 'Japanese Starter'").get() as { id: number }).id);

    const { noteId } = await createNote(db, deck, { type: 'basic', fields: { front: 'a', back: 'b', reverse: false } });
    const cardsOf = () => raw.prepare('SELECT ord FROM cards WHERE note_id = ? ORDER BY ord').all(noteId);
    expect(cardsOf()).toEqual([{ ord: 0 }]);

    await updateNote(db, noteId, deck, { type: 'basic', fields: { front: 'a', back: 'b', reverse: true } });
    expect(cardsOf()).toEqual([{ ord: 0 }, { ord: 1 }]);

    const unreversed = { type: 'basic' as const, fields: { front: 'a', back: 'b', reverse: false } };
    expect(await cardsRemovedBy(db, noteId, unreversed)).toBe(1);
    expect(await updateNote(db, noteId, deck, unreversed)).toEqual({ added: 0, removed: 1 });
    expect(cardsOf()).toEqual([{ ord: 0 }]);
  });

  it('searches field text and tags, not JSON keys', async () => {
    const { raw, db } = openTestDb();
    await migrateDbIfNeeded(db);
    const js = Number((raw.prepare("SELECT id FROM decks WHERE name = 'JavaScript Essentials'").get() as { id: number }).id);

    expect((await searchNotes(db, js, 'setTimeout')).map((n) => n.type)).toEqual(['code']);
    expect((await searchNotes(db, js, 'scope')).length).toBeGreaterThan(0); // tag
    expect(await searchNotes(db, js, 'explanation')).toEqual([]); // a JSON key, not content
  });

  it('shows forward cards before reversed ones, and counts match the queue', async () => {
    const { raw, db } = openTestDb();
    await migrateDbIfNeeded(db);
    const jp = Number((raw.prepare("SELECT id FROM decks WHERE name = 'Japanese Starter'").get() as { id: number }).id);

    const queue = await getStudyQueue(db, jp, 20);
    expect(queue.map((c) => c.ord)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
    const summary = (await getDeckSummaries(db, 20)).find((d) => d.id === jp)!;
    expect(summary.newCount).toBe(queue.length);
  });
});

describe('getProgress', () => {
  it('counts reviews, best streak and retention (review-state cards, last 30 days only)', async () => {
    const { raw, db } = openTestDb();
    await migrateDbIfNeeded(db);
    const now = new Date(2026, 8, 23, 12);
    const at = (daysAgo: number) => new Date(2026, 8, 23 - daysAgo, 9).getTime();
    const card = (raw.prepare('SELECT id FROM cards LIMIT 1').get() as { id: number }).id;
    const log = raw.prepare(
      `INSERT INTO review_logs (card_id, rating, state, due, stability, difficulty, elapsed_days, last_elapsed_days,
                                scheduled_days, learning_steps, review) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0, ?)`,
    );
    log.run(card, 3, 2, at(0)); // review, passed
    log.run(card, 1, 2, at(1)); // review, Again → counts against retention
    log.run(card, 3, 2, at(2)); // review, passed
    log.run(card, 1, 0, at(2)); // new card: excluded from retention
    log.run(card, 1, 2, at(40)); // too old for retention; still a review and a study day

    const p = await getProgress(db, null, now);
    expect(p.totalReviews).toBe(5);
    expect(p.bestStreak).toBe(3);
    expect(p.retentionSample).toBe(3);
    expect(p.retention).toBeCloseTo(2 / 3);
    expect(p.dailyReviews.get('2026-09-21')).toBe(2);
    expect(p.forecast).toHaveLength(7);
  });

  it('has no retention before any reviews', async () => {
    const { db } = openTestDb();
    await migrateDbIfNeeded(db);
    expect((await getProgress(db, null)).retention).toBeNull();
  });
});
