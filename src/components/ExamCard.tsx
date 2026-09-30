import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Pace } from '@/lib/exam';
import { t } from '@/i18n';
import { colors, fonts, lineHeight, radius, ratingColors, spacing, touchTarget } from '@/theme';

type Look = { bg: string; iconBg: string; icon: 'calendar' | 'alert' | 'checkmark-done' | 'flag'; title: string; body: string };

// Green when things are fine (as in the mockup), amber when behind, neutral when past.
// Status is never colour alone: each state also has its own icon and wording.
const LOOKS: Record<Pace['status'], Look> = {
  'on-track': { bg: '#E4F1E8', iconBg: colors.success, icon: 'calendar', title: '#1D4E31', body: '#2B5A3D' },
  learned: { bg: '#E4F1E8', iconBg: colors.success, icon: 'checkmark-done', title: '#1D4E31', body: '#2B5A3D' },
  today: { bg: '#E4F1E8', iconBg: colors.success, icon: 'flag', title: '#1D4E31', body: '#2B5A3D' },
  behind: { bg: ratingColors.hard.bg, iconBg: ratingColors.hard.fg, icon: 'alert', title: ratingColors.hard.fg, body: ratingColors.hard.fg },
  past: { bg: colors.track, iconBg: colors.muted, icon: 'calendar', title: colors.ink, body: colors.muted },
};

/** The mockup's pace card: "Organic Chemistry II exam in 12 days — At this pace…". */
export function ExamCard({ deckName, pace, onApply }: { deckName: string; pace: Pace; onApply?: (perDay: number) => void }) {
  const look = LOOKS[pace.status];
  const title =
    pace.status === 'past'
      ? t('examCard.passed', { deck: deckName })
      : pace.status === 'today'
        ? t('examCard.today', { deck: deckName })
        : t('examCard.upcoming', {
            deck: deckName,
            when: pace.daysLeft === 1 ? t('exam.tomorrow') : t('exam.inDays', { days: t('common.days', { count: pace.daysLeft }) }),
          });

  return (
    <View style={[styles.card, { backgroundColor: look.bg }]} accessible={!onApply || !pace.suggestedPerDay}>
      <View style={[styles.icon, { backgroundColor: look.iconBg }]}>
        <Ionicons name={look.icon} size={22} color={colors.surface} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: look.title }]}>{title}</Text>
        <Text style={[styles.body, { color: look.body }]}>{pace.detail}</Text>
        {pace.status === 'behind' && pace.suggestedPerDay && onApply && (
          <Pressable
            onPress={() => onApply(pace.suggestedPerDay!)}
            accessibilityRole="button"
            accessibilityLabel={t('examCard.useA11y', { count: pace.suggestedPerDay, deck: deckName })}
            style={({ pressed }) => [styles.apply, { borderColor: look.title }, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.applyText, { color: look.title }]}>{t('examCard.use', { count: pace.suggestedPerDay })}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 14, padding: spacing.lg, borderRadius: 20 },
  icon: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: lineHeight(15, 20) },
  body: { fontFamily: fonts.body, fontSize: 13, lineHeight: lineHeight(13, 18) },
  apply: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    minHeight: touchTarget - 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  applyText: { fontFamily: fonts.bodySemi, fontSize: 14 },
});
