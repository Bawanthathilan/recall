/**
 * Daily reminders: permission, scheduling and the foreground behaviour.
 * Local notifications work in Expo Go; only *push* notifications need a
 * development build. Not available on web.
 */
import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

// Web uses ./notifications.web.ts instead of this file (see there).

import { getDeckSummaries, getProgress, getSecondsPerReview, getStreak } from '@/db/queries';
import { t } from '@/i18n';
import { dueByDay, planReminders } from '@/lib/reminders';
import { dayKey } from '@/lib/stats';

export const remindersSupported = true;

const CHANNEL = 'daily-reminders';

// If a reminder fires while you're already in the app, don't pop a banner over your studying.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Ask for permission (once — later calls just report the answer). */
export async function enableReminders(): Promise<'granted' | 'denied'> {
  if (Platform.OS === 'android') {
    // Android needs a channel before it will show the permission prompt.
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: t('reminder.channel'), importance: Notifications.AndroidImportance.DEFAULT });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  return (await Notifications.requestPermissionsAsync()).granted ? 'granted' : 'denied';
}

/**
 * Cancel everything and schedule the next 7 days from scratch. Cheap enough
 * to run whenever the app opens, you finish studying, or settings change.
 */
export async function syncReminders(db: SQLiteDatabase, s: { reminderEnabled: boolean; reminderHour: number; reminderMinute: number; newCardsPerDay: number }) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!s.reminderEnabled || !(await Notifications.getPermissionsAsync()).granted) return;

  const now = new Date();
  const [decks, progress, streak, secondsPerCard] = await Promise.all([
    getDeckSummaries(db, s.newCardsPerDay, now),
    getProgress(db, null, now),
    getStreak(db, now),
    getSecondsPerReview(db),
  ]);
  const plan = planReminders({
    now,
    hour: s.reminderHour,
    minute: s.reminderMinute,
    studiedToday: (progress.dailyReviews.get(dayKey(now)) ?? 0) > 0,
    due: dueByDay(
      progress.forecast.map((d) => d.count),
      decks,
    ),
    streak,
    secondsPerCard,
  });
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL },
    });
  }
}

/** Settings → "Send a test reminder": shows up in 5 seconds (leave the app to see the banner). */
export async function sendTestReminder() {
  await Notifications.scheduleNotificationAsync({
    content: { title: t('reminder.title'), body: t('reminder.testBody') },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
}
