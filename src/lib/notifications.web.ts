/**
 * Web version of ./notifications.ts. Metro picks `.web.ts` over `.ts` when
 * bundling for the browser, so expo-notifications (iOS/Android only) is never
 * loaded on web. Same exports, doing nothing.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

export const remindersSupported = false;

export async function enableReminders(): Promise<'granted' | 'denied'> {
  return 'denied';
}

export async function syncReminders(_db: SQLiteDatabase, _settings: unknown) {}

export async function sendTestReminder() {}
