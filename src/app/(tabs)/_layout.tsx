import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, Tabs } from 'expo-router';
import { Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '@/store/settings';
import { colors, fonts, radius } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Filled icon when the tab is active, outline otherwise (as in the mockup). */
function TabIcon({ focused, color, on, off }: { focused: boolean; color: ColorValue; on: IconName; off: IconName }) {
  return <Ionicons name={focused ? on : off} size={24} color={color} />;
}

/** The orange ＋ in the middle. It isn't a real tab: it opens the card editor as a modal. */
function AddButton() {
  return (
    <View style={styles.addWrap}>
      <Pressable
        onPress={() => router.push('/card/new')}
        accessibilityRole="button"
        accessibilityLabel="Create card"
        style={({ pressed }) => [styles.add, pressed && { backgroundColor: colors.accentPressed }]}
      >
        <Ionicons name="add" size={28} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const onboarded = useSettings((s) => s.onboarded);
  // 64px of content (fits the 52px ＋ button) plus the home-indicator strip on modern phones.
  const { bottom } = useSafeAreaInsets();

  // First launch (or "Redo onboarding"): pick goals before seeing the app.
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.ground },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 64 + bottom, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: (p) => <TabIcon {...p} on="home" off="home-outline" /> }} />
      <Tabs.Screen name="decks" options={{ title: 'Decks', tabBarIcon: (p) => <TabIcon {...p} on="albums" off="albums-outline" /> }} />
      <Tabs.Screen name="add" options={{ title: 'Create', tabBarButton: () => <AddButton /> }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats', tabBarIcon: (p) => <TabIcon {...p} on="stats-chart" off="stats-chart-outline" /> }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: (p) => <TabIcon {...p} on="compass" off="compass-outline" /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  add: {
    width: 52,
    height: 52,
    borderRadius: radius.button,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
