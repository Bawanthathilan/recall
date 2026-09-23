import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ReminderSync } from '@/components/ReminderSync';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import { useSettingsHydrated } from '@/store/settings';
import { colors } from '@/theme';

// Keep the native splash visible until fonts and saved settings are loaded.
SplashScreen.preventAutoHideAsync();

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
        {/* Editors slide up as sheets (iOS) with Cancel / Save in their own header. */}
        <Stack.Screen name="card/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="card/[noteId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="deck/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="deck/[deckId]/edit" options={{ presentation: 'modal' }} />
      </Stack>
    </SQLiteProvider>
  );
}
