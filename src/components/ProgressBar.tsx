import { View } from 'react-native';

import { colors } from '@/theme';

/** Thin 6px bar. `value` is 0–1. */
export function ProgressBar({ value, color = colors.ink, track = colors.track }: { value: number; color?: string; track?: string }) {
  const pct = `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` as const;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: pct, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}
