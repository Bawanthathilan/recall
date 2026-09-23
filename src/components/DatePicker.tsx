import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { monthGrid } from '@/lib/exam';
import { dayKey } from '@/lib/stats';
import { colors, fonts, radius, touchTarget } from '@/theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * A month calendar. Built by hand because the native date picker doesn't
 * run on web, and this one matches the rest of the design. Days before
 * `minKey` are disabled.
 */
export function DatePicker({ value, onChange, minKey }: { value: string | null; onChange: (key: string) => void; minKey: string }) {
  const start = value ?? minKey;
  const [year, setYear] = useState(Number(start.slice(0, 4)));
  const [month, setMonth] = useState(Number(start.slice(5, 7)) - 1);
  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const title = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Previous month" style={styles.nav}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Next month" style={styles.nav}>
          <Ionicons name="chevron-forward" size={20} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>
      {monthGrid(year, month).map((week, i) => (
        <View key={i} style={styles.row}>
          {week.map((date, j) => {
            if (!date) return <View key={j} style={styles.cell} />;
            const key = dayKey(date);
            const disabled = key < minKey;
            const selected = key === value;
            return (
              <Pressable
                key={j}
                onPress={() => onChange(key)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                accessibilityState={{ selected, disabled }}
                style={styles.cell}
              >
                <View style={[styles.day, key === minKey && styles.today, selected && styles.selected]}>
                  <Text style={[styles.dayText, disabled && { color: colors.line }, selected && { color: colors.surface }]}>
                    {date.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 11, color: colors.muted, paddingVertical: 6 },
  cell: { flex: 1, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1.5, borderColor: colors.line },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
});
