import { Alert, Platform } from 'react-native';

import { t } from '@/i18n';

/**
 * Ask before a destructive action. Resolves true if the user confirmed.
 * React Native's Alert with buttons is a no-op on web, so web uses the
 * browser's own confirm dialog instead.
 */
export function confirm(title: string, message: string, confirmLabel = t('common.delete')): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      // Android: tapping outside the dialog dismisses it without pressing a button.
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
