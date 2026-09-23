import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { CodeBlock } from '@/components/CodeBlock';
import { parseInline, parseMarkup, type ClozeMode, type Span } from '@/lib/markup';
import { colors, fonts } from '@/theme';

/**
 * Draws card text: paragraphs with **bold**, `inline code` and cloze blanks,
 * plus fenced ```code blocks```. Parsing lives in src/lib/markup.ts.
 */
export function Markup({
  text,
  style,
  cloze,
  codeVariant = 'dark',
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  cloze?: ClozeMode;
  codeVariant?: 'dark' | 'light';
}) {
  const clozeOrd = cloze?.ord;
  const clozeRevealed = cloze?.revealed;
  const blocks = useMemo(
    () => parseMarkup(text, clozeOrd === undefined ? undefined : { ord: clozeOrd, revealed: !!clozeRevealed }),
    [text, clozeOrd, clozeRevealed],
  );

  const spanStyle = spanStyleFor(style);

  return (
    <View style={styles.stack}>
      {blocks.map((b, i) =>
        b.kind === 'code' ? (
          <CodeBlock key={i} code={b.code} language={b.language} variant={codeVariant} />
        ) : (
          <Text key={i} style={style}>
            {b.spans.map((s, j) => (
              <Text key={j} style={spanStyle(s)}>
                {s.text}
              </Text>
            ))}
          </Text>
        ),
      )}
    </View>
  );
}

/**
 * One line of inline markup (bold, `code`) inside a single <Text>, so it can
 * be truncated with numberOfLines — e.g. note previews in a list.
 */
export function InlineMarkup({ text, style, numberOfLines }: { text: string; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const spans = useMemo(() => parseInline(text), [text]);
  const spanStyle = spanStyleFor(style);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {spans.map((s, i) => (
        <Text key={i} style={spanStyle(s)}>
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

function spanStyleFor(style: StyleProp<TextStyle>) {
  // Custom fonts can't be bolded with fontWeight, so pick a bold family that fits the surrounding text.
  const family = StyleSheet.flatten(style)?.fontFamily;
  const boldFamily = family === fonts.heading || family === fonts.headingMedium ? fonts.heading : fonts.bodyBold;
  return (s: Span): StyleProp<TextStyle> => [
    s.bold && { fontFamily: boldFamily },
    s.code && styles.code,
    // A cloze inside `code` keeps the mono font; elsewhere it's semibold.
    s.cloze && [styles.cloze, { fontFamily: s.code ? fonts.monoMedium : fonts.bodySemi }],
    s.cloze === 'hidden' && styles.clozeHidden,
  ];
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  // No fontSize: nested <Text> inherits size from its parent (heading or body).
  code: { fontFamily: fonts.mono, color: colors.ink, backgroundColor: colors.ground },
  cloze: { color: colors.accent, backgroundColor: colors.accentSoft },
  clozeHidden: { letterSpacing: 1 },
});
