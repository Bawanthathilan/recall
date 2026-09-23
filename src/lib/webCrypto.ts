/**
 * React Native has no WebCrypto (`crypto.subtle`), so Supabase's PKCE would fall
 * back to sending its secret unhashed ("plain"). This fills in the two pieces it
 * uses — random bytes and SHA-256 — from expo-crypto. Import before creating the client.
 */
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

type Digest = (algorithm: string, data: BufferSource) => Promise<ArrayBuffer>;

if (Platform.OS !== 'web') {
  const g = globalThis as { crypto?: { getRandomValues?: typeof Crypto.getRandomValues; subtle?: { digest: Digest } } };
  g.crypto ??= {};
  g.crypto.getRandomValues ??= Crypto.getRandomValues;
  // Supabase only asks for SHA-256, which is also expo-crypto's name for it ("SHA-256").
  g.crypto.subtle ??= { digest: (algorithm, data) => Crypto.digest(algorithm as Crypto.CryptoDigestAlgorithm, data) };
}
