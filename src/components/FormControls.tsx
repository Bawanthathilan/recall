import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import type { Selection } from '@/lib/markup';
import { colors, fonts, radius, spacing, touchTarget, type } from '@/theme';

export type Tool = { key: string; label: string; a11y: string; mono?: boolean; onPress: () => void };

/**
 * Labelled text field. With `tools`, a formatting toolbar sits inside the box
 * above the text, as in the mockup's Create screen.
 */
export function Field({
  label,
  hint,
  tools,
  mono,
  minHeight = 52,
  onSelection,
  ...input
}: Omit<TextInputProps, 'style'> & {
  label: string;
  hint?: string;
  tools?: Tool[];
  mono?: boolean;
  minHeight?: number;
  onSelection?: (s: Selection) => void;
}) {
  const id = `field-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <View style={styles.field}>
      <Text style={styles.label} nativeID={id}>
        {label}
      </Text>
      <View style={styles.box}>
        {tools && (
          <View style={styles.toolbar} accessibilityRole="toolbar">
            {tools.map((t) => (
              <Pressable
                key={t.key}
                onPress={t.onPress}
                accessibilityRole="button"
                accessibilityLabel={t.a11y}
                style={({ pressed }) => [styles.tool, pressed && { backgroundColor: colors.ground }]}
              >
                <Text style={[styles.toolText, t.mono && { fontFamily: fonts.mono, fontSize: 14 }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <TextInput
          placeholderTextColor={colors.muted}
          accessibilityLabelledBy={id}
          onSelectionChange={(e) => onSelection?.(e.nativeEvent.selection)}
          textAlignVertical="top"
          style={[styles.input, { minHeight }, mono && styles.mono]}
          {...(mono ? { autoCapitalize: 'none', autoCorrect: false, spellCheck: false } : null)}
          {...input}
        />
      </View>
      {!!hint && <Text style={type.small}>{hint}</Text>}
    </View>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.checkRow}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
        {checked && <Ionicons name="checkmark" size={16} color={colors.onAccent} />}
      </View>
      <Text style={type.body}>{label}</Text>
    </Pressable>
  );
}

/** A row of choice pills. Scrolls sideways when there are many (e.g. languages). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
  scroll?: boolean;
}) {
  const chips = options.map(([id, label]) => {
    const on = id === value;
    return (
      <Pressable
        key={id}
        onPress={() => onChange(id)}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        style={[styles.chip, on && styles.chipOn]}
      >
        <Text style={[styles.chipText, on && { color: colors.surface }]}>{label}</Text>
      </Pressable>
    );
  });
  return scroll ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
      {chips}
    </ScrollView>
  ) : (
    <View style={[styles.chips, { flexWrap: 'wrap' }]}>{chips}</View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted },
  box: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' },
  toolbar: { flexDirection: 'row', gap: 2, paddingHorizontal: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.line },
  tool: { minWidth: touchTarget, height: 40, paddingHorizontal: 8, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
  toolText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  input: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink, padding: 14 },
  mono: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 21 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: touchTarget },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
});
