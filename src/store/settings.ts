import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_NEW_CARDS_PER_DAY } from '@/db/queries';

export type Goal = 'code' | 'university' | 'language' | 'exam' | 'medicine' | 'other';

type SettingsState = {
  onboarded: boolean;
  goals: Goal[];
  name: string;
  newCardsPerDay: number;
  /** Daily reminder, off until you turn it on (and grant permission) in Settings. */
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  completeOnboarding: (s: { goals: Goal[]; name: string; newCardsPerDay: number }) => void;
  update: (s: Partial<Pick<SettingsState, 'goals' | 'name' | 'newCardsPerDay' | 'reminderEnabled' | 'reminderHour' | 'reminderMinute'>>) => void;
  resetOnboarding: () => void;
};

type Persisted = Pick<SettingsState, 'onboarded' | 'goals' | 'name' | 'newCardsPerDay' | 'reminderEnabled' | 'reminderHour' | 'reminderMinute'>;

/**
 * Persisted to expo-sqlite's key-value store, which has the same async API as
 * AsyncStorage. Loading is async, so the root layout waits for
 * `useSettingsHydrated()` before rendering — otherwise returning users would
 * briefly see onboarding.
 */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      onboarded: false,
      goals: [],
      name: '',
      newCardsPerDay: DEFAULT_NEW_CARDS_PER_DAY,
      reminderEnabled: false,
      reminderHour: 19,
      reminderMinute: 0,
      completeOnboarding: (s) => set({ ...s, onboarded: true }),
      update: (s) => set(s),
      resetOnboarding: () => set({ onboarded: false }),
    }),
    {
      name: 'recall-settings',
      storage: createJSONStorage(() => Storage),
      // Only persist data, not the action functions.
      partialize: ({ onboarded, goals, name, newCardsPerDay, reminderEnabled, reminderHour, reminderMinute }): Persisted => ({
        onboarded,
        goals,
        name,
        newCardsPerDay,
        reminderEnabled,
        reminderHour,
        reminderMinute,
      }),
      // Bump `version` whenever the saved shape changes, and upgrade old data in `migrate`.
      // v2 added the reminder fields; saved v1 settings get their defaults from the initial state above.
      version: 2,
      migrate: (saved, fromVersion) => {
        const s = saved as Partial<Persisted> & { goals?: string[] };
        if (fromVersion < 1) {
          // Phase 1 → 2: goal list changed to match the mockup.
          const renamed: Record<string, Goal> = { certification: 'exam', general: 'other' };
          s.goals = (s.goals ?? []).map((g) => renamed[g] ?? (g as Goal));
          s.name = '';
          s.newCardsPerDay = DEFAULT_NEW_CARDS_PER_DAY;
        }
        return s as Persisted;
      },
    },
  ),
);

/** True once saved settings have been loaded from disk. */
export function useSettingsHydrated() {
  return useSyncExternalStore(
    (onChange) => useSettings.persist.onFinishHydration(onChange),
    () => useSettings.persist.hasHydrated(),
  );
}
