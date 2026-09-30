/**
 * Dates and times in the app's language.
 *
 * English uses Intl with the phone's own regional format. Sinhala is formatted here,
 * because not every JavaScript engine ships Sinhala date data (without it, Intl quietly
 * falls back to English). Formats follow the Unicode CLDR patterns for Sinhala:
 * "2026 සැප්තැම්බර් 30, බදාදා" and "ප.ව. 7.00".
 */
import { isSinhala } from './language';

// JavaScript months start at 0 (January); weekdays at 0 (Sunday).
const MONTHS = ['ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්'];
const MONTHS_SHORT = ['ජන', 'පෙබ', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝ', 'සැප්', 'ඔක්', 'නොවැ', 'දෙසැ'];
const WEEKDAYS = ['ඉරිදා', 'සඳුදා', 'අඟහරුවාදා', 'බදාදා', 'බ්‍රහස්පතින්දා', 'සිකුරාදා', 'සෙනසුරාදා'];
const WEEKDAYS_SHORT = ['ඉරි', 'සඳු', 'අඟ', 'බදා', 'බ්‍රහ', 'සිකු', 'සෙන'];

export type DateParts = { weekday?: 'long' | 'short'; day?: boolean; month?: 'long' | 'short'; year?: boolean };

export function formatDate(date: Date, { weekday, day, month, year }: DateParts): string {
  if (!isSinhala) {
    return date.toLocaleDateString(undefined, {
      weekday,
      day: day ? 'numeric' : undefined,
      month,
      year: year ? 'numeric' : undefined,
    });
  }
  const dateText = [
    year && date.getFullYear(),
    month && (month === 'long' ? MONTHS : MONTHS_SHORT)[date.getMonth()],
    day && date.getDate(),
  ]
    .filter(Boolean)
    .join(' ');
  const weekdayText = weekday && (weekday === 'long' ? WEEKDAYS : WEEKDAYS_SHORT)[date.getDay()];
  return [dateText, weekdayText].filter(Boolean).join(', ');
}

/** 19, 0 → "7:00 PM" (phone's format) or "ප.ව. 7.00". */
export function formatTime(hour: number, minute: number): string {
  if (!isSinhala) return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${hour < 12 ? 'පෙ.ව.' : 'ප.ව.'} ${hour % 12 || 12}.${String(minute).padStart(2, '0')}`;
}
