import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, type } from '@/theme';

/** Placeholder for tabs planned in a later phase (see ROADMAP.md). */
export function ComingSoon({ title, icon, phase, items }: { title: string; icon: keyof typeof Ionicons.glyphMap; phase: string; items: string[] }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <Text style={type.title}>{title}</Text>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name={icon} size={24} color={colors.accent} />
          </View>
          <Text style={type.section}>Coming in {phase}</Text>
          {items.map((item) => (
            <Text key={item} style={[type.body, { color: colors.muted }]}>
              · {item}
            </Text>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.xl },
  card: { padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
