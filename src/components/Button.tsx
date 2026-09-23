import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius, spacing, touchTarget } from '@/theme';

type Variant = 'primary' | 'secondary' | 'light' | 'danger';

type Props = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: Variant;
  /** Ionicons name shown after the label (e.g. the → on "Start review"). */
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

// primary = ink (main action), light = for use on ink surfaces, secondary = outlined.
const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.ink, fg: colors.surface },
  light: { bg: colors.ground, fg: colors.ink },
  secondary: { bg: colors.surface, fg: colors.ink, border: colors.line },
  danger: { bg: colors.surface, fg: '#9B1C22', border: colors.line },
};

export function Button({ title, variant = 'primary', trailingIcon, disabled, style, ...rest }: Props) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg },
        v.border && { borderWidth: 1, borderColor: v.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <View style={styles.row}>
        <Text style={[styles.label, { color: v.fg }]}>{title}</Text>
        {trailingIcon && <Ionicons name={trailingIcon} size={18} color={v.fg} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget + 12,
    borderRadius: radius.button,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
  label: { fontFamily: fonts.bodySemi, fontSize: 17 },
});
