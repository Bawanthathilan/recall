/**
 * Planning daily reminders — which days, what they say. Pure, so it's tested;
 * src/lib/notifications.ts does the actual scheduling.
 *
 * Instead of one repeating notification, the next 7 days are scheduled as
 * separate one-off reminders and re-planned every time the app opens or you
 * finish studying. That lets a reminder skip today once you've studied, skip
 * days with nothing due, and say how much is waiting.
 */
import { addDays, startOfDay } from '@/lib/stats';

export type PlannedReminder = { date: Date; title: string; body: string };

/** Per-deck new-card numbers, as in DeckSummary. */
type NewCards = { newCount: number; newTotal: number; newLimit: number };

/**
 * Estimated cards to study on each of the next `days` days: studied cards
 * coming due (the forecast) plus the new cards each deck will offer that day.
 */
export function dueByDay(forecastCounts: number[], decks: NewCards[], days = 7): number[] {
  return Array.from({ length: days }, (_, i) => {
    const newCards = decks.reduce((sum, d) => {
      if (i === 0) return sum + d.newCount;
      const leftAfterToday = Math.max(0, d.newTotal - d.newCount);
      return sum + Math.min(d.newLimit, Math.max(0, leftAfterToday - d.newLimit * (i - 1)));
    }, 0);
    return (forecastCounts[i] ?? 0) + newCards;
  });
}

export function planReminders({
  now,
  hour,
  minute,
  studiedToday,
  due,
  streak,
  secondsPerCard,
}: {
  now: Date;
  hour: number;
  minute: number;
  studiedToday: boolean;
  /** From dueByDay(): index 0 = today. */
  due: number[];
  /** Current streak (counting yesterday if today isn't done yet). */
  streak: number;
  secondsPerCard: number;
}): PlannedReminder[] {
  const plan: PlannedReminder[] = [];
  due.forEach((count, i) => {
    const day = addDays(startOfDay(now), i);
    const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
    if (date <= now || count === 0) return;
    if (i === 0 && studiedToday) return;

    const minutes = Math.max(1, Math.round((count * secondsPerCard) / 60));
    const cards = count === 1 ? '1 card is' : `${count} cards are`;
    // Only today's reminder knows your streak for sure.
    const title = i === 0 && streak > 0 ? `Keep your ${streak}-day streak going` : 'Time for a quick review';
    plan.push({ date, title, body: `${cards} due — about ${minutes} min.` });
  });
  return plan;
}

/** "19:00" → "7:00 PM" in the user's locale. */
export function formatTime(hour: number, minute: number) {
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
