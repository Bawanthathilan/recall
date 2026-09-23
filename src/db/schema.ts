import type { SQLiteDatabase } from 'expo-sqlite';

import { seedSampleDecks } from './seed';

export const DATABASE_NAME = 'recall.db';

/**
 * To change the schema, append a function here — never edit one that has shipped.
 * SQLite stores how many have run in `PRAGMA user_version`, so each one runs
 * exactly once per device. (Function declarations below are hoisted.)
 */
export const MIGRATIONS = [migrateToV1, migrateToV2, migrateToV3, migrateToV4];
const DATABASE_VERSION = MIGRATIONS.length;

/** Runs before any screen renders (passed to <SQLiteProvider onInit>). */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // WAL can't be switched on inside a transaction.
  await db.execAsync(`PRAGMA journal_mode = 'wal';`);

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < DATABASE_VERSION) {
    // Foreign keys OFF while migrating: rebuilding a table (drop + rename) would
    // otherwise cascade-delete every row that points at it — e.g. all review logs.
    // This pragma is ignored inside a transaction, so it's set out here.
    await db.execAsync('PRAGMA foreign_keys = OFF;');

    // All-or-nothing: if the app dies mid-migration, SQLite rolls every step back
    // and the next launch retries cleanly instead of hitting "duplicate column".
    await db.withTransactionAsync(async () => {
      for (let v = version; v < DATABASE_VERSION; v++) await MIGRATIONS[v](db);

      // Refuse to commit if anything now points at a row that doesn't exist.
      const broken = await db.getAllAsync('PRAGMA foreign_key_check');
      if (broken.length) throw new Error(`Migration left ${broken.length} broken references`);

      // Seed after *all* migrations, so it can rely on the latest schema.
      if (version === 0) await seedSampleDecks(db);

      await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    });
  }

  // Foreign keys are off by default in SQLite and must be enabled per connection.
  await db.execAsync('PRAGMA foreign_keys = ON;');
}

async function migrateToV1(db: SQLiteDatabase) {
  await db.execAsync(`
      CREATE TABLE decks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        description TEXT    NOT NULL DEFAULT '',
        color       TEXT    NOT NULL DEFAULT '#C2410C',
        created_at  INTEGER NOT NULL
      );

      -- One row per flashcard. The FSRS columns mirror ts-fsrs's Card type.
      -- Dates are unix milliseconds (INTEGER) so they sort and compare cheaply.
      CREATE TABLE cards (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        deck_id        INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        type           TEXT    NOT NULL DEFAULT 'basic',
        front          TEXT    NOT NULL,
        back           TEXT    NOT NULL,
        created_at     INTEGER NOT NULL,
        updated_at     INTEGER NOT NULL,

        due            INTEGER NOT NULL,
        stability      REAL    NOT NULL DEFAULT 0,
        difficulty     REAL    NOT NULL DEFAULT 0,
        elapsed_days   INTEGER NOT NULL DEFAULT 0,
        scheduled_days INTEGER NOT NULL DEFAULT 0,
        learning_steps INTEGER NOT NULL DEFAULT 0,
        reps           INTEGER NOT NULL DEFAULT 0,
        lapses         INTEGER NOT NULL DEFAULT 0,
        state          INTEGER NOT NULL DEFAULT 0, -- 0 New, 1 Learning, 2 Review, 3 Relearning
        last_review    INTEGER
      );
      CREATE INDEX idx_cards_deck_due ON cards (deck_id, due);

      -- Every rating you give. Not needed for scheduling today, but required
      -- later for stats, undo, and optimising FSRS parameters to your history.
      CREATE TABLE review_logs (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id           INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        rating            INTEGER NOT NULL, -- 1 Again, 2 Hard, 3 Good, 4 Easy
        state             INTEGER NOT NULL, -- card state *before* this review
        due               INTEGER NOT NULL,
        stability         REAL    NOT NULL,
        difficulty        REAL    NOT NULL,
        elapsed_days      INTEGER NOT NULL,
        last_elapsed_days INTEGER NOT NULL,
        scheduled_days    INTEGER NOT NULL,
        learning_steps    INTEGER NOT NULL,
        review            INTEGER NOT NULL, -- when the review happened
        duration_ms       INTEGER           -- time spent before answering
      );
      CREATE INDEX idx_review_logs_card ON review_logs (card_id, review);
  `);
}

/** Phase 2: deck icon tiles and flagged cards. ALTER TABLE keeps existing rows. */
async function migrateToV2(db: SQLiteDatabase) {
  await db.execAsync(`
    ALTER TABLE decks ADD COLUMN icon TEXT NOT NULL DEFAULT 'albums-outline';
    ALTER TABLE decks ADD COLUMN tone TEXT NOT NULL DEFAULT 'orange';
    ALTER TABLE decks DROP COLUMN color;
    ALTER TABLE cards ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0;
    UPDATE decks SET icon = 'code-slash', tone = 'blue' WHERE name = 'JavaScript Essentials';
  `);
}

/**
 * Phase 3: split content into notes. A note is what you write; its cards are
 * the ways you're tested on it (forward/reversed, one per cloze…).
 * Every existing card becomes a Basic note that reuses the card's id.
 */
async function migrateToV3(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id    INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      type       TEXT    NOT NULL DEFAULT 'basic', -- basic | cloze | code | vocab
      fields     TEXT    NOT NULL DEFAULT '{}',    -- JSON; shape depends on type (src/lib/notes.ts)
      tags       TEXT    NOT NULL DEFAULT '',      -- space-separated, like Anki
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX idx_notes_deck ON notes (deck_id);

    INSERT INTO notes (id, deck_id, type, fields, tags, created_at, updated_at)
      SELECT id, deck_id, 'basic', json_object('front', front, 'back', back, 'reverse', json('false')), '', created_at, updated_at
        FROM cards;

    -- SQLite can't drop columns that are in a foreign key or index, so the
    -- cards table is rebuilt: create new → copy → drop old → rename.
    CREATE TABLE cards_new (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id        INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      ord            INTEGER NOT NULL DEFAULT 0, -- 0 forward, 1 reversed, N = cloze N
      flagged        INTEGER NOT NULL DEFAULT 0,
      created_at     INTEGER NOT NULL,
      updated_at     INTEGER NOT NULL,

      due            INTEGER NOT NULL,
      stability      REAL    NOT NULL DEFAULT 0,
      difficulty     REAL    NOT NULL DEFAULT 0,
      elapsed_days   INTEGER NOT NULL DEFAULT 0,
      scheduled_days INTEGER NOT NULL DEFAULT 0,
      learning_steps INTEGER NOT NULL DEFAULT 0,
      reps           INTEGER NOT NULL DEFAULT 0,
      lapses         INTEGER NOT NULL DEFAULT 0,
      state          INTEGER NOT NULL DEFAULT 0,
      last_review    INTEGER,
      UNIQUE (note_id, ord)
    );
    INSERT INTO cards_new
        (id, note_id, ord, flagged, created_at, updated_at, due, stability, difficulty, elapsed_days,
         scheduled_days, learning_steps, reps, lapses, state, last_review)
      SELECT id, id, 0, flagged, created_at, updated_at, due, stability, difficulty, elapsed_days,
             scheduled_days, learning_steps, reps, lapses, state, last_review
        FROM cards;
    DROP TABLE cards;
    ALTER TABLE cards_new RENAME TO cards;
    CREATE INDEX idx_cards_note ON cards (note_id);
    CREATE INDEX idx_cards_due ON cards (due);
  `);
}

/**
 * Phase 4: exam deadlines. Both columns are optional (NULL = not set).
 * exam_date is a calendar day "YYYY-MM-DD" rather than a timestamp: an exam is
 * "on the 14th" wherever you are, so there's no time zone to get wrong.
 * new_per_day overrides the global daily limit for one deck (e.g. to hit an exam).
 */
async function migrateToV4(db: SQLiteDatabase) {
  await db.execAsync(`
    ALTER TABLE decks ADD COLUMN exam_date TEXT;
    ALTER TABLE decks ADD COLUMN new_per_day INTEGER;
  `);
}
