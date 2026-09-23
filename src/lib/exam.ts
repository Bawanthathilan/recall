/**
 * Exam pacing: will every new card be learned early enough to review it before
 * the exam? Pure functions, so they're easy to test.
 */
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

const days = (n: number) => (n === 1 ? '1 day' : `${n} days`);
const cards = (n: number) => (n === 1 ? '1 card' : `${n} cards`);

/**
 * Learn every new card by a "ready day" that leaves a review buffer before the
 * exam (up to 3 days, less when the exam is close), then check the daily rate.
 */
export function examPace({ daysLeft, newRemaining, newPerDay }: { daysLeft: number; newRemaining: number; newPerDay: number }): Pace {
  const when = daysLeft === 1 ? 'tomorrow' : `in ${days(daysLeft)}`;

  if (daysLeft < 0) {
    return { status: 'past', daysLeft, label: 'Exam date passed', detail: 'The exam date has passed. Clear or change it in the deck settings.' };
  }
  if (daysLeft === 0) {
    return { status: 'today', daysLeft, label: 'Exam today', detail: 'Exam today — a short review of anything due is the best use of your time. Good luck!' };
  }
  if (newRemaining === 0) {
    return {
      status: 'learned',
      daysLeft,
      label: `Exam ${when} · all learned`,
      detail: 'Every card is learned. Keep up your daily reviews until the exam.',
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
      label: `Exam ${when} · on track`,
      detail:
        spare > 0
          ? `At ${newPerDay} new cards a day you'll have learned every card ${days(spare)} before the exam.`
          : `At ${newPerDay} new cards a day you'll learn the last cards just before the exam.`,
    };
  }

  const leftOver = newRemaining - newPerDay * readyDays;
  const suggestedPerDay = Math.ceil(newRemaining / readyDays);
  return {
    status: 'behind',
    daysLeft,
    label: `Exam ${when} · behind`,
    detail:
      `At ${newPerDay} new cards a day, ${cards(leftOver)} will still be unlearned. ` +
      (buffer > 0
        ? `${suggestedPerDay} a day gets through them with ${days(buffer)} left to review.`
        : `${suggestedPerDay} a day gets through them in time.`),
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
