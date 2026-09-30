/**
 * Accounts, via Supabase Auth. Signing in is optional: Cardly works fully
 * without an account; an account is what sync (Phase 8) will hang off.
 *
 * Ways to sign in:
 *  - Google: the browser-based OAuth flow. It works in Expo Go, on web and in
 *    store builds (native Google Sign-In would need a development build).
 *  - Apple: the native "Sign in with Apple" sheet (iOS). Needs the Apple
 *    Developer Program, so it's off until EXPO_PUBLIC_APPLE_SIGN_IN=true.
 *  - Email: a 6-digit code (or a link) sent by Supabase — no password to forget.
 *
 * Browser flows use PKCE: Supabase sends back a one-time `code`, and the app
 * swaps it for a session with a secret it kept (so an intercepted code is useless).
 */
import 'expo-sqlite/localStorage/install'; // gives Supabase a localStorage that persists on iOS/Android
import './webCrypto'; // SHA-256 for PKCE on iOS/Android

import { createClient, type Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { t } from '@/i18n';
import { useSettings } from '@/store/settings';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/**
 * Accounts are off in v1.0. Google Play requires in-app and web account deletion
 * for any app that creates accounts, and accounts don't do anything until sync
 * ships — so they're switched on together (EXPO_PUBLIC_ACCOUNTS=true in .env.local).
 * While off, no Supabase client is created: the app makes no network calls.
 */
export const accountsEnabled = process.env.EXPO_PUBLIC_ACCOUNTS === 'true';

/** False while accounts are off, or until .env.local has the Supabase URL and key (see .env.example). */
export const authConfigured = accountsEnabled && !!url && !!key;
export const appleSignInEnabled = Platform.OS === 'ios' && process.env.EXPO_PUBLIC_APPLE_SIGN_IN === 'true';

export const supabase = authConfigured
  ? createClient(url!, key!, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // the /auth/callback screen handles returning links itself
        flowType: 'pkce',
      },
    })
  : null;

// Keep the session fresh only while the app is open (Supabase's advice for React Native).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// ─── Current session, as a hook ─────────────────────────────────────────────

let session: Session | null = null;
let loaded = !supabase;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (supabase) {
  // Fires once with the saved session (INITIAL_SESSION), then on every sign-in/out/refresh.
  supabase.auth.onAuthStateChange((event, next) => {
    session = next;
    // First sign-in with Google (or Apple): use their first name for the greeting,
    // unless they already typed a name in onboarding or Settings.
    // (USER_UPDATED covers Apple, whose name we save on the account right after signing in.)
    if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && next && !useSettings.getState().name) {
      const { firstName } = profile(next);
      if (firstName) useSettings.getState().update({ name: firstName });
    }
    loaded = true;
    emit();
  });
}

/** The signed-in session, null when signed out, or undefined while it's still loading. */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => (loaded ? session : undefined),
  );
}

/**
 * Name and photo from the account. Google shares both (as full_name/name and
 * avatar_url/picture); Apple shares a name only the first time; email has neither.
 */
export function profile(s: Session) {
  const m = s.user.user_metadata as Record<string, string | undefined>;
  const name = (m.full_name || m.name || '').trim();
  // Google photo URLs end in a size like "=s96-c"; ask for 2× so it's sharp on phone screens.
  const photo = m.avatar_url || m.picture || null;
  return {
    name,
    firstName: (m.given_name || name.split(/\s+/)[0] || '').trim(),
    photoUrl: photo ? photo.replace(/=s\d+-c$/, '=s192-c') : null,
  };
}

/** "Google", "Apple" or "Email" — how this account signed in. */
export function providerName(s: Session) {
  const p = s.user.app_metadata.provider;
  return p === 'google' ? 'Google' : p === 'apple' ? 'Apple' : t('auth.emailProvider');
}

// ─── Signing in ─────────────────────────────────────────────────────────────

/** Where browser sign-ins and email links return to: cardly://auth/callback, exp://…/--/auth/callback in Expo Go. */
export const redirectUrl = () => Linking.createURL('auth/callback');

function client() {
  if (!supabase) throw new AuthError('Sign-in isn’t set up in this build yet.');
  return supabase;
}

/** A message meant for the person signing in. */
export class AuthError extends Error {}

/** What a sign-in link brings back: a one-time `code`, or an error from Google/Supabase. */
export type ReturnParams = { code?: string; error_description?: string };

/** Swaps the returned `code` for a session. Safe to call twice with the same code. */
export async function completeSignIn({ code, error_description }: ReturnParams) {
  if (error_description) throw new AuthError(error_description);
  if (!code) return;
  const { error } = await client().auth.exchangeCodeForSession(code);
  // The code only works once. If it's already been used (the app got the link twice), we're signed in anyway.
  if (error && !(await client().auth.getSession()).data.session) throw new AuthError(error.message);
}

/** Returns true when signed in, false if the person closed the browser. */
export async function signInWithGoogle(): Promise<boolean> {
  const redirectTo = Platform.OS === 'web' ? `${window.location.origin}/auth/callback` : redirectUrl();
  const { data, error } = await client().auth.signInWithOAuth({
    provider: 'google',
    // On phones we open the page ourselves in an in-app browser that returns to the app.
    options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
  });
  if (error) throw new AuthError(error.message);
  if (Platform.OS === 'web') return false; // the page is now leaving for Google; /auth/callback finishes

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;
  const params = new URL(result.url).searchParams;
  await completeSignIn({ code: params.get('code') ?? undefined, error_description: params.get('error_description') ?? undefined });
  return true;
}

/**
 * Native Sign in with Apple. A random "nonce" goes to Apple hashed and to
 * Supabase in the clear; Supabase checks they match, so a stolen Apple token
 * can't be replayed.
 */
export async function signInWithApple(): Promise<boolean> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new AuthError(t('auth.appleNoToken'));
    const { error } = await client().auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
    if (error) throw new AuthError(error.message);
    // Apple only shares your name the very first time, so save it on the account now.
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    if (name) await client().auth.updateUser({ data: { full_name: name } });
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }
}

/** Emails a 6-digit code (and a sign-in link). Creates the account on first use. */
export async function sendEmailCode(email: string) {
  const redirectTo = Platform.OS === 'web' ? `${window.location.origin}/auth/callback` : redirectUrl();
  const { error } = await client().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
  if (error) throw new AuthError(error.status === 429 ? t('auth.tooManyEmails') : error.message);
}

export async function verifyEmailCode(email: string, code: string) {
  const { error } = await client().auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw new AuthError(/expired|invalid/i.test(error.message) ? t('auth.badCode') : error.message);
}

export async function signOut() {
  await client().auth.signOut();
}
