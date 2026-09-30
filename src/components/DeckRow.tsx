import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/ProgressBar';
import type { DeckSummary } from '@/db/queries';
import { t } from '@/i18n';
import { colors, fonts, radius, spacing, tones, type } from '@/theme';

export function DeckTile({ icon, tone, size = 44 }: { icon: string; tone: DeckSummary['tone']; size?: number }) {
  const t = tones[tone] ?? tones.orange;
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: t.bg }]}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={size / 2} color={t.fg} />
    </View>
  );
}

/** Deck list row from the mockup: tile · name · "N due" · mastery bar · subtitle. */
export function DeckRow({ deck, onPress }: { deck: DeckSummary; onPress: () => void }) {
  const due = deck.newCount + deck.learningCount + deck.reviewCount;
  const pct = deck.total ? Math.round((deck.mastered / deck.total) * 100) : 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('deckRow.a11y', { name: deck.name, due, mastered: pct }) + (deck.pace ? `. ${deck.pace.label}` : '')}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
    >
      <DeckTile icon={deck.icon} tone={deck.tone} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[type.bodySemi, styles.name]} numberOfLines={1}>
            {deck.name}
          </Text>
          {due > 0 && <Text style={styles.due}>{t('deckRow.due', { count: due })}</Text>}
        </View>
        <ProgressBar value={pct / 100} color={(tones[deck.tone] ?? tones.orange).fg} />
        {/* With an exam date, the mockup swaps this line for "Exam in 12 days · on track". */}
        <Text style={type.small}>
          {deck.pace?.status === 'past' || !deck.pace
            ? t('deckRow.progress', { cards: t('common.cards', { count: deck.total }), mastered: pct })
            : deck.pace.label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
  body: { flex: 1, gap: 6, minWidth: 0 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  name: { flexShrink: 1 },
  due: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accent },
});
