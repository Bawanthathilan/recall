import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeckTile } from '@/components/DeckRow';
import { ExamCard } from '@/components/ExamCard';
import { ChartCard, ForecastBars, Heatmap, StatTile } from '@/components/ProgressCharts';
import { getDeckSummaries, getProgress, RETENTION_WINDOW_DAYS, setDeckNewPerDay, type DeckSummary, type Progress } from '@/db/queries';
import { heatmapGrid } from '@/lib/stats';
import { useSettings } from '@/store/settings';
import { colors, fonts, radius, spacing, touchTarget, type } from '@/theme';

export default function Stats() {
  const db = useSQLiteContext();
  const [deckId, setDeckId] = useState<number | null>(null); // null = all decks
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const newPerDay = useSettings((s) => s.newCardsPerDay);
  const [filterOpen, setFilterOpen] = useState(false);
  const [data, setData] = useState<{ progress: Progress; loadedAt: Date } | null>(null);

  const load = useCallback(() => {
    let active = true;
    const now = new Date();
    Promise.all([getProgress(db, deckId, now), getDeckSummaries(db, newPerDay, now)]).then(([progress, d]) => {
      if (!active) return;
      setData({ progress, loadedAt: now });
      setDecks(d);
    });
    return () => {
      active = false;
    };
  }, [db, deckId, newPerDay]);

  // Reload whenever the tab gains focus (e.g. right after a study session) or the deck filter changes.
  useFocusEffect(load);

  const grid = useMemo(() => (data ? heatmapGrid(data.progress.dailyReviews, data.loadedAt) : null), [data]);
  const p = data?.progress;
  const deckName = decks.find((d) => d.id === deckId)?.name ?? 'All decks';
  const retention = p?.retention == null ? '—' : `${Math.round(p.retention * 100)}%`;
  // Upcoming exams, soonest first (just the chosen deck when filtered).
  const exams = decks
    .filter((d) => d.pace && d.pace.daysLeft >= 0 && (deckId == null || d.id === deckId))
    .sort((a, b) => a.pace!.daysLeft - b.pace!.daysLeft);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={type.title} accessibilityRole="header">
            Progress
          </Text>
          <Pressable
            onPress={() => setFilterOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel={`Showing ${deckName}. Change deck`}
            accessibilityState={{ expanded: filterOpen }}
            style={styles.filter}
          >
            <Text style={styles.filterText} numberOfLines={1}>
              {deckName}
            </Text>
            <Ionicons name={filterOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.ink} />
          </Pressable>
        </View>

        {filterOpen && (
          <View style={styles.filterList}>
            {[null, ...decks].map((d) => {
              const id = d?.id ?? null;
              return (
                <Pressable
                  key={id ?? 'all'}
                  onPress={() => {
                    setDeckId(id);
                    setFilterOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: id === deckId }}
                  style={styles.filterRow}
                >
                  {d ? (
                    <DeckTile icon={d.icon} tone={d.tone} size={28} />
                  ) : (
                    <View style={styles.allIcon}>
                      <Ionicons name="albums" size={16} color={colors.ink} />
                    </View>
                  )}
                  <Text style={[type.bodySemi, { flex: 1 }]} numberOfLines={1}>
                    {d?.name ?? 'All decks'}
                  </Text>
                  {id === deckId && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.tiles}>
          <StatTile
            label="Retention"
            value={retention}
            a11y={
              p?.retention == null
                ? 'Retention: not enough reviews yet'
                : `Retention ${retention}, from ${p.retentionSample} reviews in the last ${RETENTION_WINDOW_DAYS} days`
            }
          />
          <StatTile label="Reviews" value={p ? p.totalReviews.toLocaleString() : '—'} />
          <StatTile label="Best streak" value={p ? `${p.bestStreak}d` : '—'} a11y={p ? `Best streak: ${p.bestStreak} days` : undefined} />
        </View>

        <ChartCard title="Study activity" subtitle="Last 16 weeks">
          {grid && <Heatmap grid={grid} />}
        </ChartCard>

        <ChartCard title="Upcoming reviews" subtitle="Next 7 days">
          {p && <ForecastBars days={p.forecast} />}
        </ChartCard>

        {exams.map((d) => (
          <ExamCard
            key={d.id}
            deckName={d.name}
            pace={d.pace!}
            onApply={async (perDay) => {
              await setDeckNewPerDay(db, d.id, perDay);
              load();
            }}
          />
        ))}

        <Text style={styles.footnote}>
          Retention is the share of cards you remembered (Hard, Good or Easy) when they came up for review in the last{' '}
          {RETENTION_WINDOW_DAYS} days. FSRS schedules reviews to keep it around 90%. Upcoming reviews don’t include new cards.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    maxWidth: '55%',
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  filterText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink, flexShrink: 1 },
  filterList: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget + 4,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  allIcon: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  footnote: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted },
});
