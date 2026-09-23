import type { SQLiteDatabase } from 'expo-sqlite';
import type { RecordLogItem } from 'ts-fsrs';

import { daysUntil, examPace, type Pace } from '@/lib/exam';
import { fsrsCardToRow, newCardColumns, State, type FsrsColumns } from '@/lib/fsrs';
import { cardOrds, type NoteData } from '@/lib/notes';
import { addDays, bestStreak, currentStreak, forecast, startOfDay, type ForecastDay } from '@/lib/stats';
import type { Tone } from '@/theme';

/** Default daily limit of brand-new cards per deck (Anki's default). */
export const DEFAULT_NEW_CARDS_PER_DAY = 20;

/** A card counts as "mastered" once FSRS expects you to recall it for 3+ weeks. */
export const MASTERED_STABILITY_DAYS = 21;

// ─── Types ──────────────────────────────────────────────────────────────────

export type Deck = {
  id: number;
  name: string;
  description: string;
  icon: string; // Ionicons glyph name
  tone: Tone;
  exam_date: string | null; // "YYYY-MM-DD"
  new_per_day: number | null; // overrides the global daily new-card limit
  created_at: number;
};

export type NoteRow = {
  id: number;
  deck_id: number;
  type: string;
  fields: string; // JSON — use parseNote() from src/lib/notes.ts
  tags: string; // space-separated
  created_at: number;
  updated_at: number;
};

/** A card joined with its note: everything the Study screen needs. */
export type StudyCard = FsrsColumns & {
  id: number;
  note_id: number;
  ord: number;
  flagged: number; // SQLite has no boolean: 0 or 1
  created_at: number;
  updated_at: number;
  deck_id: number;
  note_type: string;
  fields: string;
  tags: string;
};

/** A note in the deck page list, with a summary of its cards. */
export type NoteListItem = NoteRow & {
  card_count: number;
  all_new: number; // 1 if none of its cards have been studied
  next_due: number | null; // soonest due date among studied cards
  any_flagged: number;
};

export type DeckSummary = Deck & {
  total: number;
  mastered: number;
  newTotal: number; // every new card in the deck (not limited to today)
  newLimit: number; // this deck's new cards per day
  newCount: number; // new cards available today (after the daily limit)
  learningCount: number; // Learning + Relearning cards due now
  reviewCount: number; // Review cards due now
  /** Exam pacing, when the deck has an exam date. */
  pace: Pace | null;
};

/** Every card query joins its note, so a card knows its deck, type and content. */
const CARD_SELECT = `SELECT c.*, n.deck_id, n.type AS note_type, n.fields, n.tags
                       FROM cards c JOIN notes n ON n.id = c.note_id`;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** deck_id -> how many new cards were studied for the first time today. */
async function newCardsIntroducedToday(db: SQLiteDatabase, now: Date) {
  const rows = await db.getAllAsync<{ deck_id: number; n: number }>(
    `SELECT n.deck_id, COUNT(DISTINCT rl.card_id) AS n
       FROM review_logs rl JOIN cards c ON c.id = rl.card_id JOIN notes n ON n.id = c.note_id
      WHERE rl.state = ? AND rl.review >= ?
      GROUP BY n.deck_id`,
    State.New,
    startOfDay(now).getTime(),
  );
  return new Map(rows.map((r) => [r.deck_id, r.n]));
}

// ─── Decks ──────────────────────────────────────────────────────────────────

export async function getDecks(db: SQLiteDatabase) {
  return db.getAllAsync<Deck>('SELECT * FROM decks ORDER BY created_at, id');
}

export async function getDeck(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Deck>('SELECT * FROM decks WHERE id = ?', id);
}

export async function getDeckSummaries(
  db: SQLiteDatabase,
  newPerDay = DEFAULT_NEW_CARDS_PER_DAY,
  now = new Date(),
): Promise<DeckSummary[]> {
  const t = now.getTime();
  const rows = await db.getAllAsync<Deck & { total: number; mastered: number; new_all: number; learning: number; review: number }>(
    `SELECT d.*,
            COUNT(c.id)                                                                               AS total,
            COALESCE(SUM(c.state = ${State.Review} AND c.stability >= ${MASTERED_STABILITY_DAYS}), 0) AS mastered,
            COALESCE(SUM(c.state = ${State.New}), 0)                                                  AS new_all,
            COALESCE(SUM(c.state IN (${State.Learning}, ${State.Relearning}) AND c.due <= ?), 0)       AS learning,
            COALESCE(SUM(c.state = ${State.Review} AND c.due <= ?), 0)                                 AS review
       FROM decks d
       LEFT JOIN notes n ON n.deck_id = d.id
       LEFT JOIN cards c ON c.note_id = n.id
      GROUP BY d.id
      ORDER BY d.created_at, d.id`,
    t,
    t,
  );
  const introduced = await newCardsIntroducedToday(db, now);
  return rows.map(({ new_all, learning, review, ...deck }) => {
    const newLimit = deck.new_per_day ?? newPerDay;
    return {
      ...deck,
      newTotal: new_all,
      newLimit,
      newCount: Math.min(new_all, Math.max(0, newLimit - (introduced.get(deck.id) ?? 0))),
      learningCount: learning,
      reviewCount: review,
      pace: deck.exam_date
        ? examPace({ daysLeft: daysUntil(deck.exam_date, now), newRemaining: new_all, newPerDay: newLimit })
        : null,
    };
  });
}

export async function createDeck(db: SQLiteDatabase, name: string, icon = 'albums-outline', tone: Tone = 'orange', description = '') {
  const result = await db.runAsync(
    'INSERT INTO decks (name, description, icon, tone, created_at) VALUES (?, ?, ?, ?, ?)',
    name,
    description,
    icon,
    tone,
    Date.now(),
  );
  return result.lastInsertRowId;
}

export async function updateDeck(db: SQLiteDatabase, id: number, name: string, icon: string, tone: Tone) {
  await db.runAsync('UPDATE decks SET name = ?, icon = ?, tone = ? WHERE id = ?', name, icon, tone, id);
}

/** Exam date ("YYYY-MM-DD" or null) and this deck's new cards per day (null = use the global setting). */
export async function setDeckStudyPlan(db: SQLiteDatabase, id: number, examDate: string | null, newPerDay: number | null) {
  await db.runAsync('UPDATE decks SET exam_date = ?, new_per_day = ? WHERE id = ?', examDate, newPerDay, id);
}

export async function setDeckNewPerDay(db: SQLiteDatabase, id: number, newPerDay: number | null) {
  await db.runAsync('UPDATE decks SET new_per_day = ? WHERE id = ?', newPerDay, id);
}

/** Also deletes the deck's notes, their cards and review logs (ON DELETE CASCADE). */
export async function deleteDeck(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM decks WHERE id = ?', id);
}

export async function countCardsInDeck(db: SQLiteDatabase, id: number) {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM cards c JOIN notes n ON n.id = c.note_id WHERE n.deck_id = ?',
    id,
  );
  return row?.n ?? 0;
}

// ─── Notes ──────────────────────────────────────────────────────────────────

export async function getNote(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<NoteRow>('SELECT * FROM notes WHERE id = ?', id);
}

/**
 * Notes in a deck, newest first. `query` matches any text field or tag —
 * json_each() looks inside the JSON so searching "front" doesn't match every note.
 */
export async function searchNotes(db: SQLiteDatabase, deckId: number, query = '') {
  const q = `%${query.trim()}%`;
  return db.getAllAsync<NoteListItem>(
    `SELECT n.*,
            COUNT(c.id)                                        AS card_count,
            MIN(c.state = ${State.New})                        AS all_new,
            MIN(CASE WHEN c.state != ${State.New} THEN c.due END) AS next_due,
            MAX(c.flagged)                                     AS any_flagged
       FROM notes n LEFT JOIN cards c ON c.note_id = n.id
      WHERE n.deck_id = ?
        AND (n.tags LIKE ? OR EXISTS (SELECT 1 FROM json_each(n.fields) f WHERE f.type = 'text' AND f.value LIKE ?))
      GROUP BY n.id
      ORDER BY n.created_at DESC, n.id DESC`,
    deckId,
    q,
    q,
  );
}

/** Insert a note and one new card per `cardOrds(note)`. Returns the card ids in ord order. */
export async function createNote(db: SQLiteDatabase, deckId: number, note: NoteData, tags: string[] = [], now = new Date()) {
  const t = now.getTime();
  const result = await db.runAsync(
    'INSERT INTO notes (deck_id, type, fields, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    deckId,
    note.type,
    JSON.stringify(note.fields),
    tags.join(' '),
    t,
    t,
  );
  const noteId = result.lastInsertRowId;
  const cardIds: number[] = [];
  for (const ord of cardOrds(note)) cardIds.push(await insertNewCard(db, noteId, ord, now));
  return { noteId, cardIds };
}

/**
 * Save edits and bring the note's cards in line with its content: e.g. ticking
 * "reversed" adds a card; deleting {{c2::…}} removes cloze 2's card.
 * Surviving cards keep their scheduling. Returns how many cards were added/removed.
 */
export async function updateNote(db: SQLiteDatabase, id: number, deckId: number, note: NoteData, tags: string[] = []) {
  const now = new Date();
  const wanted = new Set(cardOrds(note));
  let added = 0;
  let removed = 0;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE notes SET deck_id = ?, type = ?, fields = ?, tags = ?, updated_at = ? WHERE id = ?',
      deckId,
      note.type,
      JSON.stringify(note.fields),
      tags.join(' '),
      now.getTime(),
      id,
    );
    const existing = await db.getAllAsync<{ id: number; ord: number }>('SELECT id, ord FROM cards WHERE note_id = ?', id);
    for (const c of existing) {
      if (!wanted.has(c.ord)) {
        await db.runAsync('DELETE FROM cards WHERE id = ?', c.id);
        removed++;
      }
    }
    const have = new Set(existing.map((c) => c.ord));
    for (const ord of wanted) {
      if (!have.has(ord)) {
        await insertNewCard(db, id, ord, now);
        added++;
      }
    }
  });
  return { added, removed };
}

/** How many existing cards an edit would delete (so the editor can warn first). */
export async function cardsRemovedBy(db: SQLiteDatabase, id: number, note: NoteData) {
  const wanted = new Set(cardOrds(note));
  const existing = await db.getAllAsync<{ ord: number }>('SELECT ord FROM cards WHERE note_id = ?', id);
  return existing.filter((c) => !wanted.has(c.ord)).length;
}

/** Also deletes its cards and their review logs. */
export async function deleteNote(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}

async function insertNewCard(db: SQLiteDatabase, noteId: number, ord: number, now: Date) {
  const f = newCardColumns(now);
  const result = await db.runAsync(
    `INSERT INTO cards
       (note_id, ord, created_at, updated_at,
        due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    noteId, ord, now.getTime(), now.getTime(),
    f.due, f.stability, f.difficulty, f.elapsed_days, f.scheduled_days, f.learning_steps,
    f.reps, f.lapses, f.state, f.last_review,
  );
  return result.lastInsertRowId;
}

// ─── Cards ──────────────────────────────────────────────────────────────────

export async function getCardsByIds(db: SQLiteDatabase, ids: number[]) {
  if (!ids.length) return [];
  return db.getAllAsync<StudyCard>(`${CARD_SELECT} WHERE c.id IN (${ids.map(() => '?').join(',')})`, ...ids);
}

export async function setCardFlagged(db: SQLiteDatabase, id: number, flagged: boolean) {
  await db.runAsync('UPDATE cards SET flagged = ? WHERE id = ?', flagged ? 1 : 0, id);
}

/** Overwrite a card's FSRS state (undo, the sample-deck seed). */
export async function setCardSchedule(db: SQLiteDatabase, id: number, c: FsrsColumns, updatedAt = Date.now()) {
  await db.runAsync(
    `UPDATE cards SET
       due = ?, stability = ?, difficulty = ?, elapsed_days = ?, scheduled_days = ?,
       learning_steps = ?, reps = ?, lapses = ?, state = ?, last_review = ?, updated_at = ?
     WHERE id = ?`,
    c.due, c.stability, c.difficulty, c.elapsed_days, c.scheduled_days,
    c.learning_steps, c.reps, c.lapses, c.state, c.last_review, updatedAt,
    id,
  );
}

// ─── Studying ───────────────────────────────────────────────────────────────

/**
 * Cards to study right now, in order: learning cards (short, time-sensitive
 * steps) first, then due reviews, then new cards up to the daily limit.
 * New cards are ordered by `ord` first, so every note's forward card comes
 * before any reversed card — you won't see "word → meaning" then immediately
 * "meaning → word". Pass `deckId = null` to study every deck.
 */
export async function getStudyQueue(
  db: SQLiteDatabase,
  deckId: number | null,
  newPerDay = DEFAULT_NEW_CARDS_PER_DAY,
  now = new Date(),
) {
  const t = now.getTime();
  const deckFilter = deckId == null ? '' : 'AND n.deck_id = ?';
  const deckArg = deckId == null ? [] : [deckId];

  const due = await db.getAllAsync<StudyCard>(
    `${CARD_SELECT}
      WHERE c.state != ${State.New} AND c.due <= ? ${deckFilter}
      ORDER BY CASE WHEN c.state = ${State.Review} THEN 1 ELSE 0 END, c.due`,
    t,
    ...deckArg,
  );

  const introduced = await newCardsIntroducedToday(db, now);
  const decks = (await getDecks(db)).filter((d) => deckId == null || d.id === deckId);
  const fresh: StudyCard[] = [];
  for (const { id, new_per_day } of decks) {
    const remaining = Math.max(0, (new_per_day ?? newPerDay) - (introduced.get(id) ?? 0));
    if (remaining === 0) continue;
    fresh.push(
      ...(await db.getAllAsync<StudyCard>(
        `${CARD_SELECT} WHERE n.deck_id = ? AND c.state = ${State.New} ORDER BY c.ord, n.id LIMIT ?`,
        id,
        remaining,
      )),
    );
  }

  return [...due, ...fresh];
}

/**
 * Save a rating. `outcome` is the entry for the chosen grade from
 * `previewRatings()` — saving the exact preview the button showed means the
 * interval on the button is the interval you get (fuzz is time-seeded, so
 * recomputing a moment later could differ). Card + log are written atomically.
 * Returns the updated card and the new log's id (needed for undo).
 */
export async function recordReview(
  db: SQLiteDatabase,
  card: StudyCard,
  outcome: RecordLogItem,
  durationMs?: number,
): Promise<{ updated: StudyCard; logId: number }> {
  const { card: next, log } = outcome;
  const cols = fsrsCardToRow(next);
  const now = log.review;
  let logId = 0;

  await db.withTransactionAsync(async () => {
    await setCardSchedule(db, card.id, cols, now.getTime());
    const result = await db.runAsync(
      `INSERT INTO review_logs
         (card_id, rating, state, due, stability, difficulty, elapsed_days,
          last_elapsed_days, scheduled_days, learning_steps, review, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      card.id, log.rating, log.state, log.due.getTime(), log.stability, log.difficulty,
      log.elapsed_days, log.last_elapsed_days, log.scheduled_days, log.learning_steps,
      log.review.getTime(), durationMs ?? null,
    );
    logId = result.lastInsertRowId;
  });

  return { updated: { ...card, ...cols, updated_at: now.getTime() }, logId };
}

/** Undo a rating: put the card back exactly as it was and forget the log. */
export async function undoReview(db: SQLiteDatabase, before: StudyCard, logId: number) {
  await db.withTransactionAsync(async () => {
    await setCardSchedule(db, before.id, before, before.updated_at);
    await db.runAsync('DELETE FROM review_logs WHERE id = ?', logId);
  });
}

/** Turn every card back into a new card and clear the review history. */
export async function resetAllProgress(db: SQLiteDatabase) {
  const f = newCardColumns();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM review_logs');
    await db.runAsync(
      `UPDATE cards SET due = ?, stability = ?, difficulty = ?, elapsed_days = ?, scheduled_days = ?,
         learning_steps = ?, reps = ?, lapses = ?, state = ?, last_review = ?, updated_at = ?`,
      f.due, f.stability, f.difficulty, f.elapsed_days, f.scheduled_days,
      f.learning_steps, f.reps, f.lapses, f.state, f.last_review, now,
    );
  });
}

// ─── Stats for the Today screen ─────────────────────────────────────────────

/** Current streak for the Today pill: consecutive days with at least one review. */
export async function getStreak(db: SQLiteDatabase, now = new Date()) {
  const rows = await db.getAllAsync<{ day: string }>(
    `SELECT DISTINCT date(review / 1000, 'unixepoch', 'localtime') AS day FROM review_logs ORDER BY day DESC LIMIT 400`,
  );
  return currentStreak(new Set(rows.map((r) => r.day)), now);
}

/** Average answer time over recent reviews, for the "about 9 min" estimate. */
export async function getSecondsPerReview(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ avg: number | null; n: number }>(
    `SELECT AVG(MIN(duration_ms, 60000)) AS avg, COUNT(*) AS n
       FROM (SELECT duration_ms FROM review_logs WHERE duration_ms IS NOT NULL ORDER BY id DESC LIMIT 200)`,
  );
  // Until there's some history, assume ~10 s per card. Cap outliers (phone left open) at 60 s.
  return row && row.n >= 10 && row.avg ? row.avg / 1000 : 10;
}

// ─── Progress screen ────────────────────────────────────────────────────────

/** Retention looks at this many recent days. */
export const RETENTION_WINDOW_DAYS = 30;

export type Progress = {
  totalReviews: number;
  bestStreak: number;
  /** Share of recent reviews of review-state cards not rated Again; null with no data yet. */
  retention: number | null;
  retentionSample: number;
  /** "YYYY-MM-DD" → reviews that day (all time). */
  dailyReviews: Map<string, number>;
  forecast: ForecastDay[];
};

/** Everything the Progress screen shows. `deckId = null` means all decks. */
export async function getProgress(db: SQLiteDatabase, deckId: number | null, now = new Date()): Promise<Progress> {
  const deckJoin = 'JOIN cards c ON c.id = rl.card_id JOIN notes n ON n.id = c.note_id';
  const deckWhere = deckId == null ? '' : 'AND n.deck_id = ?';
  const deckArg = deckId == null ? [] : [deckId];

  // 1. Reviews per local day, all time: gives the total, best streak and the heatmap.
  const days = await db.getAllAsync<{ day: string; n: number }>(
    `SELECT date(rl.review / 1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS n
       FROM review_logs rl ${deckJoin}
      WHERE 1 ${deckWhere}
      GROUP BY day`,
    ...deckArg,
  );

  // 2. Retention: reviews of cards that were already in Review state (not learning
  //    steps or brand-new cards) in the last 30 days, passed = anything but Again.
  const since = addDays(startOfDay(now), -RETENTION_WINDOW_DAYS).getTime();
  const ret = await db.getFirstAsync<{ total: number; passed: number | null }>(
    `SELECT COUNT(*) AS total, SUM(rl.rating > 1) AS passed
       FROM review_logs rl ${deckJoin}
      WHERE rl.state = ${State.Review} AND rl.review >= ? ${deckWhere}`,
    since,
    ...deckArg,
  );

  // 3. Forecast: due times of studied cards up to the end of day 7 (overdue ones included).
  const horizon = addDays(startOfDay(now), 7).getTime();
  const due = await db.getAllAsync<{ due: number }>(
    `SELECT c.due FROM cards c JOIN notes n ON n.id = c.note_id
      WHERE c.state != ${State.New} AND c.due < ? ${deckWhere}`,
    horizon,
    ...deckArg,
  );

  const total = ret?.total ?? 0;
  return {
    totalReviews: days.reduce((sum, d) => sum + d.n, 0),
    bestStreak: bestStreak(days.map((d) => d.day)),
    retention: total ? (ret?.passed ?? 0) / total : null,
    retentionSample: total,
    dailyReviews: new Map(days.map((d) => [d.day, d.n])),
    forecast: forecast(due.map((d) => d.due), now),
  };
}
