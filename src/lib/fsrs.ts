import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
  type RecordLogItem,
} from 'ts-fsrs';

import { t } from '@/i18n';

export { Rating, State };
export type { Grade };

/**
 * One shared scheduler. `enable_fuzz` adds a little randomness to long
 * intervals so cards added together don't all come due on the same day.
 */
export const scheduler = fsrs({ enable_fuzz: true, request_retention: 0.9 });

/** The FSRS columns of a `cards` row, as stored in SQLite (dates = unix ms). */
export type FsrsColumns = {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: number | null;
};

export function rowToFsrsCard(row: FsrsColumns): FsrsCard {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review != null ? new Date(row.last_review) : undefined,
  };
}

export function fsrsCardToRow(card: FsrsCard): FsrsColumns {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.getTime() : null,
  };
}

/** FSRS columns for a brand-new card, due now. */
export function newCardColumns(now = new Date()): FsrsColumns {
  return fsrsCardToRow(createEmptyCard(now));
}

export const GRADES: readonly Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

export type Preview = Record<Grade, RecordLogItem>;

/** What would happen for each of the four ratings — used to label the buttons. */
export function previewRatings(row: FsrsColumns, now = new Date()): Preview {
  const preview = scheduler.repeat(rowToFsrsCard(row), now);
  return {
    [Rating.Again]: preview[Rating.Again],
    [Rating.Hard]: preview[Rating.Hard],
    [Rating.Good]: preview[Rating.Good],
    [Rating.Easy]: preview[Rating.Easy],
  };
}

/** Human label for "how long until I see this again", e.g. "10 min", "2 days", "3 mo". */
export function formatInterval(due: Date, now = new Date()): string {
  const minutes = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60000));
  if (minutes < 60) return t('interval.minutes', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('interval.hours', { count: hours });
  const days = Math.round(hours / 24);
  if (days < 30) return t('common.days', { count: days });
  if (days < 365) return t('interval.months', { count: +(days / 30).toFixed(1) });
  return t('interval.years', { count: +(days / 365).toFixed(1) });
}
