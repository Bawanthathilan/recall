/**
 * @jest-environment node
 */
import { BackupError, createBackup, parseBackup, restoreBackup } from '@/db/backup';
import { createDeck, recordReview } from '@/db/queries';
import { migrateDbIfNeeded } from '@/db/schema';
import { openTestDb } from '@/db/testing/openTestDb';
import { Rating, rowToFsrsCard, scheduler } from '@/lib/fsrs';

async function freshDb() {
  const t = openTestDb();
  await migrateDbIfNeeded(t.db);
  return t;
}

const count = (raw: ReturnType<typeof openTestDb>['raw'], table: string) =>
  (raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe('backup and restore', () => {
  it('round-trips decks, notes, scheduling and review history through JSON', async () => {
    const a = await freshDb();
    // Review one card so there's a log and a changed schedule to carry over.
    const card = a.raw.prepare(`SELECT c.*, n.deck_id FROM cards c JOIN notes n ON n.id = c.note_id LIMIT 1`).get() as never;
    const now = new Date();
    await recordReview(a.db, card, scheduler.next(rowToFsrsCard(card), now, Rating.Good), 4000);
    const before = a.raw.prepare('SELECT * FROM cards ORDER BY id').all();

    const json = JSON.stringify(await createBackup(a.db));

    const b = await freshDb();
    await createDeck(b.db, 'Will be replaced');
    await restoreBackup(b.db, parseBackup(json));

    expect(b.raw.prepare('SELECT * FROM cards ORDER BY id').all()).toEqual(before);
    expect(count(b.raw, 'decks')).toBe(count(a.raw, 'decks'));
    expect(count(b.raw, 'notes')).toBe(count(a.raw, 'notes'));
    expect(count(b.raw, 'review_logs')).toBe(1);
    expect(b.raw.prepare(`SELECT COUNT(*) AS n FROM decks WHERE name = 'Will be replaced'`).get()).toEqual({ n: 0 });
  });

  it('rejects files that aren’t backups, or come from a newer app', async () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup('{"format":"something-else"}')).toThrow('isn’t a Cardly backup');
    const { db } = await freshDb();
    const future = { ...(await createBackup(db)), schema: 999 };
    expect(() => parseBackup(JSON.stringify(future))).toThrow('newer version');
  });

  it('leaves your data untouched when a backup is damaged', async () => {
    const a = await freshDb();
    const backup = await createBackup(a.db);
    backup.tables.cards.push({ ...backup.tables.cards[0], id: 9999, note_id: 12345 }); // points at a missing note

    const b = await freshDb();
    const decksBefore = count(b.raw, 'decks');
    await expect(restoreBackup(b.db, parseBackup(JSON.stringify(backup)))).rejects.toThrow();
    expect(count(b.raw, 'decks')).toBe(decksBefore);
  });
});
