import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { colors, fonts, touchTarget } from '@/theme';

/** "Cancel · Title · Save" bar from the mockup's Create screen. */
export function ModalHeader({
  title,
  onCancel,
  onSave,
  saveLabel = t('common.save'),
  canSave = true,
}: {
  title: string;
  onCancel: () => void;
  onSave?: () => void;
  saveLabel?: string;
  canSave?: boolean;
}) {
  return (
    <View style={styles.bar}>
      <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={8} style={styles.side}>
        <Text style={styles.cancel}>{t('common.cancel')}</Text>
      </Pressable>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>
        {onSave && (
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            hitSlop={8}
            style={styles.sideInner}
          >
            <Text style={[styles.save, !canSave && { opacity: 0.4 }]}>{saveLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: touchTarget },
  side: { minWidth: 72, minHeight: touchTarget, justifyContent: 'center' },
  sideInner: { minHeight: touchTarget, justifyContent: 'center' },
  cancel: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.muted },
  title: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.ink },
  save: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.accent },
});
