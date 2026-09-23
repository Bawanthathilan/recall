import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeckTile } from '@/components/DeckRow';
import { STARTER_DECKS, type StarterDeck } from '@/data/starterDecks';
import { addStarterDeck } from '@/db/imports';
import { getDecks } from '@/db/queries';
import { cardOrds } from '@/lib/notes';
import { useSettings } from '@/store/settings';
import { colors, radius, spacing, touchTarget, type } from '@/theme';

const cardCount = (deck: StarterDeck) => deck.notes.reduce((sum, n) => sum + cardOrds(n.note).length, 0);

/** Starter decks to add in one tap, and the way in to importing your own. */
export default function Explore() {
  const db = useSQLiteContext();
  const goals = useSettings((s) => s.goals);
  // Deck name → id, to show "Added" and open it. Refreshed whenever the tab is shown.
  const [owned, setOwned] = useState<Map<string, number>>(new Map());
  const [adding, setAdding] = useState<string | null>(null);

  const load = useCallback(() => getDecks(db).then((decks) => setOwned(new Map(decks.map((d) => [d.name, d.id])))), [db]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function add(deck: StarterDeck) {
    setAdding(deck.id);
    try {
      await addStarterDeck(db, deck);
      await load();
    } finally {
      setAdding(null);
    }
  }

  const forYou = STARTER_DECKS.filter((d) => d.goals.some((g) => goals.includes(g)));
  const more = STARTER_DECKS.filter((d) => !forYou.includes(d));

  const row = (deck: StarterDeck) => (
    <StarterRow
      key={deck.id}
      deck={deck}
      ownedId={owned.get(deck.name)}
      busy={adding === deck.id}
      onAdd={() => add(deck)}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.title}>Explore</Text>

        <Pressable
          onPress={() => router.push('/import')}
          accessibilityRole="button"
          accessibilityLabel="Import cards from Anki or a spreadsheet"
          style={({ pressed }) => [styles.import, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.importIcon}>
            <Ionicons name="download-outline" size={22} color={colors.surface} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.bodySemi, { color: colors.surface }]}>Import cards</Text>
            <Text style={[type.caption, { color: '#BDB7AD' }]}>From Anki (.apkg) or a spreadsheet (CSV)</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.surface} />
        </Pressable>

        {forYou.length > 0 && (
          <View style={styles.section}>
            <Text style={type.section}>For you</Text>
            {forYou.map(row)}
          </View>
        )}
        <View style={styles.section}>
          <Text style={type.section}>{forYou.length ? 'More starter decks' : 'Starter decks'}</Text>
          {more.map(row)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StarterRow({ deck, ownedId, busy, onAdd }: { deck: StarterDeck; ownedId?: number; busy: boolean; onAdd: () => void }) {
  const cards = cardCount(deck);
  const open = () => ownedId != null && router.push({ pathname: '/deck/[deckId]', params: { deckId: String(ownedId) } });
  return (
    <View style={styles.row}>
      <DeckTile icon={deck.icon} tone={deck.tone} />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text style={type.bodySemi}>{deck.name}</Text>
        <Text style={type.caption}>{deck.description}</Text>
        <Text style={type.small}>{`${cards} cards`}</Text>
      </View>
      {ownedId != null ? (
        <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${deck.name} added. Open deck`} style={[styles.action, styles.added]}>
          <Ionicons name="checkmark" size={18} color={colors.ink} />
          <Text style={type.bodySemi}>Added</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onAdd}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Add ${deck.name}, ${cards} cards`}
          style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.accentPressed }]}
        >
          {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={[type.bodySemi, { color: colors.onAccent }]}>Add</Text>}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  import: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.ink },
  importIcon: { width: touchTarget, height: touchTarget, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  section: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
  action: {
    minWidth: 76,
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  added: { backgroundColor: colors.ground, borderWidth: 1, borderColor: colors.line },
});
