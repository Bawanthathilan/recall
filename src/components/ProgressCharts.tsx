import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import type { ForecastDay, HeatCell } from '@/lib/stats';
import { t } from '@/i18n';
import { formatDate } from '@/i18n/dates';
import { chartColors, colors, fonts, radius, spacing, type } from '@/theme';

// ─── Stat tile ──────────────────────────────────────────────────────────────

export function StatTile({ label, value, a11y }: { label: string; value: string; a11y?: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={a11y ?? `${label}: ${value}`}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/** White rounded card with a "title · subtitle" header, as in the mockup. */
export function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={type.bodySemi}>{title}</Text>
        <Text style={type.caption}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Heatmap ────────────────────────────────────────────────────────────────

const GAP = 4;
const longDate = (d: Date) => formatDate(d, { weekday: 'short', day: true, month: 'short' });

/**
 * 16 week-columns × 7 day-rows. Cells are ~16 px — far below a 44 px touch
 * target — so the whole grid is one Pressable and the tap position picks the
 * cell. The chosen day is outlined and described in the caption.
 */
export function Heatmap({ grid }: { grid: HeatCell[][] }) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const cols = grid.length;
  const cell = width ? (width - GAP * (cols - 1)) / cols : 0;

  const days = grid.flat().filter((c) => !c.future);
  const total = days.reduce((sum, c) => sum + c.count, 0);
  const studied = days.filter((c) => c.count > 0).length;
  const busiest = days.reduce<HeatCell | null>((best, c) => (c.count > (best?.count ?? 0) ? c : best), null);
  const picked = days.find((c) => c.key === selected);

  function onPress(e: GestureResponderEvent) {
    if (!cell) return;
    // Phones report the tap position inside the grid as locationX/Y. On web the
    // event is a browser MouseEvent, which calls the same thing offsetX/Y.
    const ne = e.nativeEvent as { locationX?: number; locationY?: number; offsetX?: number; offsetY?: number };
    const x = ne.locationX ?? ne.offsetX ?? -1;
    const y = ne.locationY ?? ne.offsetY ?? -1;
    const hit = grid[Math.floor(x / (cell + GAP))]?.[Math.floor(y / (cell + GAP))];
    setSelected(hit && !hit.future && hit.key !== selected ? hit.key : null);
  }

  const summary = total
    ? t('charts.summary', { reviews: t('common.reviews', { count: total }), days: t('common.days', { count: studied }) }) +
      (busiest ? ' ' + t('charts.busiest', { date: longDate(busiest.date), reviews: t('common.reviews', { count: busiest.count }) }) : '')
    : t('charts.noReviews');

  return (
    <>
      <Text style={styles.caption} accessibilityLiveRegion="polite">
        {picked
          ? `${longDate(picked.date)} · ${t('common.reviews', { count: picked.count })}`
          : total
            ? t('charts.tapDay')
            : t('charts.empty')}
      </Text>
      <Pressable
        onPress={onPress}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="image"
        accessibilityLabel={`${t('stats.activity')}, ${t('stats.last16Weeks')}. ${summary}`}
        style={[styles.grid, { height: cell ? cell * 7 + GAP * 6 : 0 }]}
      >
        {cell > 0 &&
          grid.map((col, i) => (
            <View key={i} style={{ gap: GAP, pointerEvents: 'none' }}>
              {col.map((c) => (
                <View
                  key={c.key}
                  style={[
                    { width: cell, height: cell, borderRadius: 3 },
                    !c.future && { backgroundColor: chartColors.heat[c.level] },
                    c.key === selected && styles.cellSelected,
                  ]}
                />
              ))}
            </View>
          ))}
      </Pressable>
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.legendText}>{t('charts.less')}</Text>
        {chartColors.heat.map((c) => (
          <View key={c} style={[styles.legendSwatch, { backgroundColor: c }]} />
        ))}
        <Text style={styles.legendText}>{t('charts.more')}</Text>
      </View>
    </>
  );
}

// ─── Forecast ───────────────────────────────────────────────────────────────

const BAR_MAX = 70;

/** Next 7 days. Values sit on each bar's cap (no axis needed); today in ink, the rest grey. */
export function ForecastBars({ days }: { days: ForecastDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const label = (d: ForecastDay) => (d.isToday ? t('tabs.today') : formatDate(d.date, { weekday: 'short' }));
  const summary = days.map((d) => `${label(d)} ${d.count}`).join(', ');
  return (
    <View style={styles.bars} accessible accessibilityRole="image" accessibilityLabel={t('charts.forecastA11y', { summary })}>
      {days.map((d) => (
        <View key={d.key} style={styles.barSlot}>
          <Text style={styles.barValue}>{d.count}</Text>
          <View
            style={[
              styles.bar,
              {
                height: d.count ? Math.max(4, (d.count / max) * BAR_MAX) : 2,
                backgroundColor: d.isToday ? chartColors.barToday : chartColors.bar,
              },
            ]}
          />
          <Text style={[styles.barDay, d.isToday && { color: colors.ink }]}>{label(d)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 2,
  },
  tileLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  tileValue: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 32, color: colors.ink },
  card: { padding: spacing.lg, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  caption: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: -4 },
  grid: { flexDirection: 'row', gap: GAP },
  cellSelected: { borderWidth: 2, borderColor: colors.ink },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  legendText: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  legendSwatch: { width: 11, height: 11, borderRadius: 3 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: BAR_MAX + 44 },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '100%', maxWidth: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barValue: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  barDay: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.bodySoft },
});
