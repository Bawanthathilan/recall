import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { DeckRow } from '@/components/DeckRow';
import { resyncReminders } from '@/components/ReminderSync';
import { getDeckSummaries, getSecondsPerReview, getStreak, type DeckSummary } from '@/db/queries';
import { useSettings } from '@/store/settings';
import { colors, fonts, radius, spacing, type } from '@/theme';

function greeting(date: Date) {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Today() {
  const db = useSQLiteContext();
  const name = useSettings((s) => s.name);
  const newPerDay = useSettings((s) => s.newCardsPerDay);
  const [data, setData] = useState<{ decks: DeckSummary[]; streak: number; secsPerCard: number } | null>(null);

  // Runs every time this tab gains focus — e.g. after finishing a study session.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getDeckSummaries(db, newPerDay), getStreak(db), getSecondsPerReview(db)]).then(
        ([decks, streak, secsPerCard]) => active && setData({ decks, streak, secsPerCard }),
      );
      // Coming back here (e.g. after a study session) may change tonight's reminder.
      resyncReminders(db);
      return () => {
        active = false;
      };
    }, [db, newPerDay]),
  );

  const decks = data?.decks ?? [];
  const n = decks.reduce((t, d) => t + d.newCount, 0);
  const l = decks.reduce((t, d) => t + d.learningCount, 0);
  const r = decks.reduce((t, d) => t + d.reviewCount, 0);
  const due = n + l + r;
  const minutes = Math.max(1, Math.round((due * (data?.secsPerCard ?? 10)) / 60));
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.date}>{date}</Text>
            <Text style={type.title} numberOfLines={2}>
              {greeting(now)}
              {name ? `, ${name}` : ''}
            </Text>
          </View>
          {!!data?.streak && (
            <View style={styles.streak} accessibilityLabel={`${data.streak} day streak`}>
              <Ionicons name="flame" size={16} color={colors.accent} />
              <Text style={styles.streakText}>
                {data.streak} day{data.streak === 1 ? '' : 's'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ gap: 4 }}>
              <Text style={styles.heroLabel}>Due today</Text>
              <Text style={styles.heroNumber}>{data ? due : ' '}</Text>
            </View>
            <Text style={styles.heroLabel}>{due ? `about ${minutes} min` : 'All caught up'}</Text>
          </View>
          <View style={styles.heroStats}>
            <HeroStat label="New" value={n} />
            <HeroStat label="Learning" value={l} />
            <HeroStat label="Review" value={r} />
          </View>
          <Button
            title={due ? 'Start review' : 'Nothing due'}
            variant="light"
            trailingIcon={due ? 'arrow-forward' : undefined}
            disabled={!due}
            onPress={() => router.push('/study/all')}
            style={styles.heroButton}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={type.section}>Your decks</Text>
          <Link href="/deck/new" style={styles.link} accessibilityRole="button">
            New deck
          </Link>
        </View>
        <View style={{ gap: 10 }}>
          {decks.map((d) => (
            <DeckRow
              key={d.id}
              deck={d}
              onPress={() => {
                const hasDue = d.newCount + d.learningCount + d.reviewCount > 0;
                router.push({ pathname: hasDue ? '/study/[deckId]' : '/deck/[deckId]', params: { deckId: String(d.id) } });
              }}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  date: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  streakText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  hero: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: 22, gap: 18 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  heroLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.onInkMuted },
  heroNumber: { fontFamily: fonts.heading, fontSize: 56, lineHeight: 58, letterSpacing: -2, color: colors.onInk },
  heroStats: { flexDirection: 'row', gap: spacing.sm },
  heroStat: { flex: 1, gap: 2, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.inkRaised },
  heroStatLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.onInkMuted },
  heroStatValue: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.onInk },
  heroButton: { minHeight: 52, borderRadius: radius.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: -8 },
  link: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.accent, paddingVertical: 12 },
});
