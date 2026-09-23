import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { syncReminders } from '@/lib/notifications';
import { useSettings } from '@/store/settings';

/** Re-plan reminders now and whenever things change. Failures are logged, never fatal. */
export function resyncReminders(db: Parameters<typeof syncReminders>[0]) {
  syncReminders(db, useSettings.getState()).catch((e) => console.warn('Could not schedule reminders', e));
}

/**
 * Keeps scheduled reminders up to date: on launch, when the app comes back to
 * the foreground, and when reminder settings change. Renders nothing.
 */
export function ReminderSync() {
  const db = useSQLiteContext();
  const enabled = useSettings((s) => s.reminderEnabled);
  const hour = useSettings((s) => s.reminderHour);
  const minute = useSettings((s) => s.reminderMinute);
  const newPerDay = useSettings((s) => s.newCardsPerDay);

  useEffect(() => {
    resyncReminders(db);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && resyncReminders(db));
    return () => sub.remove();
  }, [db, enabled, hour, minute, newPerDay]);

  return null;
}
