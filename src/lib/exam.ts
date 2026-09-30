/**
 * Exam pacing: will every new card be learned early enough to review it before
 * the exam? Pure functions, so they're easy to test.
 */
import { t } from '@/i18n';
import { startOfDay } from '@/lib/stats';

/** Whole calendar days from today to "YYYY-MM-DD" (0 = today, negative = past). */
export function daysUntil(examKey: string, today: Date) {
  const [y, m, d] = examKey.split('-').map(Number);
  // Round, not floor: a day with a clock change is 23 or 25 hours long.
  return Math.round((new Date(y, m - 1, d).getTime() - startOfDay(today).getTime()) / 86_400_000);
}

export type PaceStatus = 'on-track' | 'behind' | 'learned' | 'today' | 'past';

export type Pace = {
  status: PaceStatus;
  daysLeft: number;
  /** Short, for the deck row: "Exam in 12 days · on track". */
  label: string;
  /** One or two sentences for the pace card. */
  detail: string;
  /** New cards per day that would finish in time (only when behind). */
  suggestedPerDay?: number;
};

const days = (n: number) => t('common.days', { count: n });
const cards = (n: number) => t('common.cards', { count: n });

/**
 * Learn every new card by a "ready day" that leaves a review buffer before the
 * exam (up to 3 days, less when the exam is close), then check the daily rate.
 */
export function examPace({ daysLeft, newRemaining, newPerDay }: { daysLeft: number; newRemaining: number; newPerDay: number }): Pace {
  const when = daysLeft === 1 ? t('exam.tomorrow') : t('exam.inDays', { days: days(daysLeft) });

  if (daysLeft < 0) {
    return { status: 'past', daysLeft, label: t('exam.pastLabel'), detail: t('exam.pastDetail') };
  }
  if (daysLeft === 0) {
    return { status: 'today', daysLeft, label: t('exam.todayLabel'), detail: t('exam.todayDetail') };
  }
  if (newRemaining === 0) {
    return {
      status: 'learned',
      daysLeft,
      label: t('exam.learnedLabel', { when }),
      detail: t('exam.learnedDetail'),
    };
  }

  const buffer = Math.min(3, Math.floor(daysLeft / 4));
  const readyDays = Math.max(1, daysLeft - buffer);
  const daysNeeded = Math.ceil(newRemaining / Math.max(1, newPerDay));

  if (daysNeeded <= readyDays) {
    const spare = daysLeft - daysNeeded;
    return {
      status: 'on-track',
      daysLeft,
      label: t('exam.onTrackLabel', { when }),
      detail: spare > 0 ? t('exam.onTrackSpare', { perDay: newPerDay, days: days(spare) }) : t('exam.onTrackJust', { perDay: newPerDay }),
    };
  }

  const leftOver = newRemaining - newPerDay * readyDays;
  const suggestedPerDay = Math.ceil(newRemaining / readyDays);
  return {
    status: 'behind',
    daysLeft,
    label: t('exam.behindLabel', { when }),
    detail:
      t('exam.behindDetail', { perDay: newPerDay, cards: cards(leftOver) }) +
      ' ' +
      (buffer > 0
        ? t('exam.behindBuffer', { perDay: suggestedPerDay, days: days(buffer) })
        : t('exam.behindInTime', { perDay: suggestedPerDay })),
    suggestedPerDay,
  };
}

// ─── Calendar (date picker) ─────────────────────────────────────────────────

/** Weeks of a month, Monday first; days outside the month are null. */
export function monthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // blanks before the 1st
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(lead).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
