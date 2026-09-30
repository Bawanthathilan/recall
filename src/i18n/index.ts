/**
 * Translations. `en.ts` is the source of truth; `si.ts` must have exactly the same
 * keys (TypeScript checks this, and src/i18n/__tests__ checks the {{placeholders}}).
 *
 *   import { t } from '@/i18n';
 *   t('today.dueToday')
 *   t('common.cards', { count: 3 })   // plurals: keys ending _one / _other
 *
 * The language is fixed for each run of the app (changing it restarts the app, see
 * language.ts), so a plain function is enough: no hook, and it works outside components too.
 */
import { createInstance } from 'i18next';

import { en } from './en';
import { language } from './language';
import { si } from './si';

export { isSinhala, language, locale, setLanguage, type Language } from './language';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}

const i18n = createInstance();
i18n.init({
  lng: language,
  fallbackLng: 'en',
  resources: { en: { translation: en }, si: { translation: si } },
  // React already escapes text, and our strings never become HTML.
  interpolation: { escapeValue: false },
  // Resources are bundled, so there's nothing to wait for: `t` works on the first render.
  initAsync: false,
});

export const t = i18n.t.bind(i18n);
