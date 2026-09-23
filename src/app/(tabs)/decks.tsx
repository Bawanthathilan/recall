import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { DeckRow } from '@/components/DeckRow';
import { getDeckSummaries, type DeckSummary } from '@/db/queries';
import { useSettings } from '@/store/settings';
import { colors, spacing, type } from '@/theme';

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
        <Text style={type.title}>Decks</Text>

        {decks?.length === 0 && (
          <Text style={[type.body, { color: colors.muted }]}>No decks yet. Create one to start adding cards.</Text>
        )}
        <View style={{ gap: 10 }}>
          {decks?.map((d) => (
            <DeckRow key={d.id} deck={d} onPress={() => router.push({ pathname: '/deck/[deckId]', params: { deckId: String(d.id) } })} />
          ))}
        </View>
        <Button title="New deck" variant="secondary" onPress={() => router.push('/deck/new')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
});
