import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { completeSignIn, type ReturnParams } from '@/lib/auth';
import { colors, spacing, type } from '@/theme';

/** Leave for Settings, closing the sign-in screen if it's still open underneath. */
function toSettings() {
  if (router.canGoBack()) router.dismissTo('/settings');
  else router.replace('/settings');
}

/**
 * Where Google sign-in and email links come back to (cardly://auth/callback?code=…).
 * On iPhone the in-app browser usually hands the code straight to the sign-in
 * screen and this page never shows; Android, web and email links land here.
 */
export default function AuthCallback() {
  const params = useLocalSearchParams<ReturnParams>();
  const [error, setError] = useState<string | null>(null);
  const { code, error_description } = params;

  useEffect(() => {
    completeSignIn({ code, error_description })
      .then(toSettings)
      .catch((e: Error) => setError(e.message));
  }, [code, error_description]);

  return (
    <View style={styles.screen} accessibilityLiveRegion="polite">
      {error ? (
        <>
          <Text style={[type.section, { textAlign: 'center' }]}>Couldn’t sign you in</Text>
          <Text style={[type.body, { textAlign: 'center', color: colors.muted }]}>{error}</Text>
          <Button title="Back to Settings" variant="secondary" onPress={toSettings} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.ink} />
          <Text style={type.body}>Signing you in…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
});
