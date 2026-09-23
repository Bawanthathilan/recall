import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

/** Round profile photo, or the first letter of the name when there's no photo (or it fails to load). */
export function Avatar({ name, photoUrl, size = 44 }: { name: string; photoUrl?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const round = { width: size, height: size, borderRadius: size / 2 };

  if (photoUrl && !failed) {
    return (
      <Image
        source={{ uri: photoUrl }}
        onError={() => setFailed(true)}
        style={[round, { backgroundColor: colors.line }]}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    );
  }
  return (
    <View style={[round, styles.initial]}>
      <Text style={[styles.letter, { fontSize: size * 0.4 }]}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initial: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: fonts.bodySemi, color: colors.surface },
});
