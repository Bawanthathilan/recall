import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import {
  NotoSansSinhala_400Regular,
  NotoSansSinhala_500Medium,
  NotoSansSinhala_600SemiBold,
  NotoSansSinhala_700Bold,
} from '@expo-google-fonts/noto-sans-sinhala';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ReminderSync } from '@/components/ReminderSync';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import { isSinhala } from '@/i18n';
import { useSettingsHydrated } from '@/store/settings';
import { colors } from '@/theme';

// Keep the native splash visible until fonts and saved settings are loaded.
SplashScreen.preventAutoHideAsync();

// All Sinhala weights when the app is in Sinhala (theme.ts switches `fonts` to them). In English only
// SemiBold, for the "සිංහල" language button on the first onboarding screen.
const sinhalaFonts: Record<string, number> = isSinhala
  ? { NotoSansSinhala_400Regular, NotoSansSinhala_500Medium, NotoSansSinhala_600SemiBold, NotoSansSinhala_700Bold }
  : { NotoSansSinhala_600SemiBold };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    ...sinhalaFonts,
  });
  const settingsHydrated = useSettingsHydrated();
  const ready = (fontsLoaded || !!fontError) && settingsHydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    // Opens recall.db, runs migrations (and the first-run seed), then renders the app.
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
      <StatusBar style="dark" />
      <ReminderSync />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
        {/* (tabs) and onboarding each <Redirect> to the other based on useSettings().onboarded. */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="study/[deckId]" />
        <Stack.Screen name="deck/[deckId]/index" />
        <Stack.Screen name="settings" />
        {/* Editors slide up as sheets (iOS) with Cancel / Save in their own header. */}
        <Stack.Screen name="card/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="card/[noteId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="deck/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="deck/[deckId]/edit" options={{ presentation: 'modal' }} />
      </Stack>
    </SQLiteProvider>
  );
}
