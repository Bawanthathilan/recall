/**
 * Cardly design tokens, taken from the Claude Design mockup "Flashcard App UI".
 *
 * Every colour, font, radius and spacing value used by the UI lives here, so
 * screens never hard-code hex values. Change the look of the app from this file.
 *
 * In Sinhala the app uses Noto Sans Sinhala (it has Latin letters too), taller lines
 * for the vowel signs above and below letters, and no negative letter spacing.
 */
import { isSinhala } from '@/i18n/language';

export const colors = {
  ground: '#F5F3EE', // app background
  surface: '#FFFFFF', // cards, sheets, inputs
  ink: '#1C1B19', // primary text AND primary buttons
  inkRaised: '#2C2A26', // boxes sitting on an ink surface (hero stats)
  onInk: '#F5F3EE', // text on ink surfaces
  onInkMuted: '#CFC9BE', // secondary text on ink surfaces
  muted: '#625D55', // secondary text
  bodySoft: '#3A3732', // long-form answer text
  line: '#E4E0D8', // borders & dividers
  track: '#EDEAE3', // empty part of progress bars
  accent: '#C2410C', // ＋ button, links, highlights
  accentPressed: '#9A3412',
  accentSoft: '#FBE9DF', // selected goal cards, accent chips
  success: '#2F7D4F', // "Answer" label
  onAccent: '#FFFFFF',
} as const;

/** Rating buttons: `fg` is the text colour, `bg` the fill. */
export const ratingColors = {
  again: { fg: '#9B1C22', bg: '#FBE4E4' },
  hard: { fg: '#7A4D07', bg: '#FAEFD9' },
  good: { fg: '#FFFFFF', bg: '#2F7D4F' },
  easy: { fg: '#1F4A85', bg: '#E3ECF8' },
} as const;

/** Deck icon tiles and progress bars. Stored by key in decks.tone. */
export const tones = {
  blue: { bg: '#E3ECF8', fg: '#2B5FA8' },
  green: { bg: '#E4F1E8', fg: '#2F7D4F' },
  orange: { bg: '#FBE9DF', fg: '#C2410C' },
} as const;
export type Tone = keyof typeof tones;

/** Progress charts (from the mockup). `heat` is one hue, light → dark: level 0 = no study. */
export const chartColors = {
  heat: ['#EDEAE3', '#F6CDB6', '#E58A5C', '#C2410C'],
  bar: '#D8D2C6', // forecast days after today
  barToday: '#1C1B19',
} as const;

/** Code blocks. `dark` for questions (as in the mockup), `light` for the smaller copy on the answer side. */
export const codeColors = {
  dark: { bg: '#1C1B19', plain: '#EDE8DE', keyword: '#F0A472', string: '#F0A472', number: '#9BD3A8', fn: '#8FB8F0', comment: '#9C968B' },
  light: { bg: '#F5F3EE', plain: '#1C1B19', keyword: '#9A3412', string: '#9A3412', number: '#2F7D4F', fn: '#2B5FA8', comment: '#625D55' },
} as const;

/**
 * With custom fonts in React Native, each weight is its own family name —
 * `fontWeight` alone won't switch weights. Use these names as `fontFamily`.
 * They must match the keys passed to `useFonts` in src/app/_layout.tsx.
 */
const latinFonts = {
  heading: 'BricolageGrotesque_700Bold',
  headingMedium: 'BricolageGrotesque_600SemiBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemi: 'DMSans_600SemiBold', // buttons, list titles
  bodyBold: 'DMSans_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
};

/** Code stays in JetBrains Mono: code is written in English whatever the app's language. */
const sinhalaFonts: typeof latinFonts = {
  heading: 'NotoSansSinhala_700Bold',
  headingMedium: 'NotoSansSinhala_600SemiBold',
  body: 'NotoSansSinhala_400Regular',
  bodyMedium: 'NotoSansSinhala_500Medium',
  bodySemi: 'NotoSansSinhala_600SemiBold',
  bodyBold: 'NotoSansSinhala_700Bold',
  mono: latinFonts.mono,
  monoMedium: latinFonts.monoMedium,
};

export const fonts = isSinhala ? sinhalaFonts : latinFonts;

export const radius = {
  xs: 8, // small chips
  sm: 12, // icon tiles, small buttons
  md: 14, // inputs, hero button
  button: 16, // primary buttons, rating buttons
  card: 18, // list cards
  lg: 24, // hero card
  xl: 28, // study card
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20, // screen side padding in the mockup
  xxl: 28,
} as const;

/**
 * Line height for a style that sets its own: unchanged in English, and at least
 * 1.5× the font size in Sinhala so vowel signs above and below letters aren't clipped.
 */
export const lineHeight = (fontSize: number, latin: number) => (isSinhala ? Math.max(latin, Math.round(fontSize * 1.5)) : latin);

/** Apple HIG / Material minimum touch target. */
export const touchTarget = 44;

const latinType = {
  display: { fontFamily: fonts.heading, fontSize: 36, lineHeight: 38, letterSpacing: -1, color: colors.ink },
  title: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 34, letterSpacing: -0.8, color: colors.ink },
  cardTitle: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 30, letterSpacing: -0.5, color: colors.ink },
  section: { fontFamily: fonts.bodySemi, fontSize: 18, lineHeight: 24, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  bodySemi: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20, color: colors.ink },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.muted },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, color: colors.muted },
  mono: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 22, color: colors.ink },
};

type TextStyle = { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing?: number; color: string };

/** Sinhala: headings a size smaller (words run longer), lines at least 1.5× the size, no tightened spacing. */
function sinhalaStyle(t: TextStyle, key: string): TextStyle {
  const heading = key === 'display' || key === 'title' || key === 'cardTitle';
  const fontSize = heading ? Math.round(t.fontSize * 0.85) : t.fontSize;
  return { ...t, fontSize, lineHeight: Math.max(t.lineHeight, Math.round(fontSize * 1.5)), letterSpacing: 0 };
}

export const type: typeof latinType = isSinhala
  ? (Object.fromEntries(Object.entries(latinType).map(([k, t]) => [k, sinhalaStyle(t, k)])) as typeof latinType)
  : latinType;

export const theme = { colors, ratingColors, tones, chartColors, codeColors, fonts, radius, spacing, touchTarget, type };
export default theme;
