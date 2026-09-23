import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { DeckTile } from '@/components/DeckRow';
import { ExamCard } from '@/components/ExamCard';
import { InlineMarkup } from '@/components/Markup';
import { getDeckSummaries, searchNotes, setDeckNewPerDay, type DeckSummary, type NoteListItem } from '@/db/queries';
import { formatInterval } from '@/lib/fsrs';
import { goBack } from '@/lib/nav';
import { NOTE_TYPE_LABEL, notePreview, parseNote } from '@/lib/notes';
import { useSettings } from '@/store/settings';
import { colors, fonts, radius, spacing, touchTarget, type } from '@/theme';

/** "Code · 1 card · Due in 3 days" */
function noteMeta(n: NoteListItem, now: number) {
  const status = n.all_new || n.next_due == null ? 'New' : n.next_due <= now ? 'Due now' : `Due in ${formatInterval(new Date(n.next_due), new Date(now))}`;
  const typeLabel = NOTE_TYPE_LABEL[parseNote(n.type, n.fields).type];
  return [typeLabel, `${n.card_count} card${n.card_count === 1 ? '' : 's'}`, status].join(' · ');
}

export default function DeckDetail() {
  const db = useSQLiteContext();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const id = Number(deckId);
  const newPerDay = useSettings((s) => s.newCardsPerDay);
  const [deck, setDeck] = useState<DeckSummary | null>(null);
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [loadedAt, setLoadedAt] = useState(0); // "Due in…" labels are relative to when we loaded
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    let active = true;
    Promise.all([getDeckSummaries(db, newPerDay), searchNotes(db, id, query)]).then(([all, found]) => {
      if (!active) return;
      const d = all.find((x) => x.id === id);
      if (!d) return goBack(); // deck was deleted
      setDeck(d);
      setNotes(found);
      setLoadedAt(Date.now());
    });
    return () => {
      active = false;
    };
  }, [db, id, query, newPerDay]);

  // Reload on focus (after editing a card or the deck) and whenever the search changes.
  useFocusEffect(load);

  const due = deck ? deck.newCount + deck.learningCount + deck.reviewCount : 0;

  const header = deck && (
    <View style={styles.headerBlock}>
      <View style={styles.topBar}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/deck/[deckId]/edit', params: { deckId } })}
          accessibilityRole="button"
          accessibilityLabel="Edit deck"
          style={styles.iconButton}
        >
          <Ionicons name="create-outline" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.titleRow}>
        <DeckTile icon={deck.icon} tone={deck.tone} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={type.cardTitle}>{deck.name}</Text>
          <Text style={type.caption}>
            {deck.total} card{deck.total === 1 ? '' : 's'} · {deck.total ? Math.round((deck.mastered / deck.total) * 100) : 0}% mastered ·{' '}
            {due} due
          </Text>
        </View>
      </View>

      {deck.pace && (
        <ExamCard
          deckName={deck.name}
          pace={deck.pace}
          onApply={async (perDay) => {
            await setDeckNewPerDay(db, deck.id, perDay);
            load();
          }}
        />
      )}

      <View style={styles.actions}>
        <Button
          title={due ? 'Study now' : 'Nothing due'}
          disabled={!due}
          onPress={() => router.push({ pathname: '/study/[deckId]', params: { deckId } })}
          style={{ flex: 1 }}
        />
        <Button
          title="Add card"
          variant="secondary"
          onPress={() => router.push({ pathname: '/card/new', params: { deckId } })}
          style={{ flex: 1 }}
        />
      </View>

      <View style={styles.search}>
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search cards"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Search cards"
          style={styles.searchInput}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={notes}
        keyExtractor={(c) => String(c.id)}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          deck ? (
            <Text style={[type.body, styles.empty]}>{query ? 'No cards match your search.' : 'No cards yet. Tap “Add card”.'}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/card/[noteId]', params: { noteId: String(item.id) } })}
            accessibilityRole="button"
            accessibilityHint="Edit card"
            style={({ pressed }) => [styles.cardRow, pressed && { opacity: 0.9 }]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <InlineMarkup text={notePreview(parseNote(item.type, item.fields))} style={type.bodySemi} numberOfLines={2} />
              <Text style={type.small}>{noteMeta(item, loadedAt)}</Text>
              {!!item.tags && (
                <Text style={styles.tags} numberOfLines={1}>
                  {item.tags
                    .split(' ')
                    .map((t) => `#${t}`)
                    .join('  ')}
                </Text>
              )}
            </View>
            {!!item.any_flagged && <Ionicons name="flag" size={16} color={colors.accent} accessibilityLabel="Flagged" />}
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  headerBlock: { gap: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between' },
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget + 4,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, paddingVertical: 10 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 14,
    minHeight: touchTarget + 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
  tags: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.accent },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl },
});
