import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

/** Ink rounded square with a tilted card outline, plus the "Cardly" wordmark. */
export function Logo() {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Cardly">
      <View style={styles.mark}>
        <View style={styles.card} />
      </View>
      <Text style={styles.word}>Cardly</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 14,
    height: 18,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: colors.ground,
    transform: [{ rotate: '-8deg' }],
  },
  word: { fontFamily: fonts.heading, fontSize: 22, letterSpacing: -0.5, color: colors.ink },
});
