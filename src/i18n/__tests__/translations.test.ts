import { en } from '@/i18n/en';
import { si } from '@/i18n/si';

type Tree = { [key: string]: string | Tree };

/** { a: { b: 'x' } } → { 'a.b': 'x' } */
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((out, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? { ...out, [path]: value } : { ...out, ...flatten(value, path) };
  }, {});
}

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

const english = flatten(en);
const sinhala = flatten(si);

describe('translations', () => {
  it('Sinhala has exactly the English keys', () => {
    expect(Object.keys(sinhala).sort()).toEqual(Object.keys(english).sort());
  });

  it.each(Object.keys(english))('%s uses the same {{placeholders}}', (key) => {
    expect(placeholders(sinhala[key])).toEqual(placeholders(english[key]));
  });

  it('has no empty Sinhala strings', () => {
    expect(Object.entries(sinhala).filter(([, text]) => !text.trim())).toEqual([]);
  });

  it('has no English left in the Sinhala file', () => {
    // A string with no Sinhala letters may only be placeholders and punctuation, like '{{greeting}}, {{name}}'.
    // The one exception is the button that switches to English.
    const untranslated = Object.entries(sinhala).filter(
      ([key, text]) => key !== 'onboarding.switchLanguage' && !/[඀-෿]/.test(text) && /[a-z]{2,}/i.test(text.replace(/\{\{\w+\}\}/g, '')),
    );
    expect(untranslated).toEqual([]);
  });
});
