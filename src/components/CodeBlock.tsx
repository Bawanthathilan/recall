import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { highlight, languageLabel } from '@/lib/highlight';
import { codeColors, fonts, radius } from '@/theme';

/**
 * Syntax-highlighted code. Scrolls sideways instead of wrapping, because
 * wrapped code is hard to read. `variant="dark"` matches the mockup's question
 * view; "light" is the compact copy shown above the answer.
 */
export function CodeBlock({
  code,
  language,
  variant = 'dark',
  showLanguage = false,
}: {
  code: string;
  language: string;
  variant?: 'dark' | 'light';
  showLanguage?: boolean;
}) {
  const palette = codeColors[variant];
  const runs = useMemo(() => highlight(code, language), [code, language]);
  const dark = variant === 'dark';

  return (
    <View style={[styles.box, { backgroundColor: palette.bg }, !dark && styles.boxLight]}>
      {showLanguage && !!language && <Text style={[styles.lang, { color: palette.comment }]}>{languageLabel(language)}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={[dark ? styles.code : styles.codeLight, { color: palette.plain }]} accessibilityLabel={t('codeBlock.a11y', { language: languageLabel(language), code })}>
          {runs.map((r, i) => (
            <Text key={i} style={{ color: palette[r.role] }}>
              {r.text}
            </Text>
          ))}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.button, paddingVertical: 18, paddingHorizontal: 16, gap: 6 },
  boxLight: { borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14 },
  lang: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  code: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 24 },
  codeLight: { fontFamily: fonts.mono, fontSize: 12.5, lineHeight: 20 },
});
