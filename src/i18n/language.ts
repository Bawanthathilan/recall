/**
 * Which language the app shows, decided once at startup.
 *
 * Fonts, text styles and every StyleSheet are built when their modules first load,
 * so the language can't change while the app runs. Choosing another language saves
 * it and restarts the app (`setLanguage`). The choice is read synchronously,
 * because theme.ts needs it before anything renders.
 */
import { reloadAppAsync } from 'expo';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

export const LANGUAGES = ['en', 'si'] as const;
export type Language = (typeof LANGUAGES)[number];

const KEY = 'cardly-language';

// Synchronous SQLite needs SharedArrayBuffer on the web, which the dev server doesn't enable,
// so the web build keeps this one value in the browser's localStorage instead.
const store =
  Platform.OS === 'web'
    ? { get: (key: string) => localStorage.getItem(key), set: (key: string, value: string) => localStorage.setItem(key, value) }
    : { get: (key: string) => Storage.getItemSync(key), set: (key: string, value: string) => Storage.setItemSync(key, value) };

function savedLanguage(): Language | null {
  try {
    const saved = store.get(KEY);
    return saved === 'en' || saved === 'si' ? saved : null;
  } catch {
    return null;
  }
}

/** The language this run of the app uses: the one picked in Settings or onboarding, English until then. */
export const language: Language = savedLanguage() ?? 'en';
export const isSinhala = language === 'si';
/**
 * For numbers: `n.toLocaleString(locale)`. English keeps the phone's own regional format
 * (undefined = device locale). Dates and times go through dates.ts instead.
 */
export const locale: string | undefined = isSinhala ? 'si-LK' : undefined;

/** Saves the choice and restarts the app so every screen and style picks it up. */
export async function setLanguage(lang: Language) {
  store.set(KEY, lang);
  await reloadAppAsync('Language changed');
}
