import Ionicons from '@expo/vector-icons/Ionicons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import {
  accountsEnabled,
  appleSignInEnabled,
  AuthError,
  authConfigured,
  redirectUrl,
  sendEmailCode,
  signInWithApple,
  signInWithGoogle,
  useSession,
  verifyEmailCode,
} from '@/lib/auth';
import { t } from '@/i18n';
import { goBack } from '@/lib/nav';
import { colors, fonts, radius, spacing, touchTarget, type } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign in: Apple (iPhone), Google, or a code sent by email. Optional — the
 * app works the same without an account. Closes itself once you're signed in.
 */
export default function SignIn() {
  const session = useSession();
  const [busy, setBusy] = useState<'apple' | 'google' | 'email' | 'code' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');

  // However sign-in finished (button, email link, callback page), leave once there's a session.
  useEffect(() => {
    if (session) goBack();
  }, [session]);

  async function run(kind: NonNullable<typeof busy>, task: () => Promise<unknown>) {
    setError(null);
    setBusy(kind);
    try {
      await task();
    } catch (e) {
      if (!(e instanceof AuthError)) console.warn('Sign-in failed', e);
      setError(e instanceof AuthError ? e.message : t('signIn.failed'));
    } finally {
      setBusy(null);
    }
  }

  const sendCode = () =>
    run('email', async () => {
      const to = email.trim().toLowerCase();
      await sendEmailCode(to);
      setCodeSentTo(to);
      setCode('');
    });
  const verify = () => codeSentTo && run('code', () => verifyEmailCode(codeSentTo, code.trim()));

  if (!accountsEnabled) return <Redirect href="/settings" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.bar}>
          <Pressable onPress={goBack} accessibilityRole="button" hitSlop={8} style={styles.close}>
            <Text style={styles.closeText}>{t('signIn.notNow')}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Logo />
          <View style={{ gap: spacing.sm }}>
            <Text style={type.title}>{t('signIn.title')}</Text>
            <Text style={[type.body, { color: colors.muted }]}>
              {t('signIn.body')}
            </Text>
          </View>

          {!authConfigured && (
            <Text style={[type.caption, styles.notice]}>{t('signIn.notConfigured')}</Text>
          )}

          {appleSignInEnabled && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.button}
              style={styles.appleButton}
              onPress={() => run('apple', signInWithApple)}
            />
          )}

          <Pressable
            onPress={() => run('google', signInWithGoogle)}
            disabled={!!busy || !authConfigured}
            accessibilityRole="button"
            accessibilityLabel={t('signIn.google')}
            accessibilityState={{ disabled: !!busy || !authConfigured, busy: busy === 'google' }}
            style={({ pressed }) => [styles.provider, pressed && { backgroundColor: colors.ground }, !authConfigured && { opacity: 0.5 }]}
          >
            {busy === 'google' ? <ActivityIndicator color={colors.ink} /> : <Ionicons name="logo-google" size={20} color={colors.ink} />}
            <Text style={styles.providerText}>{t('signIn.google')}</Text>
          </Pressable>

          <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.line} />
            <Text style={type.caption}>{t('signIn.orEmail')}</Text>
            <View style={styles.line} />
          </View>

          {!codeSentTo ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                accessibilityLabel={t('signIn.email')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() => EMAIL_RE.test(email.trim()) && sendCode()}
                style={styles.input}
              />
              <Button
                title={busy === 'email' ? t('signIn.sending') : t('signIn.sendCode')}
                variant="primary"
                disabled={!!busy || !authConfigured || !EMAIL_RE.test(email.trim())}
                onPress={sendCode}
              />
            </>
          ) : (
            <>
              <Text style={type.body} accessibilityLiveRegion="polite">
                {t('signIn.codeSentBefore')}
                <Text style={type.bodySemi}>{codeSentTo}</Text>
                {t('signIn.codeSentAfter')}
              </Text>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                placeholderTextColor={colors.muted}
                accessibilityLabel={t('signIn.code')}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                returnKeyType="done"
                onSubmitEditing={() => code.length === 6 && verify()}
                style={[styles.input, styles.codeInput]}
                autoFocus
              />
              <Button title={busy === 'code' ? t('signIn.checking') : t('settings.signIn')} disabled={!!busy || code.length !== 6} onPress={verify} />
              <View style={styles.row}>
                <Button title={t('signIn.changeEmail')} variant="secondary" style={{ flex: 1 }} onPress={() => setCodeSentTo(null)} />
                <Button title={t('signIn.sendAgain')} variant="secondary" style={{ flex: 1 }} disabled={!!busy} onPress={sendCode} />
              </View>
            </>
          )}

          {__DEV__ && Platform.OS !== 'web' && (
            // Development only: the address Supabase must have under Authentication → URL Configuration → Redirect URLs.
            <Text style={type.small} selectable>
              {`Return address: ${redirectUrl()}`}
              {/* Supabase won't return to an address whose host is an IP (it falls back to the Site URL and the browser hangs). */}
              {/\/\/\d+\.\d+\.\d+\.\d+/.test(redirectUrl()) &&
                '\nSupabase rejects IP addresses, so Google sign-in will hang. Start Expo with `npm run start:tunnel` instead.'}
            </Text>
          )}

          {error && (
            <View style={styles.error} accessibilityLiveRegion="assertive">
              <Ionicons name="alert-circle-outline" size={20} color={colors.accent} />
              <Text style={[type.body, { flex: 1 }]}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  bar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  close: { minHeight: touchTarget, justifyContent: 'center' },
  closeText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.muted },
  content: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.lg },
  notice: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  appleButton: { height: 52 },
  provider: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  providerText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.ink },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  input: {
    ...type.body,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  codeInput: { fontFamily: fonts.mono, fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.md },
  error: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent },
});
