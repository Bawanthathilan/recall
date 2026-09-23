import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { DeckRow } from '@/components/DeckRow';
import { getDeckSummaries, type DeckSummary } from '@/db/queries';
import { useSettings } from '@/store/settings';
import { colors, radius, spacing, touchTarget, type } from '@/theme';

export default function Decks() {
  const db = useSQLiteContext();
  const newPerDay = useSettings((s) => s.newCardsPerDay);
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDeckSummaries(db, newPerDay).then((d) => active && setDecks(d));
      return () => {
        active = false;
      };
    }, [db, newPerDay]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={type.title}>Decks</Text>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={styles.iconButton}
          >
            <Ionicons name="settings-outline" size={22} color={colors.ink} />
          </Pressable>
        </View>

        {decks?.length === 0 && (
          <Text style={[type.body, { color: colors.muted }]}>No decks yet. Create one to start adding cards.</Text>
        )}
        <View style={{ gap: 10 }}>
          {decks?.map((d) => (
            <DeckRow key={d.id} deck={d} onPress={() => router.push({ pathname: '/deck/[deckId]', params: { deckId: String(d.id) } })} />
          ))}
        </View>
        <View style={{ gap: spacing.md }}>
          <Button title="New deck" variant="secondary" onPress={() => router.push('/deck/new')} />
          <Button title="Import cards" variant="secondary" onPress={() => router.push('/import')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
